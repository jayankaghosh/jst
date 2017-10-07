var JST = {
	config: null,
	cache: {},
	setConfig: function(config){
		JST.config = config;
	}
};
(function(config, variablePattern){
	if(JST.config) config = JST.config;
	else if(config.getAttribute("src")){
		fetchFile(config.getAttribute("src"), function(response){
			config = response;
		}, false);
	}
	else{
		config = config.innerHTML;
	}
	config = JSON.parse(config);
	function fetchFile(url, callback, async){
		if(typeof async == "undefined") async = true;
		if(JST.cache[url]) return callback(JST.cache[url]);
	    var xmlhttp;
	    xmlhttp = new XMLHttpRequest();
	    xmlhttp.onreadystatechange = function(){
	        if (xmlhttp.readyState == 4 && xmlhttp.status == 200){
	            JST.cache[url] = xmlhttp.responseText;
	            callback(xmlhttp.responseText);
	        }
	    }
	    xmlhttp.open("GET", url, async);
	    xmlhttp.send();
	}
	var _renderTemplate = function(template, data){
		if(data){
			template = template.replace(variablePattern, function(match, objectReference) {
				try{
					var renderer = new Function('return '+objectReference);
					return renderer.bind(data)();
				}
				catch(e){
					console.log(e);
					return match;
				}
			});
		}
		return template;
	}
	var renderTemplate = function(parent, template, data){
		if(parent.getAttribute('data-loop')){
			var response = "";
			try{
				(function(){
					eval("this."+parent.getAttribute('data-loop')).forEach(function(row){
						response += _renderTemplate(template, row);
					});
					template = response;
				}).bind(data)();
			}
			catch(e){
				console.log(e);
			}
		}
		else{
			template = _renderTemplate(template, data);
		}
		parent.innerHTML = template;
	}
	var parsePage = function(templates, providers){
		for(var template in templates){
			var elements = document.querySelectorAll('[data-template="'+template+'"]');
			elements.forEach(function(element){
				var dataProvider = providers[element.getAttribute('data-provider')];
				fetchFile(templates[template], function(templateData){
					switch(typeof dataProvider){
						case "undefined":
							renderTemplate(element, templateData, null);
							break;
						case "string":
							fetchFile(dataProvider, function(dataProviderData){
								renderTemplate(element, templateData, JSON.parse(dataProviderData));
							});
							break;
						case "object":
							renderTemplate(element, templateData, dataProvider);
							break;
					}
				});
			});
		}
	}
	parsePage(config.templates?config.templates:{}, config.providers?config.providers:{});
})(
	document.querySelector('script[type="jst/config"]')?document.querySelector('script[type="jst/config"]'):{"templates":{},"providers":{}},
  	/{{var ([a-zA-Z\.\[\]0-9]*)}}/g
);