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
		setLoaderHTML: function(html){
			JST.loaderHTML = html;
		},
		setConfig: function(config){
			JST.config = config;
		}
	};
}
(function(variablePattern){
	var Plugins = {
		render: function(f, args, context){
			if(!context) context = window;
			//before
			if(typeof JST["before"+f.name] == "function"){
				args = Plugins.execute(JST["before"+f.name], args, f);
			}
			var r = Plugins.execute(f, args);
			//after
			if(typeof JST["after"+f.name] == "function"){
				r = Plugins.execute(JST["after"+f.name], [r], f);
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
				}, false);
			}
			else{
				config = config.innerHTML;
			}
			config = JSON.parse(config);
		}catch(e){}
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
	function _fetchFile(url, callback, async){
		url = url.replace(/\$BASEURL/g, JST.baseURL);
		if(typeof async == "undefined") async = true;
		if(JST.cache[url]){
			switch (typeof JST.cache[url]) {
				case "object":
					return JST.cache[url].addEventListener('readystatechange', function(){
						initCallback(this, url);
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
	            callback(xmlhttp.responseText, url);
	        }
	    }
	}
	var renderTemplate = function(template, data){
		if(data){
			template = template.replace(variablePattern, function(match, objectReference) {
				try{
					var renderer = new Function('return '+objectReference);
					var rendered = renderer.bind(data)();
					if(typeof rendered == "object") rendered = JSON.stringify(rendered);
					return rendered;
				}
				catch(e){
					console.log(e);
					return match;
				}
			});
		}
		return template;
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
		if(template.indexOf('data-template=') >= 0){
			JST.parsePage(parent);
		}
	}
	var parsePage = function(templates, providers, page){
		for(var template in templates){
			var elements = page.querySelectorAll('[data-template="'+template+'"]');
			elements.forEach(function(element){
				element.innerHTML = JST.loaderHTML;
				var dataProvider = providers[element.getAttribute('data-provider')];
				_fetchFile(templates[template], function(templateData, url){
					switch(typeof dataProvider){
						case "undefined":
							Plugins.render(parseTemplate, [element, templateData, null, [url, null]]);
							break;
						case "string":
							_fetchFile(dataProvider, function(dataProviderData){
								Plugins.render(parseTemplate, [element, templateData, JSON.parse(dataProviderData), [url, dataProviderData]]);
							});
							break;
						case "object":
							Plugins.render(parseTemplate, [element, templateData, dataProvider, [url, dataProvider]]);
							break;
					}
				});
			});
		}
	}
	JST.parsePage = function(page){
		if(!page) page = document;
		var config = Plugins.render(fetchConfig, [page]);
		Plugins.render(parsePage, [config.templates?config.templates:{}, config.providers?config.providers:{}, page]);
	}
	JST.parsePage();
})(/{{var ([a-zA-Z\.\_\[\]0-9]*)}}/g);