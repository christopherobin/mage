//************************************************************************************************************//
//***********************************************************************************************************//

function Render() {
	this.referenceCheck = {};
	this.offsetX        = 0;
	this.offsetY        = 0;
	var creator         = window.creator;
	var mage            = window.mage;
	var _this           = this;

	this.init = function(newCreator, options) {
		this.offsetX = options.offsetX || 0;
		this.offsetY = options.offsetY || 0;

		// render stuff based on events

		mage.io.on('gc.nodesAdded', function (path, nodes) {
			var parentId = $('.curNode').attr('data-id');
			var curLayer = $('.curLayer');
			var layers   = $('.layer');
			var maxRight;

			function findRight(nodes) {
				var max = 0;

				nodes.each(function () {
					var right  = $(this).position().left + $(this).width();
					if (right > max) {
						max = right;
					}
				});

				return max;
			}

			for (var i = 0, len = nodes.length; i < len; i += 1) {
				var node = nodes[i];

				node.cout = node.cout || {};

				window.tool.gc.creator.nodes.nodesMap[node.id] = node;
				window.tool.gc.creator.nodes.nodesArr.push(node);


				maxRight = findRight(curLayer.find('.node'));


				var options = { left: maxRight + 30};

				if (layers.length === 1) {
					_this.appendNode(node, options, null, { jNode: curLayer });
				} else if(node.cout && node.cout.parent && node.cout.parent.any) {
					if (node.cout.parent.any[0] === parentId) {
						_this.appendNode(node, options, null, { jNode: curLayer });
					}
				}
			}

			_this.resizeLayer(curLayer);
			scroll(maxRight, curLayer.position().top);
			$('#dialogBox').dialog('close');
		});


		mage.io.on('gc.nodesEdited', function (path, nodes) {
			var nodesMap = window.tool.gc.creator.nodes.nodesMap;
			var nodesArr = window.tool.gc.creator.nodes.nodesArr;

			for (var i = 0, len = nodes.length; i < len; i += 1) {
				var node   = nodes[i];
				var jNode  = $('.node[data-id="' + node.id + '"]');


				// update caches
				nodesMap[node.id] = node;

				for (var j = 0, jlen = nodesArr.length; j < jlen; j += 1) {
					if (nodesArr[j].id === node.id) {
						nodesArr[j] = node;
					}
				}

				// update details
				var detail = creator.nodes.getNodeRepresentation(node);

				if (!detail || detail === '') {
					detail = node.type + ' (' + node.id + ')';
				}

				jNode.find('.nodeDesc').html(detail);


				// remove old connectors
				// No way to get all scopes, so I get all scopes with Object.keys
				var connectors = jsPlumb.getConnections({ scope: Object.keys(node.cout), source: jNode.attr('id') });
				// TODO: loop through cout (if connector doesn't exist, add it, if connector doesn't exist, remove it)
		//		for (var scope in

			}
		});


		mage.io.on('gc.nodesDeleted', function (path, nodes) {
			for (var i = 0, len = nodes.length; i < len; i += 1) {
				var id = nodes[i];
				deleteNodeFromLists(id);
				var ele = $('.node[data-id="' + id + '"]');

				jsPlumb.detachAll(ele);
				ele.remove();
				$('._jsPlumb_endpoint[data-id="' + id + '"]').remove();
			}

			_this.resizeLayer($('.curLayer'));
		});
	};


	function getEndpoint(type, inout, x, y) {
		var anchor = [];
		var style = {};

		if (creator.config.anchors[type] === 'horizontal') {
			if (inout === 'input') {
				anchor = [y - 0.025, x];
				style = jQuery.extend(true, {}, creator.graphHdlr.input[type]);
				style.endpoint[1].width  = creator.graphHdlr.input[type].endpoint[1].height;
				style.endpoint[1].height = creator.graphHdlr.input[type].endpoint[1].width;
			} else {
				anchor = [y + 0.03, x];
				style = jQuery.extend(true, {}, creator.graphHdlr.output[type]);
				style.endpoint[1].width  = creator.graphHdlr.output[type].endpoint[1].height;
				style.endpoint[1].height = creator.graphHdlr.output[type].endpoint[1].width;
			}
		} else {
			if (inout === 'input') {
				anchor = [x, y - 0.06];
				style = creator.graphHdlr.input[type];
			} else {
				anchor = [x, y + 0.07];
				style = creator.graphHdlr.output[type];
			}
		}

		return { anchor: anchor, style: style };
	}



	this.renderNodes = function(firstChilds, childList, layer) {
		var viewTypes  = creator.config.viewTypes;
		var offsetX    = this.offsetX;
		var offsetY    = this.offsetY;

		var fnChildren = creator.getNextRenderNodes[viewTypes[viewMode][((creator.curType) ? creator.curType : viewMode)][1]];

		for (var i = 0; i < firstChilds.length; i++) {
			var box;
			var check = {};
			box = this.renderNode(offsetX, offsetY, firstChilds[i], fnChildren, check, childList, layer);
			offsetX = box.right + 40;
		}

		for (var j = 0, jlen = childList.length; j < jlen; j++) {
			if ($('.node[data-id="' + childList[j].id + '"]').length === 0) {
				this.appendNode(childList[j], { top: offsetY, left: offsetX }, childList, layer);
				offsetX += nodeWidth + nodeMarginH;
			}
		}

		this.loadConnections(layer);
		jsPlumb.draggable(layer.jNode.find('.node'));
		this.renderLabels(layer.jNode);
		this.resizeLayer(layer.jNode);
	};

	this.renderNode = function(offsetX, offsetY, node, fnChildren, check, siblings, layer) {
		var tree = { left: offsetX, right: (offsetX + nodeWidth), top: offsetY, bottom: (offsetY + nodeHeight) };
		var renderDirec = creator.config.anchors[creator.config.traverseType[node.type]];		// anchors have horizontal/vertical rendering info
		var x = 0;
		var y = 0;
		var options = null;

		if (renderDirec === 'vertical') {
			x = tree.left;
		} else {
			x = tree.right + nodeMarginH;
		}

		if (renderDirec == 'vertical' && creator.config.connectionTypes[viewMode].type === 'out') {
			y = tree.bottom + nodeMarginV;
		} else {
			y = tree.top;
		}

		check[node.id] = true;
		var cons = fnChildren(node);
		if (cons) {
			for (var i = 0; i < cons.length; i++) {
				if (cons[i] && !check[cons[i].id]) {
					var result = this.renderNode(x, y, cons[i], fnChildren, check, siblings, layer);
					tree.right = result.right;

					if (creator.config.connectionTypes[viewMode].type === 'out') {
						tree.bottom = Math.max(tree.bottom, result.bottom);
					} else {
						tree.top = Math.max(tree.bottom, result.bottom) + nodeMarginV;		// for each child, pushes root node one more level down
						tree.bottom = tree.top + nodeHeight;
					}

					x = tree.right + nodeMarginH;
				}
			}
		}

		if (renderDirec === 'vertical') {
			options = {
				top: tree.top,
				left: Math.round(tree.left + ((tree.right - tree.left) / 2) - (nodeWidth / 2))
			};
		} else {
			options = {
				top: tree.top,
				left: tree.left
			};
		}

		if (node && !referenced[node.id]) {
			referenced[node.id] = true;
			this.appendNode(node, options, siblings, layer);
		}

		return tree;
	};

	this.renderLabels = function(layer) {
		layer.find('.eLabel').remove();
		var layerId = layer.attr('data-layer');
		var ref = {};
		$('canvas._jsPlumb_endpoint[data-inout="output"][data-layer="' + layerId + '"]').each(function() {
			var id    = $(this).attr('data-id');
			var state = $(this).attr('data-onstate');
			var type  = $(this).attr('data-cType');

			if (!ref[id + state]) {
				ref[id + state] = true;
				var node = $('.node[data-id="' + id + '"]');
				if (node.length > 0) {
					var nPos        = node.offset();
					var pos         = $(this).offset();
					var label       = $('<div class="eLabel">' + state + '</div>');

					label = label.appendTo(node);

					var margin  = pos.left - nPos.left;
					var lWidth  = label.width() / 2;
					var eWidth  = $(this).width() / 2;
					var lOffset = lWidth - eWidth;

					if (creator.config.anchors[type] === 'horizontal') {
						label.addClass('vertical');
					} else {
						label.css({ 'top': 55, 'margin-left': margin - lOffset, 'z-index': 10000 });
					}
				}
			}
		});
	};

	this.appendNode = function(node, options, siblings, layer) {
		var type = '';
		var html = $('#nodeGraphTemplate').clone().show();			// use templates and don't use show... it's slow as peanut butter
		$(html).attr('id', node.type + node.id);
		$(html).attr('data-id', node.id);
		$(html).attr('data-type', node.type);
		var handler = creator.nodes.types[node.type];
		var detail;

		if (handler) {
			$(html).find('.nodeType').html(node.type);
			detail = creator.nodes.getNodeRepresentation(node, { siblings: siblings});
			if (!detail || detail === '') {
				detail = node.type + ' (' + node.id + ')';
			}
		}else {
			detail = 'No handler found for node type : ' + node.type;
		}

		$(html).find('.nodeDesc').html(detail);

		var appendedNode = $(html).appendTo(layer.jNode);
		if (options && options.top) {
			appendedNode[0].style.top = parseInt(options.top, 10) + 'px';
		}

		if (options && options.left) {
			appendedNode[0].style.left = parseInt(options.left, 10) + 'px';
		}

		this.attachEndpoints(appendedNode, layer);
		toggleNodeBtns(appendedNode);
	};

	this.attachEndpoints = function(jNode, layer) {
		var id                = jNode.attr('data-id');
		var type              = jNode.attr('data-type');
		var name              = type + id;
		var nDef              = creator.nodes.types[type];
		var visibleConnectors = creator.config.definedViews[creator.viewType].connectors;

		// adds endpoints if the node data has any defined
		// loop through for all visible connector types

		if (creator.nodes.nodesMap[id]) {
			for (var conn in visibleConnectors) {
				var connector = visibleConnectors[conn];
				if (creator.nodes.nodesMap[id].cout && creator.nodes.nodesMap[id].cout[connector]) {
					var outs = creator.nodes.nodesMap[id].cout[connector];
					for (var outState in outs) {
						this.addEndpoint(jNode, 'output', outState, layer, connector);
					}
				}

				if (creator.nodes.nodesMap[id].input && creator.nodes.nodesMap[id].input[connector]) {
					var inputs = creator.nodes.nodesMap[id].input[connector];
					for (var i = 0; i < inputs.length; i++) {
						this.addEndpoint(jNode, 'input', '', layer, connector);
					}
				}

				// add default output endpoints based on nodeDefinition
				if (nDef.output && nDef.output[connector] && nDef.output[connector].states) {
					var states = nDef.output[connector].states;
					for (var state in states) {
						if (state != 'custom') {								// custom is a reserved state
							this.addEndpoint(jNode, 'output', state, layer, connector);
						}
					}
				}

				// if connection type is output, add input if input is defined in the node definition
				if (creator.config.connectionTypes[connector].type == 'out') {
					if (nDef.input[connector]) {
						this.addEndpoint(jNode, 'input', '', layer, connector);
					}
				} else {
					if (nDef.input && nDef.input[viewMode]) {
						this.addEndpoint(jNode, 'input');
					}
				}
			}
		}
	};

	this.addEndpoint = function (jNode, inout, state, layer, cType) {
		var id         = jNode.attr('data-id');
		var type       = jNode.attr('data-type');
		var name       = type + id;
		var node       = creator.nodes.nodesMap[id];
		var anchor     = null;
		var endpoint   = null;
		var nodeDef    = {};
		var styles     = null;
		var uuid       = null;
		var epOptions  = null;
		var epAttribs  = null;
		var epCanvas   = null;
		var space      = 0;
		var distance   = 0;
		var outputs    = null;

		var maxConnections = 1;

		if (node && creator.nodes.types[type][inout] && creator.nodes.types[type][inout][cType]) {
			nodeDef = creator.nodes.types[type][inout][cType];
		} else {
			nodeDef.accepts = 1;
		}

		if (creator.config.connectionTypes[cType].type == 'out') {		// out connection
			if (inout == 'input') {		// input endpoint
				endpoint   = getEndpoint(cType, 'input', 0.5, 0);
				anchor     = endpoint.anchor;
				styles = endpoint.style;

				uuid      = name + 'input' + cType;
				epOptions = { uuid: uuid, anchor: anchor, maxConnections: nodeDef.accepts };
				epAttribs = {
					'id'         : uuid,
					'data-inout' : 'input',
					'data-cType' : cType,
					'data-id'    : id,
					'data-type'  : type,
					'data-layer' : layer.jNode.attr('data-layer')
				};

				epCanvas = jsPlumb.addEndpoint(jNode.attr('id'), epOptions, styles).canvas;
				$(epCanvas).attr(epAttribs);

			} else {				// output endpoint
				if (!state)
					state = 'any';

				if ($('canvas[data-inout="' + inout + '"][data-cType="' + cType + '"][data-id="' + id + '"][data-type="' + type + '"][data-onState="' + state + '"]').length === 0) {

					outputs = $('canvas._jsPlumb_endpoint[data-inout="' + inout + '"][data-cType="' + cType + '"][data-id="' + id + '"][data-type="' + type + '"]');

					if (outputs.length > 0) {
						distance = 1 / (outputs.length + 2);
					} else {
						space = 0.5;
					}

					outputs.each(function () {
						space += distance;
						var eId = $(this).attr('id');
						var source = jsPlumb.getEndpoint(eId);
						source.anchor.x = space;
					});

					space += distance;
					if (nodeDef && nodeDef.states && nodeDef.states[state]) {
						maxConnections = nodeDef.states[state].count[1];
					} else if (nodeDef && nodeDef.states && nodeDef.states.custom) {
						maxConnections = nodeDef.states.custom.count[1];
					}

					endpoint   = getEndpoint(cType, 'output', space, 1);
					anchor     = endpoint.anchor;
					styles = endpoint.style;

					uuid      = name + 'output' + cType + state;
					epOptions = { uuid: uuid, anchor: anchor, maxConnections: maxConnections };
					epAttribs = {
						'id'           : uuid,
						'data-inout'   : 'output',
						'data-cType'   : cType,
						'data-id'      : id,
						'data-type'    : type,
						'data-onState' : state,
						'data-layer'   : layer.jNode.attr('data-layer')
					};

					epCanvas = jsPlumb.addEndpoint(jNode.attr('id'), epOptions, styles).canvas;
					$(epCanvas).attr(epAttribs);
				}
			}
		} else {			// in connection
			if (inout == 'input') {		// input endpoint
				var inputs = $('canvas[data-inout="input"][data-cType="' + cType + '"][data-id="' + id + '"][data-type="' + type + '"]');
				var count = inputs.length;

				if (count) {
					distance = 1 / (count + 2);
				} else {
					space = 0.5;
				}

				var lCount = 0;
				inputs.each(function() {
					space += distance;
					var source = jsPlumb.getEndpoint(name + inout + cType + lCount);
					source.anchor.x = space;
					lCount++;
				});

				space += distance;

				endpoint   = getEndpoint(cType, 'input', space, 0);
				anchor     = endpoint.anchor;
				styles     = endpoint.style;
				uuid       = name + 'input' + cType + count;

				jNode.addEndpoint(jsPlumb.extend({ uuid: uuid, anchor: anchor, maxConnections: nodeDef.accepts }, styles));
				$('#' + uuid).attr({'data-inout': 'input', 'data-count': count, 'data-cType': cType, 'data-id': id, 'data-type': type, 'data-layer': layer.jNode.attr('data-layer') });
	//			jsPlumb.repaintEverything();
			} else {			// output endpoint
				if (!state) {
					state = 'any';
				}

				outputs = (creator.nodes.nodesMap[id] && creator.nodes.nodesMap[id].cout && creator.nodes.nodesMap[id].cout[cType]) ? creator.nodes.nodesMap[id].cout[cType].length : 0;

				if (outputs) {
					space = 1 / (outputs + 2);
				} else {
					space = 0.5;
				}

				if (nodeDef && nodeDef.states && nodeDef.states[state]) {
					maxConnections = nodeDef.states[state].count[1];
				}

				endpoint   = getEndpoint(cType, 'output', space, 1);
				anchor     = endpoint.anchor;
				styles     = endpoint.style;
				uuid       = name + 'output' + cType + state;

				jNode.addEndpoint(jsPlumb.extend({ uuid: uuid, anchor: [space, 1], maxConnections: maxConnections }, styles));
				$('#' + uuid).attr({'data-inout': 'output', 'data-cType': cType, 'data-id': id, 'data-type': type, 'data-onState': state, 'data-layer': layer.jNode.attr('data-layer') });
			}
		}

		this.renderLabels(layer.jNode);
	};

	this.loadConnections = function (layer) {
		viewMode         = layer.viewMode;
		var visibleConnectors = creator.config.definedViews[creator.viewType].connectors;
	//	var _makeOverlay = function() { return new jsPlumb.Overlays.Arrow({foldback:0.7, fillStyle:'gray', location:0.5, width:14}); };
		var _makeOverlay = function() { return ['Arrow', { foldback:0.7, fillStyle:'gray', location:0.5, width:14 } ]; };
		var cons = null;

		layer.jNode.find('.node').each(function() {
			if ($(this).is(':visible')) {
				var id = $(this).attr('data-id');
				var type = $(this).attr('data-type');
				var name = type + id;

				if (creator.nodes.nodesMap[id]) {
					for (var conn in visibleConnectors) {
						var connector = visibleConnectors[conn];
						if (creator.nodes.nodesMap[id].input && creator.nodes.nodesMap[id].input[connector]) {
							cons = creator.nodes.nodesMap[id].input[connector];
							createInConnections(cons, id, type, name, connector);
						}

						if (creator.nodes.nodesMap[id].cout && creator.nodes.nodesMap[id].cout[connector]) {
							cons = creator.nodes.nodesMap[id].cout[connector];

							for (var state in cons) {
								createOutConnections(state, cons[state], id, type, name, connector);
							}
						}
					}
				}
			}
		});

		function createInConnections(cons, id, type, name, cType) {
			for (var j = 0; j < cons.length; j++) {
				for (var l = 0; l < cons[j].length; l++) {
					var conId = cons[j][l].node;
					if (creator.nodes.nodesMap[conId]) {
						var nType = (cons[j][l].onState) ? cons[j][l].onState : '';
						var conName = creator.nodes.nodesMap[conId].type + creator.nodes.nodesMap[conId].id;
						var source = jsPlumb.getEndpoint(name + 'input' + cType + j);
						var target = jsPlumb.getEndpoint(conName + 'output' + cType);
						var state = cons[j][l].onState;

						if (!target) {
							this.addEndpoint($('#' + conName), 'output', state, layer, cType);
							target = jsPlumb.getEndpoint(conName + 'output' + cType + state);
						}

						if ($('#' + conName).length > 0 && !source.isFull() && !target.isFull()) {
							creator.renderFlag = true;
							var test = jsPlumb.connect({ uuids: [ name + 'input' + cType + j, conName + 'output' + cType + state ], overlays:[_makeOverlay()] });
							var cId = $(test.canvas).attr('id');
							$('#' + cId).attr('data-type', type);
							$('#' + cId).attr('data-cType', cType);
							$('#' + cId).attr('data-layer', layer.jNode.attr('data-layer'));
							creator.renderFlag = false;
						}
					}
				}
			}
		}

		function createOutConnections(nType, cons, id, type, name, cType) {
			for (var i = 0, len = cons.length; i < len; i++) {

				var conId = cons[i];
				if (creator.nodes.nodesMap[conId]) {
					var conName = creator.nodes.nodesMap[conId].type + conId;
					var sourceId = name + 'output' + cType + nType;
					var targetId = conName + 'input' + cType;
					var source = jsPlumb.getEndpoint(sourceId);
					var target = jsPlumb.getEndpoint(targetId);

					if (!target) {
						this.addEndpoint($('#' + conName), 'input', '', layer, cType);
						target = jsPlumb.getEndpoint(targetId);
					}

					if ($('#' + conName).length > 0 && !source.isFull() && !target.isFull()) {
						creator.renderFlag = true;
						var test  = jsPlumb.connect({ uuids: [sourceId, targetId], overlays:[_makeOverlay()] });
						$(test.canvas).attr('data-source', name);
						$(test.canvas).attr('data-target', conName);
						$(test.canvas).attr('data-type', type);
						$(test.canvas).attr('data-cType', cType);
						$(test.canvas).attr('data-sourceNode', id);
						$(test.canvas).attr('data-targetNode', conId);
						$(test.canvas).attr('data-layer', layer.jNode.attr('data-layer'));
						creator.renderFlag = false;
					}
				}
			}
		}
	};

	this.addLayer = function(node, curLayer) {
		var viewTypes = creator.config.viewTypes;
		if (curLayer) {
			curLayer.nextAll().each(function() {
				// Remove jsPlumb endpoints and connectors when removing a layer
				var rLayer = $(this).attr('data-layer');
				$('._jsPlumb_endpoint[data-layer="' + rLayer + '"]').remove();
				$('._jsPlumb_connector[data-layer="' + rLayer + '"]').remove();
				$(this).remove();
			});
		}

		if (!node) {
			$('.layer').each(function() {
				// Remove jsPlumb endpoints and connectors when removing a layer
				var rLayer = $(this).attr('data-layer');
				$('._jsPlumb_endpoint[data-layer="' + rLayer + '"]').remove();
				$('._jsPlumb_connector[data-layer="' + rLayer + '"]').remove();
				$(this).remove();
			});
		}

		$('.addNodeBtn').remove();
		viewMode = viewTypes[creator.viewType][((node && node.type) ? node.type : creator.viewType)][0];

		var layer = {
			viewMode:  viewMode,
			jNode:     $('<div class="layer"><button class="addNodeBtn greenGradient">Add Node</button></div>')
		};

		var lCount = $('.layer').length + 1;
		layer.jNode.attr('data-layer', 'layer' + lCount);

		layer.jNode.appendTo($('#contentHolder'));
		this.renderLayer(layer, node);
	//	if(layer.jNode.find('.node').length > 0) {
	//		makeSelectable(layer.jNode);
	//	}

		this.resizeLayer(layer.jNode);
		return layer.jNode;
	};

	this.renderLayer = function(layer, node) {
		var firstChilds = [];
		var children    = [];
		var inout       = '';
		referenced      = {};

		if (node && node.id) {
			children = creator.getChildren(node.id);
		} else {
			children = creator.getChildren();
		}

		if (creator.config.connectionTypes[viewMode].type == 'out') {
			inout = 'cout';
		} else {
			inout = 'cin';
		}

		firstChilds = creator.getFirstChilds(children, inout, creator.getChildren);
		this.renderNodes(firstChilds, children, layer);
	};

	this.setActiveLayer = function(layer) {
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
	};

	this.resizeLayer = function(layer) {
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
	};
}
