//************************************************************************************************************//
//  File: render.js
//  Date: 2011/07/08
//  Description: Render object
//  The Render object will handle rendering nodes, endpoints, and connections to the screen and their position
//
//  Example: var YourGame = Object.create(Game);
//
//***********************************************************************************************************//

function getEndpoint(type, inout, x, y) {
	var anchor = [];
	var style = {};

	if(anchors[type] === 'horizontal') {
		if(inout == 'input') {
			anchor = [y - .025, x];
			style = jQuery.extend(true, {}, Render.creator.graphHdlr.input[type]);
			style.endpoint[1].width  = Render.creator.graphHdlr.input[type].endpoint[1].height;
			style.endpoint[1].height = Render.creator.graphHdlr.input[type].endpoint[1].width;
		} else {
			anchor = [y + .03, x];
			style = jQuery.extend(true, {}, Render.creator.graphHdlr.output[type]);
			style.endpoint[1].width  = Render.creator.graphHdlr.output[type].endpoint[1].height;
			style.endpoint[1].height = Render.creator.graphHdlr.output[type].endpoint[1].width;
		}
	} else {
		if(inout == 'input') {
			anchor = [x, y - .06];
			style = Render.creator.graphHdlr.input[type];
		} else {
			anchor = [x, y + .07];
			style = Render.creator.graphHdlr.output[type];
		}
	}

	return { anchor: anchor, style: style };
}

var Render = {};

Render.referenceCheck = {};
Render.offsetX = 0;
Render.offsetY = 0;
Render.creator;

Render.init = function(creator, options) {
	Render.offsetX = options.offsetX || 0;
	Render.offsetY = options.offsetY || 0;
	Render.creator = creator;
}

Render.renderNodes = function(firstChilds, childList, layer) {
	var offsetX    = Render.offsetX;
	var offsetY    = Render.offsetY;
	var fnChildren = Render.creator.getNextRenderNodes[viewTypes[viewMode][((Render.creator.curType) ? Render.creator.curType : viewMode)][1]];

	for(var i = 0; i < firstChilds.length; i++) {
		var box;
		var check = {};
		box = Render.renderNode(offsetX, offsetY, firstChilds[i], fnChildren, check, childList, layer);
		offsetX = box.right + 40;
	}

	for(var i = 0; i < childList.length; i++) {
		if($('.node[data-id="' + childList[i].id + '"]').length == 0) {
			Render.appendNode(childList[i], { top: offsetY, left: offsetX }, childList, layer);
			offsetX += nodeWidth + nodeMarginH;
		}
	}

	Render.loadConnections(layer);
	jsPlumb.draggable(layer.jNode.find('.node'));
/*	// Make all selected items draggable as a group.
	// Since jsPlumb abstracts this, not really doable unless jsPlumb is hacked
	layer.jNode.find('.node').draggable({
		start: function(event, ui) {
			  posTopArray = [];
			  posLeftArray = [];
			  if ($(this).hasClass("ui-selected")) {  // Loop through each element and store beginning start and left positions
				   $(".ui-selected").each(function(i) {
						thiscsstop = $(this).css('top');
						thiscssleft = $(this).css('left');
						posTopArray[i] = parseInt(thiscsstop);
						posLeftArray[i] = parseInt(thiscssleft);
				   });
			  }

			  begintop  = $(this).offset().top; // Dragged element top position
			  beginleft = $(this).offset().left; // Dragged element left position
		 },
		 drag: function(event, ui) {
			  var topdiff = $(this).offset().top   - begintop;  // Current distance dragged element has traveled vertically
			  var leftdiff = $(this).offset().left - beginleft; // Current distance dragged element has traveled horizontally

			  if ($(this).hasClass("ui-selected")) {
				   $(".ui-selected").each(function(i) {
						$(this).css('top', posTopArray[i] + topdiff); // Move element veritically - current css top + distance dragged element has travelled vertically
						$(this).css('left', posLeftArray[i] + leftdiff); // Move element horizontally - current css left + distance dragged element has travelled horizontally
						$('canvas._jsPlumb_endpoint[data-id="' + $(this).attr('data-id') + '"]').each(function() {
							$(this).css('top',  parseInt($(this).css('top'))  + topdiff);
						});
						$('canvas._jsPlumb_endpoint[data-id="' + $(this).attr('data-id') + '"]').each(function() {
							$(this).css('left', parseInt($(this).css('left')) + leftdiff);
						});
				   });
			  }
		 }
	});
*/
	Render.renderLabels(layer.jNode);
	Render.resizeLayer(layer.jNode);
}

Render.renderNode = function(offsetX, offsetY, node, fnChildren, check, siblings, layer) {
	var tree = { left: offsetX, right: (offsetX + nodeWidth), top: offsetY, bottom: (offsetY + nodeHeight) };
	var renderDirec = anchors[traverseType[node.type]];		// anchors have horizontal/vertical rendering info

	if (renderDirec == 'vertical') {
		var x = tree.left;
	} else {
		var x = tree.right + nodeMarginH;
	}

	if (renderDirec == 'vertical' && connectionTypes[viewMode].type == 'out') {
		var y = tree.bottom + nodeMarginV;
	} else {
		var y = tree.top;
	}
		
	check[node.id] = true;
	var cons = fnChildren(node);
	if(cons) {
		for(var i = 0; i < cons.length; i++) {
			if(cons[i] && !check[cons[i].id]) {
				var result = Render.renderNode(x, y, cons[i], fnChildren, check, siblings, layer);
				tree.right = result.right;

				if(connectionTypes[viewMode].type == 'out')
					tree.bottom = Math.max(tree.bottom, result.bottom);
				else {
					tree.top = Math.max(tree.bottom, result.bottom) + nodeMarginV;		// for each child, pushes root node one more level down
					tree.bottom = tree.top + nodeHeight;
				}
				x = tree.right + nodeMarginH;
			}
		}
	}

	if(renderDirec == 'vertical') {
		var options = {
			top: tree.top,
			left: Math.round(tree.left + ((tree.right - tree.left) / 2) - (nodeWidth / 2))
		};
	} else {
		var options = {
			top: tree.top,
			left: tree.left
		};
	}

	if(node && !referenced[node.id]) {
		referenced[node.id] = true;
		Render.appendNode(node, options, siblings, layer);
	}
	return tree;
}

Render.renderLabels = function(layer) {
	layer.find('.eLabel').remove();
	var layerId = layer.attr('data-layer');
	var ref = {};
	$('canvas._jsPlumb_endpoint[data-inout="output"][data-layer="' + layerId + '"]').each(function() {
		var id    = $(this).attr('data-id');
		var state = $(this).attr('data-onstate');
		var type  = $(this).attr('data-cType');

		if(!ref[id + state]) {
			ref[id + state] = true;
			var node = $('.node[data-id="' + id + '"]');
			if(node.length > 0) {
				var nPos        = node.offset();
				var pos         = $(this).offset();
				var label       = $('<div class="eLabel">' + state + '</div>');

				label = label.appendTo(node);

				var margin  = pos.left - nPos.left;
				var lWidth  = label.width() / 2;
				var eWidth  = $(this).width() / 2;
				var lOffset = lWidth - eWidth;

				if(anchors[type] == 'horizontal')
					label.addClass('vertical');
				else
					label.css({ 'top': 55, 'margin-left': margin - lOffset, 'z-index': 10000 });
			}
		}
	});
}

Render.appendNode = function(node, options, siblings, layer) {
	var type = '';
	var html = $('#nodeGraphTemplate').clone().show();			// use templates and don't use show... it's slow as peanut butter
	$(html).attr('id', node.type + node.id);
	$(html).attr('data-id', node.id);
	$(html).attr('data-type', node.type);
	var handler = Render.creator.nodes.types[node.type];
	var detail;
//	var nodeCount = $('.node[data-type="' + node.type + '"]').length + 1;

	if(handler) {
		$(html).find('.nodeType').html(node.type);
		detail = Render.creator.nodes.getNodeRepresentation(node, { siblings: siblings});
		if(!detail || detail == '')
			detail = node.type + ' (' + node.id + ')';
	}else
		detail = 'No handler found for node type : ' + node.type;

	$(html).find('.nodeDesc').html(detail);

	var appendedNode = $(html).appendTo(layer.jNode);
	if (options && options.top)
		appendedNode[0].style.top = parseInt(options.top) + 'px';
	if (options && options.left)
		appendedNode[0].style.left = parseInt(options.left) + 'px';

	Render.attachEndpoints(appendedNode, layer);
	toggleNodeBtns(appendedNode);
}

Render.attachEndpoints = function(jNode, layer) {
	var id                = jNode.attr('data-id');
	var type              = jNode.attr('data-type');
	var name              = type + id;
	var nDef              = Render.creator.nodes.types[type];
	var visibleConnectors = definedViews[viewType].connectors;

	// adds endpoints if the node data has any defined
	// loop through for all visible connector types

	if(Render.creator.nodes.nodesMap[id]) {
		for(var conn in visibleConnectors) {
			var connector = visibleConnectors[conn];
			if(Render.creator.nodes.nodesMap[id].cout && Render.creator.nodes.nodesMap[id].cout[connector]) {
				var outs = Render.creator.nodes.nodesMap[id].cout[connector];
				for (var state in outs) {
					Render.addEndpoint(jNode, 'output', state, layer, connector);
				}
			}

			if(Render.creator.nodes.nodesMap[id].input && Render.creator.nodes.nodesMap[id].input[connector]) {
				var inputs = Render.creator.nodes.nodesMap[id].input[connector];
				for(var i = 0; i < inputs.length; i++) {
					Render.addEndpoint(jNode, 'input', '', layer, connector);
				}
			}

			// add default output endpoints based on nodeDefinition
			if(nDef.output && nDef.output[connector] && nDef.output[connector].states) {
				var states = nDef.output[connector].states;
				for(var state in states) {
					if(state != 'custom') {								// custom is a reserved state
						Render.addEndpoint(jNode, 'output', state, layer, connector);
					}
				}
			}

			// if connection type is output, add input if input is defined in the node definition
			if(connectionTypes[connector].type == 'out') {
				if(nDef.input[connector]) {
					Render.addEndpoint(jNode, 'input', '', layer, connector);
				}
			} else {
				if(nDef.input && nDef.input[viewMode]) {
					Render.addEndpoint(jNode, 'input');
				}
			}
		}
	}
}

Render.addEndpoint = function (jNode, inout, state, layer, cType) {
	var id      = jNode.attr('data-id');
	var type    = jNode.attr('data-type');
	var name    = type + id;
	var node    = Render.creator.nodes.nodesMap[id];
	var anchor;
	var endpoint;
	var nodeDef = {};

	if(node && Render.creator.nodes.types[type][inout] && Render.creator.nodes.types[type][inout][cType])
		nodeDef = Render.creator.nodes.types[type][inout][cType];
	else
		nodeDef.accepts = 1;

	if(connectionTypes[cType].type == 'out') {		// out connection
		if(inout == 'input') {		// input endpoint
			endpoint   = getEndpoint(cType, 'input', 0.5, 0);
			anchor     = endpoint.anchor;
			var styles = endpoint.style;

			var uuid      = name + 'input' + cType;
			var epOptions = { uuid: uuid, anchor: anchor, maxConnections: nodeDef.accepts };
			var epAttribs = {
				'id'         : uuid,
				'data-inout' : 'input',
				'data-cType' : cType,
				'data-id'    : id,
				'data-type'  : type,
				'data-layer' : layer.jNode.attr('data-layer')
			};

			var epCanvas = jsPlumb.addEndpoint(jNode.attr('id'), epOptions, styles).canvas;
			$(epCanvas).attr(epAttribs);

		}else {				// output endpoint
			if(!state)
				state = 'any';

			if($('canvas[data-inout="' + inout + '"][data-cType="' + cType + '"][data-id="' + id + '"][data-type="' + type + '"][data-onState="' + state + '"]').length == 0) {

				var outputs = $('canvas._jsPlumb_endpoint[data-inout="' + inout + '"][data-cType="' + cType + '"][data-id="' + id + '"][data-type="' + type + '"]');
				var space = 0;
				var d = 0;
				if(outputs.length > 0)
					d = 1 / (outputs.length + 2);
				else
					space = 0.5;

				outputs.each(function() {
					space += d;
					var eId = $(this).attr('id');
					var source = jsPlumb.getEndpoint(eId);
					source.anchor.x = space;
				});

				space += d;
				var maxConnections = 1;
				if(nodeDef && nodeDef.states && nodeDef.states[state]) {
					maxConnections = nodeDef.states[state].count[1];
				} else if(nodeDef && nodeDef.states && nodeDef.states.custom) {
					maxConnections = nodeDef.states.custom.count[1];
				}

				endpoint   = getEndpoint(cType, 'output', space, 1);
				anchor     = endpoint.anchor;
				var styles = endpoint.style;

				var uuid      = name + 'output' + cType + state;
				var epOptions = { uuid: uuid, anchor: anchor, maxConnections: maxConnections };
				var epAttribs = {
					'id'           : uuid,
					'data-inout'   : 'output',
					'data-cType'   : cType,
					'data-id'      : id,
					'data-type'    : type,
					'data-onState' : state,
					'data-layer'   : layer.jNode.attr('data-layer')
				};

				var epCanvas = jsPlumb.addEndpoint(jNode.attr('id'), epOptions, styles).canvas;
				$(epCanvas).attr(epAttribs);
			}
		}
	}else {			// in connection
		if(inout == 'input') {		// input endpoint
			var inputs = $('canvas[data-inout="input"][data-cType="' + cType + '"][data-id="' + id + '"][data-type="' + type + '"]');
			var count = inputs.length;
			var space = 0;
			var d = 0;
			if(count)
				d = 1 / (count + 2);
			else
				space = 0.5;

			var lCount = 0;
			inputs.each(function() {
				space += d;
				var source = jsPlumb.getEndpoint(name + inout + cType + lCount);
				source.anchor.x = space;
				lCount++;				
			});

			space += d;

			endpoint   = getEndpoint(cType, 'input', space, 0);
			anchor     = endpoint.anchor;
			var styles = endpoint.style;

			var uuid = name + 'input' + cType + count;

			jNode.addEndpoint(jsPlumb.extend({ uuid: uuid, anchor: anchor, maxConnections: nodeDef.accepts }, styles));
			$('#' + uuid).attr({'data-inout': 'input', 'data-count': count, 'data-cType': cType, 'data-id': id, 'data-type': type, 'data-layer': layer.jNode.attr('data-layer') });
//			jsPlumb.repaintEverything();
		}else {			// output endpoint
			if(!state)
				state = 'any';
			var outputs = (Render.creator.nodes.nodesMap[id] && Render.creator.nodes.nodesMap[id].cout && Render.creator.nodes.nodesMap[id].cout[cType]) ? Render.creator.nodes.nodesMap[id].cout[cType].length : 0;
			var space = 0;
			if(outputs)
				space = 1 / (outputs + 2);
			else
				space = 0.5;
			var maxConnections = 1;
			if(nodeDef && nodeDef.states && nodeDef.states[state]) {
				maxConnections = nodeDef.states[state].count[1];
			}

			endpoint   = getEndpoint(cType, 'output', space, 1);
			anchor     = endpoint.anchor;
			var styles = endpoint.style;
			var uuid   = name + 'output' + cType + state;

			jNode.addEndpoint(jsPlumb.extend({ uuid: uuid, anchor: [space, 1], maxConnections: maxConnections }, styles));
			$('#' + uuid).attr({'data-inout': 'output', 'data-cType': cType, 'data-id': id, 'data-type': type, 'data-onState': state, 'data-layer': layer.jNode.attr('data-layer') });
		}
	}
	Render.renderLabels(layer.jNode);
}

Render.loadConnections = function (layer) {
	viewMode         = layer.viewMode;
	var visibleConnectors = definedViews[viewType].connectors;
//	var _makeOverlay = function() { return new jsPlumb.Overlays.Arrow({foldback:0.7, fillStyle:'gray', location:0.5, width:14}); };
	var _makeOverlay = function() { return ['Arrow', { foldback:0.7, fillStyle:'gray', location:0.5, width:14 } ]; };

	layer.jNode.find('.node').each(function() {
		if($(this).is(':visible')) {
			var id = $(this).attr('data-id');
			var type = $(this).attr('data-type');
			var name = type + id;

			if(Render.creator.nodes.nodesMap[id]) {
				for(var conn in visibleConnectors) {
					var connector = visibleConnectors[conn];
					if(Render.creator.nodes.nodesMap[id].input && Render.creator.nodes.nodesMap[id].input[connector]) {
						var cons = Render.creator.nodes.nodesMap[id].input[connector];
						createInConnections(cons, id, type, name, connector);
					};

					if(Render.creator.nodes.nodesMap[id].cout && Render.creator.nodes.nodesMap[id].cout[connector]) {
						var cons = Render.creator.nodes.nodesMap[id].cout[connector];

						for (var state in cons) {
							createOutConnections(state, cons[state], id, type, name, connector);
						}



						for(var i = 0; i < cons.length; i++) {
							createOutConnections(cons[i], id, type, name, connector);
						}
					}
				}
			}
		}
	});

	function createInConnections(cons, id, type, name, cType) {
		for(var j = 0; j < cons.length; j++) {
			for(var l = 0; l < cons[j].length; l++) {
				var conId = cons[j][l].node;
				if(Render.creator.nodes.nodesMap[conId]) {
					var nType = (cons[j][l].onState) ? cons[j][l].onState : '';
					var conName = Render.creator.nodes.nodesMap[conId].type + Render.creator.nodes.nodesMap[conId].id;
					var source = jsPlumb.getEndpoint(name + 'input' + cType + j);
					var target = jsPlumb.getEndpoint(conName + 'output' + cType);
					var state = cons[j][l].onState;

					if(!target) {
						Render.addEndpoint($('#' + conName), 'output', state, layer, cType);
						target = jsPlumb.getEndpoint(conName + 'output' + cType + state);
					}

					if($('#' + conName).length > 0 && !source.isFull() && !target.isFull()) {
						renderFlag = true;
						var test = jsPlumb.connect({ uuids: [ name + 'input' + cType + j, conName + 'output' + cType + state ], overlays:[_makeOverlay()] });
						var cId = $(test.canvas).attr('id');
						$('#' + cId).attr('data-type', type);
						$('#' + cId).attr('data-cType', cType);
						$('#' + cId).attr('data-layer', layer.jNode.attr('data-layer'));
						renderFlag = false;
					}
				}
			}
		}
	}

	function createOutConnections(nType, cons, id, type, name, cType) {
		for (var i = 0, len = cons.length; i < len; i++) {

			var conId = cons[i];
			if(Render.creator.nodes.nodesMap[conId]) {
				var conName = Render.creator.nodes.nodesMap[conId].type + Render.creator.nodes.nodesMap[conId].id;
				var sourceId = name + 'output' + cType + nType;
				var targetId = conName + 'input' + cType;
				var source = jsPlumb.getEndpoint(sourceId);
				var target = jsPlumb.getEndpoint(targetId);

				if(!target) {
					Render.addEndpoint($('#' + conName), 'input', '', layer, cType);
					target = jsPlumb.getEndpoint(targetId);
				}

				if($('#' + conName).length > 0 && !source.isFull() && !target.isFull()) {
					renderFlag = true;
					var test  = jsPlumb.connect({ uuids: [sourceId, targetId], overlays:[_makeOverlay()] });
					$(test.canvas).attr('data-source', name);
					$(test.canvas).attr('data-target', conName);
					$(test.canvas).attr('data-type', type);
					$(test.canvas).attr('data-cType', cType);
					$(test.canvas).attr('data-layer', layer.jNode.attr('data-layer'));
					renderFlag = false;
				}
			}
		}
	}
}

Render.addLayer = function(node, curLayer) {
	if(curLayer) {
		curLayer.nextAll().each(function() {
			// Remove jsPlumb endpoints and connectors when removing a layer
			var rLayer = $(this).attr('data-layer');
			$('._jsPlumb_endpoint[data-layer="' + rLayer + '"]').remove();
			$('._jsPlumb_connector[data-layer="' + rLayer + '"]').remove();
			$(this).remove();
		});
	}

	if(!node) {
		$('.layer').each(function() {
			// Remove jsPlumb endpoints and connectors when removing a layer
			var rLayer = $(this).attr('data-layer');
			$('._jsPlumb_endpoint[data-layer="' + rLayer + '"]').remove();
			$('._jsPlumb_connector[data-layer="' + rLayer + '"]').remove();
			$(this).remove();
		});
	}

	$('.addNodeBtn').remove();
	var layer = {
		viewMode:  viewTypes[viewType][((node && node.type) ? node.type : viewType)][0], 
		jNode:     $('<div class="layer"><button class="addNodeBtn greenGradient">Add Node</button></div>')
	};

	var lCount = $('.layer').length + 1;
	layer.jNode.attr('data-layer', 'layer' + lCount);

	viewMode =  viewTypes[viewType][((node && node.type) ? node.type : viewType)][0];
	layer.jNode.appendTo($('#contentHolder'));
	this.renderLayer(layer, node);
//	if(layer.jNode.find('.node').length > 0) {
//		makeSelectable(layer.jNode);
//	}

	this.resizeLayer(layer.jNode);
	return layer.jNode;
}

Render.renderLayer = function(layer, node) {
	var firstChilds = [];
	var children    = [];
	var inout       = '';
	referenced      = {};

	if(node && node.id)
		children = Render.creator.getChildren(node.id);
	else
		children = Render.creator.getChildren();

	if(connectionTypes[viewMode].type == 'out')
		inout = 'cout';
	else
		inout = 'cin';

	firstChilds = Render.creator.getFirstChilds(children, inout, Render.creator.getChildren);
	this.renderNodes(firstChilds, children, layer);
}

Render.setActiveLayer = function(layer) {
	layer.nextAll().each(function() {
		// Remove jsPlumb endpoints and connectors when removing a layer
		var rLayer = $(this).attr('data-layer');
		$('._jsPlumb_endpoint[data-layer="' + rLayer + '"]').remove();
		$('._jsPlumb_connector[data-layer="' + rLayer + '"]').remove();
		$(this).remove();
	});
	$('.curLayer').removeClass('curLayer');
	layer.addClass('curLayer');
	$('.curNode').removeClass('curNode');
}

Render.resizeLayer = function(layer) {
	var maxHeight = 0;
	var maxWidth = 0;
	layer.find('.node').each(function() {
		if($(this).position().top > maxHeight)
			maxHeight = $(this).position().top;

		if(($(this).position().left + 300) > maxWidth)
			maxWidth = $(this).position().left;
	});

	maxHeight += 200;
	maxWidth  += 200;
	
	maxWidth = Math.max( ($(window).width() * 0.9), maxWidth );
	layer.height(maxHeight);
	layer.width(maxWidth);

	$('html,body').animate({ scrollTop: layer.offset().top }, { duration: 'slow', easing: 'linear'});
	$('.curLayer').removeClass('curLayer');
	layer.addClass('curLayer');
}


// render stuff based on events

mithril.io.on('gc.nodesAdded', function (path, params, nodes) {
	var parentId = $('.curNode').attr('data-id');
	var curLayer = $('.curLayer');

	console.log('nodes added , ', nodes);
	for (var i = 0, len = nodes.length; i < len; i += 1) {
		var node = nodes[i];

		window.app.creator.nodes.nodesMap[node.id] = node;
		window.app.creator.nodes.nodesArr.push(node);


		console.log('node ', node);
		if (node.cout && node.cout.parent && node.cout.parent.any) {
			if (node.cout.parent.any[0] === parentId) {
				Render.appendNode(node, null, null, curLayer);
			}
		}

/*
		if (node.cout.parent) {
			window.app.creator.nodeClick($('.node[data-id="' + content.cout.parent.any[0] + '"]'));
		} else if ($('.curNode').length == 1) {
			$('.curNode').click();
		} else {
			var parentNode = ($('.node[data-id="' + parentId + '"]').length > 0) ? $('.node[data-id="' + parentId + '"]') : null;
			Render.addLayer(parentNode, layer.jNode);
		}
*/



	}

	$('#dialogBox').dialog('close');
});
