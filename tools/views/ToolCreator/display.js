var nodeWidth = 140;
var nodeHeight = 70;
var nodeMarginH = 50;
var nodeMarginV = 50;
var referenced = {};

function loadChildren(id) {
	var childList = creator.getChildren(id);
	var tNode = nodeList[id];
	var type;
	if(tNode)
		type = nodeList[id].type;
	var fnChildren;
	var inout;
	if(connectionTypes[viewMode].type == 'out') {
		inout = 'cout';
		if(viewMode == 'display' || viewMode == 'trigger' || viewMode == 'unlock') {
			fnChildren = function(node) {
				var children = [];
				if(node && node.output && node.output[viewMode]) {
					var outs = node.output[viewMode];
					for(var i = 0; i < outs.length; i++)
						children.push(nodeList[outs[i].node]);
				}
				return children;
			};
		}else if(viewMode == 'parent') {
			fnChildren = function(node) {
				return creator.getChildren(node.id);
/*
				if(childTree[node.id]) {
					var children = [];
					for(var i = 0; i < childTree[node.id].length; i++) {
						children.push(nodeList[childTree[node.id][i]]);
					}
					if(children.length == 0)
						return false;
					else
						return children;
				}else {
					return false;
				}*/
			};
		}
	}else {
		inout = 'cin';
		fnChildren = function(node) {
			var children = [];
			if(node && node.input && node.input[viewMode]) {
				var cons = node.input[viewMode];
				for(var i = 0; i < cons.length; i++) {
					for(var j = 0; j < cons[i].length; j++) {
						children.push(nodeList[cons[i][j].node]);
					}
				}
			}
			return children;
		}
	}

	var firstChilds = creator.getFirstChilds(childList, inout, fnChildren);
	if(viewMode == 'parent')
		firstChilds = [tNode];
	referenced = {};


	renderer.renderNodes(firstChilds, childList);
}


function toggleNodeBtns(node) {
	var type  = node.attr('data-type');
	var nDef  = window.app.creator.nodes.types[type];

	if(!nDef.output[viewMode] || nDef.output[viewMode].states.custom == null)
		node.find('.addOutput').hide();
	if(nDef.input[viewMode] == null || connectionTypes[viewMode].type == 'out')
		node.find('.addInput').hide();
//	if(connectionTypes[viewMode].type == 'out')
//		node.find('.addInput').hide();

	var template = $('.nodetemplate[data-type="' + type + '"]').clone().show();
	if(window.app.creator.nodes.serialize($(template)) === false)
		node.find('.editNode').hide();
}


function showProgress(ele) {
/*
	if (!spinnerVisible) {
		$('#darkScreen').show();
		$('#spinner').show();
		spinnerVisible = true;
	}
*/
	var tspinner = $('#spinner').clone();
	tspinner.show().appendTo(ele);
};

function hideProgress() {
	if (spinnerVisible) {
		var spinner = $("div#spinner");
		$('#darkScreen').fadeOut('fast');
		spinner.stop();
		spinner.fadeOut("fast");
		spinnerVisible = false;
	}
};
