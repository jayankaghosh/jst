if(!window.JST){
	var JST = {
		config: null,
		loaderHTML: "...",
		cache: {},
		setLoaderHTML: function(html){
			JST.loaderHTML = html;
		},
		setConfig: function(config){
			JST.config = config;
		},
		beforeRender: function(template, data){
			return [template, data];
		},
		afterRender: function(renderedData){
			return renderedData;
		},
		beforeInsert: function(parent, data){
			return [parent, data];
		},
		afterInsert: function(parent){}
	};
}
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
		var beforeRenderData = JST.beforeRender(template, data);
		if(beforeRenderData[1]){
			beforeRenderData[0] = beforeRenderData[0].replace(variablePattern, function(match, objectReference) {
				try{
					var renderer = new Function('return '+objectReference);
					var rendered = renderer.bind(beforeRenderData[1])();
					if(typeof rendered == "object") rendered = JSON.stringify(rendered);
					return rendered;
				}
				catch(e){
					console.log(e);
					return match;
				}
			});
		}
		return JST.afterRender(beforeRenderData[0]);
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
		var beforeInsertData = JST.beforeInsert(parent, template);
		beforeInsertData[0].innerHTML = beforeInsertData[1];
		if(beforeInsertData[1].indexOf('data-template=') >= 0){
			JST.parsePage(parent);
		}
		JST.afterInsert(parent);
	}
	var parsePage = function(templates, providers, page){
		for(var template in templates){
			var elements = page.querySelectorAll('[data-template="'+template+'"]');
			elements.forEach(function(element){
				element.innerHTML = JST.loaderHTML;
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
	JST.parsePage = function(page){
		if(!page) page = document;
		parsePage(config.templates?config.templates:{}, config.providers?config.providers:{}, page);
	}
	JST.parsePage();
})(
	document.querySelector('script[type="jst/config"]')?document.querySelector('script[type="jst/config"]'):{"templates":{},"providers":{}},
  	/{{var ([a-zA-Z\.\_\[\]0-9]*)}}/g
);