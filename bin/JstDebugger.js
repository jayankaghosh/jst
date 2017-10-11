JST.plugins.beforeparseTemplate = function(parent, template, data, debugInfo){
	template = "<div style='position: relative;border: 1px solid red;margin:2px'>"+template+"<div style='position: absolute;z-index:1000;padding:5px;background:red;color:white;top:0;font-size:14px' onmouseover='javascript:this.style.opacity=0.3' onmouseout='javascript:this.style.opacity=1'>"+debugInfo[0]+"</div></div>";
	return [parent, template, data, debugInfo];
}