if(!window.JST){
	var JST = {
		baseURL: function(){
			var origin = window.location.origin;
			var path = window.location.pathname.split("/");
			if(path[path.length-1].indexOf(".") >= 0) path.splice(path.length-1, 1);
			path = origin+path.join('/');
			if(path.charAt(path.length-1) == '/') path = path.slice(0, -1);
			return path;
		},
		config: {"templates":{},"providers":{}},
		loaderHTML: "...",
		cache: {},
		providers: {},
		setLoaderHTML: function(html){
			JST.loaderHTML = html;
		},
		setConfig: function(config){
			JST.config = config;
		},
		setTemplate: function(name, url){
			JST.config.templates[name] = url;
		}
	};
}
(function(variablePattern){
	var Plugins = {
		subject: window.JST,
		render: function(f, args, context){
			if(!context) context = window;
			if(typeof Plugins.subject.plugins != "object") Plugins.subject.plugins = {};
			//before
			if(typeof Plugins.subject.plugins["before"+f.name] == "function"){
				args = Plugins.execute(Plugins.subject.plugins["before"+f.name], args, f);
			}
			var r = Plugins.execute(f, args);
			//after
			if(typeof Plugins.subject.plugins["after"+f.name] == "function"){
				r = Plugins.execute(Plugins.subject.plugins["after"+f.name], [r], f);
			}
			return r;
		},
		execute(f, args, context){
			return f.apply(context, args);
		}
	}
	function fetchConfig(parent){
		var config = parent.querySelector('script[type="jst/config"]')?parent.querySelector('script[type="jst/config"]'):{"templates":{},"providers":{}}
		try{
			if(config.getAttribute("src")){
				_fetchFile(config.getAttribute("src"), function(response){
					config = response;
				}, false, null);
			}
			else{
				config = config.innerHTML;
			}
			config = JSON.parse(config);
		}catch(e){console.log("JST: config not found");}
		JST.config = Plugins.render(mergeConfigs, [JST.config, config]);
		return JST.config;
	}
	function mergeConfigs(obj1, obj2){
		if(!obj1['templates']) obj1['templates'] = {};
		if(!obj1['providers']) obj1['providers'] = {};

		//merge templates
		for(var key in obj2['templates']){
			obj1['templates'][key] = obj2['templates'][key];
		}
		//merge providers
		for(var key in obj2['providers']){
			obj1['providers'][key] = obj2['providers'][key];
		}
		return obj1;
	}
	function _fetchFile(url, callback, extraData, async){
		url = url.replace(/\$BASEURL/g, JST.baseURL);
		if(typeof async == "undefined") async = true;
		if(JST.cache[url]){
			switch (typeof JST.cache[url]) {
				case "object":
					return JST.cache[url].addEventListener('readystatechange', function(){
						initCallback(this, url, extraData);
					});
				case "string":
					return callback(JST.cache[url]);
			}
		}
		var xmlhttp;
	    xmlhttp = new XMLHttpRequest();
	    xmlhttp.addEventListener('readystatechange', function(){
	    	initCallback(this, url);
	    });
	    xmlhttp.open("GET", url, async);
	    xmlhttp.send();

	    JST.cache[url] = xmlhttp;

	    function initCallback(xmlhttp, url){
	        if (xmlhttp.readyState == 4 && xmlhttp.status == 200){
	        	JST.cache[url] = xmlhttp.responseText;
	            callback(xmlhttp.responseText, url, extraData);
	        }
	    }
	}
	var renderTemplate = function(template, data){
		if(!data) data = {};
		template = template.replace(variablePattern, function(match, objectReference) {
			try{
				var renderer = new Function('return '+objectReference);
				var rendered = renderer.bind(data)();
				if(typeof rendered == "object") rendered = JSON.stringify(rendered);
				return rendered;
			}
			catch(e){
				console.log(e);
			}
		});
		return template.replace(/\$BASEURL/g, JST.baseURL);;
	}
	var parseTemplate = function(parent, template, data, debugInfo){
		if(parent.getAttribute('data-loop')){
			var response = "";
			try{
				var loopRenderer = new Function('return '+parent.getAttribute('data-loop'));
				loopRenderer.bind(data)().forEach(function(row){
					response += Plugins.render(renderTemplate, [template, row]);
				});
				template = response;
			}
			catch(e){
				console.log(e);
			}
		}
		else{
			template = Plugins.render(renderTemplate, [template, data]);
		}
		parent.innerHTML = template;
		for(var i = 0; i < parent.childNodes.length; i++){
			if(isJavascript(parent.childNodes[i])){
				var executor = new Function(parent.childNodes[i].innerHTML);
				executor.bind(data)();
				parent.removeChild(parent.childNodes[i]);
			}
		}

		if(hasAttribute(parent, 'data-template')){
			JST.actions.parsePage(parent);
		}

		function hasAttribute(parent, attribute){
			var allElements = parent.getElementsByTagName("*");
			for (var i = 0; i < allElements.length; i++){
				if (allElements[i].getAttribute(attribute) !== null){
					return true;
				}
			}
			return false;
		}

		function isJavascript(element){
			return element.tagName == "SCRIPT" && element.getAttribute('type') && element.getAttribute('type').toLowerCase() == "text/javascript";
		}

	}
	var parsePage = function(templates, providers, page){
		for(var template in templates){
			var elements = page.querySelectorAll('[data-template="'+template+'"]');
			elements.forEach(function(element){
				element.innerHTML = JST.loaderHTML;
				var dataProvider = {
					name: element.getAttribute('data-provider'),
					value: providers[element.getAttribute('data-provider')]
				}
				if(typeof templates[template] == "function"){
					afterTemplateFetch(templates[template](dataProvider.name, dataProvider.value), "Loaded Locally", dataProvider);
				}
				else{
					_fetchFile(templates[template], afterTemplateFetch, dataProvider);
				}

				function afterTemplateFetch(templateData, url, dataProvider){
					if(typeof JST.providers[dataProvider.name] != "object"){
						JST.providers[dataProvider.name] = [];
					}
					switch(typeof dataProvider.value){
						case "undefined":
							JST.providers[dataProvider.name].push({
								"element": element,
								"template": templateData,
								"debugInfo": debugInfo
							});
							Plugins.render(parseTemplate, [element, templateData, null, [url, null]]);
							break;
						case "string":
							_fetchFile(dataProvider.value, function(dataProviderData){
								dataProviderData = JSON.parse(dataProviderData);
								var debugInfo = [url, dataProviderData];
								JST.providers[element.getAttribute('data-provider')].push({
									"element": element,
									"template": templateData,
									"debugInfo": debugInfo
								});
								Plugins.render(parseTemplate, [element, templateData, dataProviderData, debugInfo]);
							});
							break;
						case "object":
							var debugInfo = [url, dataProvider.value];
							JST.providers[dataProvider.name].push({
								"element": element,
								"template": templateData,
								"debugInfo": debugInfo
							});
							Plugins.render(parseTemplate, [element, templateData, dataProvider.value, debugInfo]);
							break;
					}
				}
			});
		}
	}

	JST.setProvider = function(name, data){
		var provider = JST.providers[name];
		JST.config.providers[name] = data;
		if(provider){
			provider.forEach(function(hook){
				Plugins.render(parseTemplate, [hook.element, hook.template, data, hook.debugInfo]);
			});
		}
	}

	JST.getProvider = function(name){
		return JST.providers[name];
	}

	JST.actions = {
		"parsePage": function(page){
			if(!page) page = document;
			var config = Plugins.render(fetchConfig, [page]);
			Plugins.render(parsePage, [config.templates?config.templates:{}, config.providers?config.providers:{}, page]);
		},
		"parseTemplate": function(parent, template, data, debugInfo){
			if(!debugInfo){
				debugInfo = ["Locally loaded", JSON.stringify(data)];
			}
			return Plugins.render(parseTemplate, [parent, template, data, debugInfo]);
		},
		"renderTemplate": function(template, data){
			return Plugins.render(renderTemplate, [template, data]);
		}
	}
	JST.actions.parsePage();
})(/{{var ([a-zA-Z\.\-\$\_\[\]0-9]*)}}/g);