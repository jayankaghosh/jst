(function(jst){
	if (!jst) jst = {};
	if(!jst.baseURL){
		jst.baseURL = function(){
			var origin = window.location.origin;
			var path = window.location.pathname.split("/");
			if(path[path.length-1].indexOf(".") >= 0) path.splice(path.length-1, 1);
			path = origin+path.join('/');
			if(path.charAt(path.length-1) == '/') path = path.slice(0, -1);
			return path;
		}
	}
	if(!jst.variablePattern){
		jst.variablePattern = /{{var (.*?)}}/;
	}
	if(!jst.preprocessorPattern){
		jst.preprocessorPattern = /\<\?(.*?)\?\>/;
	}
	if(!jst.getVariablePattern){
		jst.getVariablePattern = function(){
			var pattern = jst.variablePattern;
			var source = pattern.source;
			return new RegExp(source, "g");
		}
	}
	if(!jst.getpreprocessorPattern){
		jst.getpreprocessorPattern = function(){
			return jst.preprocessorPattern; 
		}
	}
	if(!jst.setVariablePattern){
		jst.setVariablePattern = function(regex){
			jst.variablePattern = regex;
		}
	}
	if(!jst.setpreprocessorPattern){
		jst.setpreprocessorPattern = function(regex){
			jst.preprocessorPattern = regex;
		}
	}
	if(!jst.config){
		jst.config = {"templates":{},"providers":{}};
	}
	if(!jst.loaderHTML){
		jst.loaderHTML = "...";
	}
	if(!jst.cache){
		jst.cache = {};
	}
	if(!jst.providers){
		jst.providers = {};
	}
	if(!jst.setLoaderHTML){
		jst.setLoaderHTML = function(html){
			jst.loaderHTML = html;
		}
	}
	if(!jst.setConfig){
		jst.setConfig = function(config){
			jst.config = config;
		}
	}
	if(!jst.setTemplate){
		jst.setTemplate = function(name, url){
			jst.config.templates[name] = url;
		}
	}
	if(!jst._log){
		jst._log = [];
		jst.log = function(message){
			if(jst.debug){
				jst._log.push(message);
			}
		}
		jst.getLog = function(){
			return jst._log;
		}
		jst.debugger = function(){
			jst.debug = true;
			var timeStart = new Date().getTime();
			try{
				jst.actions.parsePage();
			}
			catch(e){
				jst.log(e);
			}
			var timeStop = new Date().getTime();
			jst.debug = false;
			console.log('Execution completed in '+(timeStop-timeStart)+' milliseconds')
			return jst.getLog();
		}
	}
	window.JST = jst;
})(window.JST);


(function(variablePattern, preprocessorPattern, jst){
	var preprocessorPlaceholderString = Math.floor(Math.random() * (5000 - 1 + 1)) + 1;
	var Plugins = {
		subject: jst,
		render: function(f, args, context){
			jst.log("Plugin render "+f.name+" start");
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
			jst.log("Plugin render "+f.name+" end");
			return r;
		},
		execute(f, args, context){
			jst.log("Executing function "+f.name);
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
		}catch(e){jst.log("config not found");}
		jst.config = Plugins.render(mergeConfigs, [jst.config, config]);
		return jst.config;
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
		url = url.replace(/\$BASEURL/g, jst.baseURL);
		if(typeof async == "undefined") async = true;
		if(jst.cache[url]){
			switch (typeof jst.cache[url]) {
				case "object":
					return jst.cache[url].addEventListener('readystatechange', function(){
						jst.log("cache listener added for "+url);
						initCallback(this, url, extraData);
					});
				case "string":
					jst.log(url+" loaded from cache");
					return callback(jst.cache[url], url, extraData);
			}
		}
		var xmlhttp;
	    xmlhttp = new XMLHttpRequest();
	    xmlhttp.addEventListener('readystatechange', function(){
	    	initCallback(this, url);
	    });
	    xmlhttp.open("GET", url, async);
	    xmlhttp.send();

	    jst.cache[url] = xmlhttp;

	    function initCallback(xmlhttp, url){
	        if (xmlhttp.readyState == 4 && xmlhttp.status == 200){
	        	jst.cache[url] = xmlhttp.responseText;
	            callback(xmlhttp.responseText, url, extraData);
	        }
	    }
	}
	var templatePreProcessor = function(template, data){
		template = template.replace(/(?:\r\n|\r|\n)/g, preprocessorPlaceholderString);
		var processedTemplate = "";
		while(template.length > 0){
		   	var pos = template.search(preprocessorPattern);
		   	if(pos >= 0){
		       	addToProcessedTemplate(template.substr(0, pos));
		       	template = template.substr(pos);
		       	matched = preprocessorPattern.exec(template);
		       	processedTemplate += matched[1];
		       	template = template.substr(matched[0].length)
		   	}
		   	else{
			   addToProcessedTemplate(template);
			   template = '';
			}
		}
		var f = new Function('var _jst_tmp_var="";'+processedTemplate+'return _jst_tmp_var;');
		return f.bind(data)();

		function addToProcessedTemplate(str){
			str = str.replace(/"/g, '\\"');
			str = str.replace(variablePattern, function(match, objectReference){
				return '"+'+objectReference+'+"';
			});
			processedTemplate += '_jst_tmp_var += "'+str+'";';
		}

	}
	var renderTemplate = function(template, data){
		if(!data) data = {};
		template = templatePreProcessor(template, data);
		return template.replace(/\$BASEURL/g, jst.baseURL).replace(new RegExp(preprocessorPlaceholderString, "g"), '\n');
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
				jst.log(e);
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
			jst.log({context: parent, message: "context has inner template calls, calling parsePage on context"}	);
			jst.actions.parsePage(parent);
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
			jst.log({context: page, message: elements.length+" template calls found in context"});
			elements.forEach(function(element){
				element.innerHTML = jst.loaderHTML;
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
					if(typeof jst.providers[dataProvider.name] != "object"){
						jst.providers[dataProvider.name] = [];
					}
					switch(typeof dataProvider.value){
						case "undefined":
							jst.providers[dataProvider.name].push({
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
								jst.providers[element.getAttribute('data-provider')].push({
									"element": element,
									"template": templateData,
									"debugInfo": debugInfo
								});
								Plugins.render(parseTemplate, [element, templateData, dataProviderData, debugInfo]);
							});
							break;
						case "object":
							var debugInfo = [url, dataProvider.value];
							jst.providers[dataProvider.name].push({
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

	jst.setProvider = function(name, data){
		var provider = jst.providers[name];
		jst.config.providers[name] = data;
		if(provider){
			provider.forEach(function(hook){
				Plugins.render(parseTemplate, [hook.element, hook.template, data, hook.debugInfo]);
			});
		}
	}

	jst.getProvider = function(name){
		return jst.providers[name];
	}

	jst.actions = {
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
	jst.actions.parsePage();
})(
	window.JST.getVariablePattern(),
	window.JST.getpreprocessorPattern(),
	window.JST
);