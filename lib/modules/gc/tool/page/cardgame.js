//**********************************************************************************************************//
//  File: cardgame.js
//  Date: 2011/07/07
//  Description: Game specific module file
//
//  Example: var creator = Object.create(Cardgame);
//
//*********************************************************************************************************//

function Cardgame() {
    Game.call(this);
	var _this     = this;


	this.backgrounds = {
		"underground": { "place": "underground" },
		"cave_1": { "place": "underground" },
		"cave_2": { "place": "underground" },
		"cave_entrance": { "place": "underground" },
		"cave_hall": { "place": "underground" },
		"lava_sea": { "place": "underground" },
		"ruins": { "place": "underground" },
		"underground_chest": { "place": "underground" },
		"faeria": { "place": "faeria" },
		"elf_castle": { "place": "faeria" },
		"faeria_chest": { "place": "faeria" },
		"forest_1": { "place": "faeria" },
		"forest_2": { "place": "faeria" },
		"forest_deep": { "place": "faeria" },
		"forest_village": { "place": "faeria" },
		"large_tree": { "place": "faeria" },
		"magika": { "place": "magika" },
		"floor1": { "place": "magika" },
		"floor2": { "place": "magika" },
		"floor3": { "place": "magika" },
		"floor4": { "place": "magika" },
		"floor5": { "place": "magika" },
		"floor6": { "place": "magika" },
		"portal": { "place": "magika" },
		"tower": { "place": "magika" },
		"underworld": { "place": "underworld" },
		"dead_forest": { "place": "underworld" },
		"fog_town": { "place": "underworld" },
		"ghostship": { "place": "underworld" },
		"ghostship_inside": { "place": "underworld" },
		"grave_mansion": { "place": "underworld" },
		"mansion_inside": { "place": "underworld" },
		"moon_lake": { "place": "underworld" },
		"underworld_chest": { "place": "underworld" },
		"hell": { "place": "hell" },
		"blood_ocean": { "place": "hell" },
		"blood_river": { "place": "hell" },
		"hell_gate": { "place": "hell" },
		"hell_road": { "place": "hell" },
		"mirror": { "place": "hell" },
		"abyss": { "place": "abyss" },
		"abyss_chest": { "place": "abyss" },
		"island": { "place": "abyss" },
		"ocean": { "place": "abyss" },
		"storm": { "place": "abyss" },
		"storm_2": { "place": "abyss" },
		"underwater": { "place": "abyss" },
		"underwater_deep": { "place": "abyss" },
		"sky": { "place": "sky" },
		"angel_fall": { "place": "sky" },
		"sky_castle": { "place": "sky" },
		"sky_mountain": { "place": "sky" },
		"sky_port": { "place": "sky" },
		"kingdom": { "place": "kingdom" },
		"castle": { "place": "kingdom" },
		"castle_gates": { "place": "kingdom" },
		"desert": { "place": "kingdom" },
		"field": { "place": "kingdom" },
		"kingdom_chest": { "place": "kingdom" },
		"mountain": { "place": "kingdom" },
		"oasis": { "place": "kingdom" },
		"study": { "place": "kingdom" },
		"tavern": { "place": "kingdom" },
		"temple": { "place": "kingdom" },
		"village": { "place": "kingdom" },
		"heaven": { "place": "heaven" },
		"heaven_gate": { "place": "heaven" },
		"heaven_stairs": { "place": "heaven" },
		"holy_mountain": { "place": "heaven" },
		"holy_temple": { "place": "heaven" },
		"truth_room": { "place": "heaven" },
		"tarot": { "place": "tarot" },
		"boss": { "place": "boss" },
		"pvp": { "place": "pvp" },
		"black": { "place": "black" }
	};


    var checkSelection = function() {
        var errors = [];
        for(var id in pasteBuffer.buffer) {
            if(pasteBuffer.type == 'cut')
                $('.node[data-id="' + id + '"]').addClass('cutNode');

            // check to see if any connectors, alert if there are connectors besides parent
            // possibly just disconnect these for the user?
            if(this.nodes.nodesMap[id]) {
                if(this.nodes.nodesMap[id].cout) {
                    for(var out in this.nodes.nodesMap[id].cout) {
                        if(out != 'parent') {
                            var outs = this.nodes.nodesMap[id].cout[out];
                            var length = outs.length;
                            for(var i = 0; i < length; i++) {
                                if(!pasteBuffer.buffer[outs[i].node]) {
                                    errors.push({ errorType: 'errors', nodeId: id, nodeType: this.nodes.nodesMap[id].type, msg: ' remaining output connectors : ' + out + ' .' });
                                }
                            }
                        }
                    }
                }

				/* paste ins (not checked)
                if(this.nodes.nodesMap[id].input && !pasteBuffer.buffer[this.nodes.nodesMap[id].cout[out].node]) {
                    for(var ins in this.nodes.nodesMap[id].input) {
                        var inputs = this.nodes.nodesMap[id].input[ins];
                        var length = inputs.length;
                        for(var i = 0; i < length; i++) {
                            if(!pasteBuffer.buffer[ins[i].node]) {
                                errors.push({ errorType: 'errors', nodeId: id, nodeType: this.nodes.nodesMap[id].type, msg: ' remaining input connectors.' });
                            }
                        }
                    }
                }
                */
            }
        }

        return errors;
    };

	this.setup = function () {
		// TODO: check if these things have been declared yet

		jsPlumb.setRenderMode(jsPlumb.SVG);
		jsPlumb.Defaults.Endpoint = ['Rectangle'];

		for (var types in this.nodes.types) {
			var handler = this.nodes.types[types];
            $('#viewButtons').append('<button class="viewType" data-id="' + types + '">' + types + '</button>');
			if (handler.uiHandlers) {
				handler.uiHandlers();
			}
		}

		this.obj = {};
		var classes = window.mithril.obj.getClassesByName();
		for (var i = 0, len = classes.length; i < len; i++) {
			var objClass = classes[i];
			var info     = objClass.name.split(':');
			var type     = info[0];
			var name     = info[1];

			if (!this.obj[type]) {
				this.obj[type] = [];
			}

			this.obj[type].push(objClass);
		}


		this.setupReplacements();

		_this.renderer.init(this, {});
		_this.renderer.addLayer();


		setupUiHandlers();
	};


	this.setupReplacements = function () {		// setup replacements for dynamic stuff
		var selectStart  = '<select class="dataValue">';
		var selectEnd    = '</select>';


		// select spirit
		var spirits = '';
		var cards = this.obj.card;
		for (var i = 0, len = cards.length; i < len; i++) {
			var spirit = cards[i].name.split(':')[1];
			spirits += '<option value="' + spirit + '">' + spirit + '</option>';
		}

		$('.viewToolCreator .nodeData[data-replacement="spirit"]').append(selectStart + spirits + selectEnd);
		$('.viewToolCreator .nodeData[data-replacement="bonusSpirits"]').append(selectStart + '<option></option>' + spirits + selectEnd);

		var opponents = '<div class="opponent" style="display: none;"><select class="dataValue" data-id="spirit">' + spirits + '</select>';
		opponents += ' Lvl <input type="number" class="dataValue" data-id="level" /></div>';

		$('.viewToolCreator .nodeData[data-replacement="opponents"]').append(opponents);


		// select background
		var assets = window.mithril.assets.getAll();

		for (var j = 0, jlen = assets.length; j < jlen; j++) {
			var asset  = assets[j];
			var regex  = /^world\/(.*)/g;

			var match    = regex.exec(asset.fullIdent);

			if (match) {
				if (!this.backgrounds[match[1]]) {
					console.warn("background found in asset map that isn't in backgrounds list : ", match[1]);
				} else {
					this.backgrounds[match[1]].mui = match[0];
				}
			}
		}



		var backgrounds = '<option></option>';
		for (var background in this.backgrounds) {
			backgrounds += '<option value="' + background + '">' + background + '</option>';

			var subbgs = this.backgrounds[background];
			for (var k = 0, klen = subbgs.length; k < klen; k++) {
				backgrounds += '<option value="' + subbgs[k] + '"> -- ' + subbgs[k] + '</option>';
			}
		}

		$('.viewToolCreator .nodeData[data-replacement="background"]').append(selectStart + backgrounds + selectEnd);
		$('.nodeData[data-replacement="background"] select').live('change', function (e) {
			$('#dialogBox img.backgroundPreview').remove();
			var background = $(this).find('option:selected').val();
			var src = this.backgrounds[background].mui;
			$('#dialogBox').append('<img class="backgroundPreview" src="' + src + '" />');

		});


		var nodeTypes = window.tool.gc.creator.nodes.types;

		for (var type in nodeTypes) {
			if (nodeTypes[type].setup) {
				nodeTypes[type].setup();
			}
		}
	};


    this.keydownHandler = function(event) {
		var errors = null;
        // delete
        if(event.which == 46) {
            $('#deleteDialog').attr('data-type', 'keyboard').dialog('open');
        }

        // copy
        if(event.which == 67 && (event.ctrlKey || event.metaKey) ) {
            pasteBuffer.buffer = {};
            pasteBuffer.type   = 'copy';
            $('.ui-selected').each(function() {
                pasteBuffer.buffer[$(this).attr('data-id')] = true;
            });

            console.log('copy -- ', pasteBuffer.buffer);

            errors = checkSelection();

            if(errors.length > 0) {
                showErrors(errors, 'window');
            }

            event.preventDefault();
            return false;
        }

        // cut
        if(event.which == 88 && (event.ctrlKey || event.metaKey) ) {
            pasteBuffer.buffer = {};
            pasteBuffer.type   = 'cut';
            $('.ui-selected').each(function() {
                pasteBuffer.buffer[$(this).attr('data-id')] = true;
            });

            //console.log('cut -- ', pasteBuffer.buffer);
            $('.cutNode').removeClass('cutNode');

            errors = checkSelection();

            if(errors.length > 0) {
                showErrors(errors, 'window');
                $('.cutNode').removeClass('cutNode');
            }

            event.preventDefault();
            return false;
        }

        // paste
        if(event.which == 86 && (event.ctrlKey || event.metaKey) ) {

            switch(pasteBuffer.type) {
                case 'copy':
                    $('#pasteDialog').dialog('open');
                    break;

                case 'cut':
                    this.pasteCutNodes();
                    break;

                case 'delete':
                    break;

                default:
                    break;
            }


            event.preventDefault();
            return false;
        }
    };

    this.pasteCopyNodes = function(type) {
        var newTarget = $('.curNode').attr('data-id');
        var action = 'copyNodes';
        var success;
        var nodes;

        nodes         = {};
		var oldTops   = [];


		function assignNodes(nodeId){
			if (this.nodes.nodesMap[nodeId]) {
				nodes[nodeId] = this.nodes.nodesMap[nodeId];
			}
		}


        for(var node in pasteBuffer.buffer) {
            var tempNode = jQuery.extend(true, {}, this.nodes.nodesMap[node]);
            if(!tempNode.cout) tempNode.cout = {};
            if(!newTarget)
                delete tempNode.cout.parent;
            else {
                tempNode.cout.parent = [{ node: newTarget, onState: 'any' }];
            }

            nodes[tempNode.id] = tempNode;
			oldTops.push(tempNode.id);
            if(type === 'allChilds') {
                this.getDescendents(node, [], {}).forEach(assignNodes);
            }
        }

        success = function(data) {
            if(data.status === 'OK') {
                var length = data.nodes.length;
                //console.log(data);
                for(var i = 0; i < length; i++) {
                    var dNode = data.nodes[i];
                    this.nodes.nodesMap[dNode.id] = dNode;
					_this.nodes.nodesArr.push(dNode);
					dNode.id = dNode.id.toString();

					if (oldTops.indexOf(dNode.oldId) !== -1) {
						if(!newTarget)
							delete dNode.cout.parent;
						else {
							// not sure about onState here
							console.log('add new parent for : ', dNode.id);
							dNode.cout.parent = [{ node: newTarget, onState: 'any' }];

							console.log('new : ', dNode, '   old : ', this.nodes.nodesMap[dNode.oldId]);
						}
					}
                }

                $('#pasteDialog').dialog('close');
                $('.curNode').trigger('click');
            }
        };

        var options = {
            data: { action: action, nodes: nodes, newTarget: newTarget },
            success: success
        };

        ajaxCall(options);
    };

    this.pasteCutNodes = function() {
        var newTarget = $('.curNode').attr('data-id');
        var action = 'changeParent';
        var success;
        var nodes   = pasteBuffer.buffer;
        success = function(data) {
            if(data.status === 'OK') {
                for(var node in pasteBuffer.buffer) {
                    if(this.nodes.nodesMap[node]) {
                        if(!newTarget) {
                            delete this.nodes.nodesMap[node].cout.parent;
                        } else {
                            if(!this.nodes.nodesMap[node].cout)        this.nodes.nodesMap[node].cout = {};
                            this.nodes.nodesMap[node].cout.parent = [{ node: newTarget, onState: 'any' }];
                        }
                    }
                }

                $('.curNode').trigger('click');
            }
        };

        var options = {
            data: { action: action, nodes: nodes, newTarget: newTarget },
            success: success
        };

        ajaxCall(options);
    };

    this.nodeClick = function(jNode, ancestors) {
        var childNodes = this.getChildTypes(jNode.attr('data-type'));

        if(childNodes.length !== 0) {
            var id       = jNode.attr('data-id');
            var curLayer = jNode.parents('.layer');
            $('.curNode').removeClass('curNode');
            var newLayer = _this.renderer.addLayer(this.nodes.nodesMap[id], curLayer);
            newLayer.attr('data-selected-id', id);
            jNode.addClass('curNode');

            if (ancestors && ancestors.length > 0) {
                this.nodeClick($('.node[data-id="' + ancestors.pop().id + '"]'), ancestors);
            }
        }
    };

    this.addNode = function(type) {
        loadDialog('add', type, 'Add ' + type);
    };

    this.editNode = function(jNode) {
        var type  = jNode.parents('.node').attr('data-type');
        var id    = jNode.parents('.node').attr('data-id');
        var title = 'Edit ' + type;
        loadDialog('edit', type, title, id);
    };

    this.deleteNodes = function(node, type) {
        var children = [];
        if(node) {  // deleting single node
            children = this.getChildren(node.id);
            if(children.length > 0) {
                $('#deleteDialog').attr('data-id', node.id).dialog('open');
            } else {
                deleteNodes(node);
            }
        } else {  // deleting multiple selected nodes
            $('#deleteDialog').dialog('open');
        }
    };

    this.gotoError = function(jNode) {
        var id = jNode.attr('data-id');
        var ancestors = this.getAncestors(id, []);

        if (ancestors.length > 0) {
            this.nodeClick($('.node[data-id="' + ancestors.pop().id + '"]'), ancestors);
        } else {
            $('#toolTop').click();
        }

        $('.node.targetNode').removeClass('targetNode');
        $('.node[data-id="' + id + '"]').addClass('targetNode');
    };

    this.addInput = function(jNode) {
        var node = jNode.parents('.node');
        _this.renderer.addEndpoint(node, 'input');
    };

    this.addOutput = function(jNode) {
        var node  = jNode.parents('.node');
        var id    = node.attr('data-id');
        var type  = node.attr('data-type');
        var cType = $('canvas._jsPlumb_endpoint[data-id="' + id + '"][data-inout="output"]').attr('data-cType') || 'trigger';
        var nodeDef = _this.nodes.types[type].output[cType];

        if(nodeDef && nodeDef.states && (Object.keys(nodeDef.states).length == 1) && !nodeDef.states.custom) {  // check this in addEndpoint already, don't need it here, remove when ready
            _this.renderer.addEndpoint(node, 'output');
        }else if(nodeDef && nodeDef.states)
            loadDialogE(node, 'output', nodeDef, cType);
    };

    this.getChildTypes = function(type) {
        if(!type)
            type = null;
        var children = [];
        for(var node in _this.nodes.types) {
            if(_this.nodes.types[node].output.parent) {
                var types = _this.nodes.types[node].output.parent.types;
                for(var i = 0; i < types.length; i++) {
                    if(types[i] == type) {
                        children.push(node);
                        break;
                    }
                }
            }else {
                if(type === null) {
                    children.push(node);
                }
            }
        }
        return children;
    };

    this.getAvailableTypes = function(type) {
        var availableTypes = [];
        for(var node in _this.nodes.types) {
            if(_this.nodes.types[node].output.parent && _this.nodes.types[node].output.parent.types) {
                var types = _this.nodes.types[node].output.parent.types;
                for(var nType in types) {
                    if(types[nType] == type) {
                        availableTypes.push(node);
                        break;
                    }
                }
            }
        }
        return availableTypes;
    };

    this.getParentTypes = function(type) {
        var parents = [null];
        if(_this.nodes.types[type] && _this.nodes.types[type].output.parent && _this.nodes.types[type].output.parent.types)
            parents = _this.nodes.types[type].output.parent.types;
        return parents;
    };

    this.getSiblingTypes = function(type) {
        var parents = this.getParentTypes(type);
        var siblings = [];
        for(var node in _this.nodes.types) {
            var nodeParents = this.getParentTypes(node);
            for(var i = 0; i < nodeParents.length; i++) {
                for(var j = 0; j < parents.length; j++) {
                    if(nodeParents[i] == parents[j]) {
                        siblings.push(node);
                        break;
                    }
                }
            }
        }

        return siblings.removeDupes();
    };

    this.getChildren = function(id) {
        var children = [];

        for (var j = 0, jlen = _this.nodes.nodesArr.length; j < jlen; j++) {
            var node = _this.nodes.nodesArr[j];

            if(id) {
                var tNodes = node.cout.parent;

                if(tNodes) {
					for (var state in tNodes) {
						var toNodes = tNodes[state];
						for(var i = 0, len = toNodes.length; i < len; i++) {
							if(toNodes[i] == id) {
								children.push(node);
								break;
							}
						}
					}
                }
            }else {
                if(!node.cout.parent) {
                    children.push(node);
                }
            }
        }
        return children;
    };

    this.getDescendents = function(id, descendents, rCheck) {
        for (var j = 0, len = _this.nodes.nodesArr.length; j < len; j++) {
            var node = _this.nodes.nodesArr[j];
            if(node.cout.parent) {
                var tNodes = node.cout.parent;        // should only ever be one parent for a node, but just in case
				for (var state in tNodes) {
					var toNodes = tNodes[state];
					for(var i = 0, ilen = toNodes.length; i < ilen; i++) {
						if(toNodes[i].node == id && !rCheck[node.id]) {
							rCheck[node.id] = true;
							descendents.push(node.id);
							this.getDescendents(node.id, descendents, rCheck);
							break;
						}
					}
				}
            }
        }
        return descendents;
    };

    this.getOuts = function(node) {
        var renderOuts = ['display', 'trigger'];
        var outs = [];

        if (node) {
            for (var out in node.cout) {
                if (renderOuts.indexOf(out) !== -1) {
                    var outList = node.cout[out];

                    if (outList) {
						for (var state in outList) {
							var outNodes = outList[state];

							for (var i = 0, len = outNodes.length; i < len; i++) {
								outs.push(_this.nodes.nodesMap[outNodes[i]]);
							}
						}
                    }
                }
            }
        }
        return outs;
    };

    this.getIns = function(node) {

    };

    this.getSiblings = function(id) {
        var siblings = [];
        if(this.nodes.nodesMap[id] && this.nodes.nodesMap[id].cout.parent) {
            var par = this.nodes.nodesMap[id].cout.parent[0].node;
            for (var i = 0, len = _this.nodes.nodesArr.length; i < len; i++) {
                if(_this.nodes.nodesArr[i].cout.parent && _this.nodes.nodesArr[i].cout.parent[0].node == par) {
                    siblings.push(_this.nodes.nodesArr[i]);
                }
            }
        }
        return siblings;
    };

	// Get all previous nodes in the same branch, still not reversed
    this.getPrevSiblings = function(id, siblings, refCheck, sibList, errors) {
		var viewTypes = app.creator.config.viewTypes;
        var cViewMode = viewTypes[app.creator.viewType][((this.nodes.nodesMap[id] && this.nodes.nodesMap[id].type) ? this.nodes.nodesMap[id].type : app.creator.viewType)][1];
        if (!sibList)
            sibList = _this.nodes.nodesArr;

        checkSib:
        for(var i = 0, len = sibList.length; i < len; i++) {
            if(!refCheck[sibList[i].id]) {
                if(sibList[i].cout && sibList[i].cout[cViewMode]) {
                    var targets = sibList[i].cout[cViewMode];
                    for(var j = 0, jlen = targets.length; j < jlen; j++) {
                        if(targets[j].node == id) {
                            refCheck[sibList[i].id] = true;
                            siblings.push(sibList[i]);
                            this.getPrevSiblings(sibList[i].id, siblings, refCheck, sibList, errors);
                            break checkSib;
                        }
                    }
                }
            } else if (errors) {
                errors.push({
                    errorType: 'errors',
                    msg:       sibList[i].type + ' ' + sibList[i].id + ' has already been referenced in this branch. Loop detected in prevSibs',
                    nodeType:  sibList[i].type,
                    nodeId:    sibList[i].id
                });
            }
        }
        return siblings;
    };

    this.getNextSiblings = function(id, siblings, refCheck, errors) {
		var viewTypes = app.creator.config.viewTypes;
        var cViewMode = viewTypes[app.creator.viewType][((this.nodes.nodesMap[id] && this.nodes.nodesMap[id].type) ? this.nodes.nodesMap[id].type : app.creator.viewType)][1];
        if (!refCheck[id]) {
            if (this.nodes.nodesMap[id] && this.nodes.nodesMap[id].cout && this.nodes.nodesMap[id].cout[cViewMode]) {
                refCheck[id] = true;
                var targets = this.nodes.nodesMap[id].cout[cViewMode];
                var tlen    = targets.length;
                for (var i = 0; i < tlen; i++) {
                    siblings.push(this.nodes.nodesMap[targets[i].node]);
                }

                for (var j = 0; j < tlen; j++) {
                    this.getNextSiblings(targets[j].node, siblings, refCheck, errors);
                }
            }
        } else if (errors && this.nodes.nodesMap[id]) {
            errors.push({
                errorType: 'errors',
                msg:       this.nodes.nodesMap[id].type + ' ' + this.nodes.nodesMap[id].id + ' has already been referenced in this branch. Loop detected in nextSibs',
                nodeType:  this.nodes.nodesMap[id].type,
                nodeId:    this.nodes.nodesMap[id].id
            });
        }
        return siblings;
    };

    this.getAncestors = function(id, ancestors) {
        if(this.nodes.nodesMap[id] && this.nodes.nodesMap[id].cout && this.nodes.nodesMap[id].cout.parent) {
            var parent = this.nodes.nodesMap[id].cout.parent[0].node;
            if(this.nodes.nodesMap[parent]) {
                ancestors.push(this.nodes.nodesMap[parent]);
                this.getAncestors(parent, ancestors);
            }
        }
        return ancestors;
    };

    this.getFirstChilds = function(childList, inout, fnChildren, vMode) {
        var cList = {};
        var cViewMode = viewMode;
        for(var i = 0; i < childList.length; i++) {
            cList[childList[i].id] = true;
        }

        if(vMode)
            cViewMode = vMode;

        for(var child in cList) {
            if(this.nodes.nodesMap[child] && this.nodes.nodesMap[child][inout]) {
                var couts = this.nodes.nodesMap[child][inout];
                for (var type in couts) {
                    var states = couts[type];

					for (var state in states) {
						var eps = states[state];

						for (var j = 0, jlen = eps.length; j < jlen; j++) {
							if(inout == 'cin') {
								for(var k = 0, klen = eps[j].length; k < klen; k++) {
									if(cList[eps[j][k].node] !== null) {
										cList[eps[j][k].node] = false;
									}
								}
							}else {
								if(cList[eps[j]] !== null) {
									cList[eps[j]] = false;
								}
							}
						}
					}
                }
            }
        }

        var results = [];

        for(var cChild in cList) {
            if(cList[cChild] === true) {
                results.push(this.nodes.nodesMap[cChild]);
            }
        }

        results.sort(function(a, b) {
            return (fnChildren(b).length - fnChildren(a).length);
        });

        return results;
    };

    this.getTraverseNodes = function(node) {
		var viewTypes = app.creator.config.viewTypes;
        cViewMode     = viewTypes[app.creator.viewType][((node && node.type) ? node.type : app.creator.viewType)][1];
        traverseList  = [node];
        rCheck = {};

        while(node) {
            if(node.cout && node.cout[cViewMode]) {
				var outType = node.cout[cViewMode];
				for (var outState in outType) {
					var target = outType[outState][0];        // only traverse the first branch, not sure what to do about branches for now
					if(this.nodes.nodesMap[target] && !rCheck[target]) {
						traverseList.push(this.nodes.nodesMap[target]);
						rCheck[target] = true;
						node = this.nodes.nodesMap[target];
					} else {
						node = false;
						break;
					}
				}
            } else {
                node = false;
            }
        }
        return traverseList;
    };

    this.checkStructure = function() {
        var dupes       = {};       // lookup of previous errors so that the same error won't be output a billion times
        var branchCheck = {};       // lookup of nodes that have referenced in any branches
        var branches    = {};       // lookup of branches (arrays) by starting node
        var cur         = 0;

        showErrors([], 'window', true);
        showProgress($('#errorDialog'));
        this.checkStructureHelper(cur, dupes, branchCheck, branches);

//      hideProgress();
//      return errors;
    };

    this.checkStructureHelper = function(cur, dupes, branchCheck, branches) {
        var errors        = [];
        var n             = _this.nodes.nodesArr[cur];

        var defStates = null;
        if(_this.nodes.types[n.type] && _this.nodes.types[n.type].output && _this.nodes.types[n.type].output.display)
            defStates = Object.keys(_this.nodes.types[n.type].output.display.states);

        // Checks to make sure nothing points to itself
        if(n.cout.display) {
            if (n.cout.display.some(function(target) { return target.node == n.id; })) {
                errors.push({
                    errorType: 'errors',
                    msg:       'Node ' + n.id + ' points to itself',
                    nodeType:  n.type,
                    nodeId:    n.id
                });
                dupes[n.id] = true;
            }
        }

        // Checks to make sure only Campaign or Section is a top level node (i.e. no parent)
        if(!n.cout || !n.cout.parent) {
            if(app.creator.config.topLevelNodes.indexOf(n.type) == -1) {
                console.log(n.type);
                errors.push({
                    errorType: 'errors',
                    msg:       n.type + ' ' + n.id + ' has no parent and is not a Campaign, Event, or EventSection.',
                    nodeType:  n.type,
                    nodeId:    n.id
                });
            }
        }

        // Checks sections to make sure all available states are connected or if the "any" state is connected
        if(n.cout) {
            if(defStates && n.type.match(/^Section.+/)) {
                if(!n.cout.display) {
                    errors.push({
                        errorType: 'errors',
                        msg:       n.type + ' ' + n.id + ' Has no out display connectors.',
                        nodeType:  n.type,
                        nodeId:    n.id
                    });
                } else {
                    var dispStates = n.cout.display;
                    var anyCheck   = false;
                    var restCheck  = false;
                    var stateCount = 0;
                    for(var i = 0; i < dispStates.length; i++) {
                        if(dispStates[i].onState == 'any') {
                            anyCheck = true;
                            break;
                        } else {
                            for(var j = 0; j < defStates.length; j++) {
                                if(dispStates[i].onState == defStates[j]) {
                                    stateCount++;
                                    break;
                                }
                            }
                        }
                    }
                    if(stateCount == (defStates.length - 1)) {
                        restCheck = true;
                    }

                    if(!(anyCheck || restCheck)) {
                        errors.push({
                            errorType: 'errors',
                            msg:       n.type + ' ' + n.id + ' Not all states are defined and no "any" state defined.',
                            nodeType:  n.type,
                            nodeId:    n.id
                        });
                    }
                }
            }
        }

        // Checks to make sure that a node's parent is of the correct type
        if(n.cout && n.cout.parent) {
            var parentTypes = this.getParentTypes(n.type);
            var parId       = n.cout.parent[0].node;
            if(!this.nodes.nodesMap[parId]) {  // In theory, this error is not even possible due to foreign constraints on the db
                errors.push({
                    errorType: 'errors',
                    msg:       n.type + ' ' + n.id + ' points to non-existing parent node.',
                    nodeType:  n.type,
                    nodeId:    n.id
                });
            }

            var parentTest = parentTypes.some(function(parentType) { return this.nodes.nodesMap[parId].type == parentType; });

            if(!parentTest) {
                errors.push({
                    errorType: 'errors',
                    msg:       n.type + ' ' + n.id + ' has parent ' + this.nodes.nodesMap[parId].type + ' ' + parId + ' which is not a permitted parent type.',
                    nodeType:  n.type,
                    nodeId:    n.id
                });
            }
        }

        // Checks node for more than one starting node
        var childs      = this.getChildren(n.id);
        var tType       = app.creator.config.traverseType[n.type];
        var firstChilds = this.getFirstChilds(childs, 'cout', function(node) {
            var children = [];
            if (node && node.cout[tType]) {
                children = children.concat(node.cout[tType].map(function(out) { return out.node; }));
            }

            return children;
        }, tType);

        if (firstChilds.length > 1) {
            if (n.type == 'Quest') {
                var sectionCount = 0;
                for (var k = 0, klen = firstChilds.length; k < klen; k++) {
                    if (firstChilds[k].type == 'Section') {
                        sectionCount++;
                    }
                }

                if (sectionCount > 1) {
                    errors.push({
                        errorType: 'errors',
                        msg:       n.type + ' ' + n.id + ' has more than one starting node.',
                        nodeType:  firstChilds[firstChilds.length - 1].type,
                        nodeId:    firstChilds[firstChilds.length - 1].id
                    });
                }
            } else {
                errors.push({
                    errorType: 'errors',
                    msg:       n.type + ' ' + n.id + ' has more than one starting node.',
                    nodeType:  firstChilds[firstChilds.length - 1].type,
                    nodeId:    firstChilds[firstChilds.length - 1].id
                });
            }
        }

        // check for loops
        if (!dupes[n.id] && !branchCheck[n.id]) {
            for (var cout in n.cout) {
                if (this.containsLoop(n, [], cout)) {
                    errors.push({
                        errorType: 'errors',
                        msg:       n.type + ' ' + n.id + ' is part of a loop.',
                        nodeType:  n.type,
                        nodeId:    n.id
                    });
                }
            }
        }

        if(errors.length > 0) {
            showErrors(errors, 'window');
        }

        if (cur < _this.nodes.nodesArr.length - 1) {
            var that = this;
            setTimeout(function() { that.checkStructureHelper(cur + 1, dupes, branchCheck, branches); }, 0);
        } else {
            $('.verifyBox input').removeAttr('disabled');
            $('#errorDialog .smallSpinner').remove();
        }
    };

    // Goes through all nodes and uses the node's own serialize function to check for errors, super slow
    this.checkData = function() {
        showErrors([], 'window', true);     // clears error window
        this.checkDataHelper(0);
    };

    this.checkDataHelper = function(cur) {
        var node = _this.nodes.nodesArr[cur];
        var template = _this.nodes.unserialize(node);
        var serialized = _this.nodes.types[node.type].serialize($(template));

        if(serialized.errors) {
            serialized.errors.forEach(function(err) {
                err.nodeType = node.type;
                err.nodeId   = node.id;
            });
            showErrors(serialized.errors, 'window');
        }

        if(cur < _this.nodes.nodesArr.length -1) {
            var that = this;
            setTimeout(function() { that.checkDataHelper(cur + 1); }, 0);
        } else {
            $('.verifyBox input').removeAttr('disabled');
            $('#errorDialog .smallSpinner').remove();
        }
    };

    this.containsLoop = function(node, seen, cout) {
        if (seen.indexOf(node.id) !== -1) return true;      // node has been referenced twice in the same branch, loop detected

        if (node.cout[cout]) {
            for (var i = 0, len = node.cout[cout].length; i < len; i++) {
                var coutNode = this.nodes.nodesMap[node.cout[cout][i].node];
                if (coutNode) {
                    if (this.containsLoop(coutNode, seen.concat([node.id]), cout)) return true;
                }
            }
        }
        return false;
    };

    this.traverse = function(node, errors, rCheck, dupes, rules) {
        var children = this.getOuts(node);
        for(var i = 0; i < children.length; i++) {
            if(rCheck[children[i].id]) {
                if(!dupes[children[i].id]) {
                    errors.push({
                        errorType: 'errors',
                        msg:       children[i].type + ' ' + children[i].id + ' has already been referenced in this branch. Loop detected.',
                        nodeType:  children[i].type,
                        nodeId:    children[i].id
                    });

                    dupes[children[i].id]  = true;
                    rCheck[children[i].id] = true;
                }
                return errors;
            } else {
    /*          switch(children[i].type) {
                    case 'SectionBattle':
                        if(!rules['SectionBattle']) {
                            rules['SectionBattle'] = 1;
                        } else {
                            rules['SectionBattle']++;
                        }
                        break;

                    // This warning shouldn't be thrown here?

                    case 'SectionReward':
                        if(!rules['SectionBattle']) {
                            errors.push({
                                errorType: 'warnings',
                                msg:       children[i].type + ' ' + children[i].id + ' has been declared before a battle.',
                                nodeType:  children[i].type,
                                nodeId:    children[i].id
                            });
                        }
                        dupes[children[i].id] = true;
                        break;

                    case 'SectionCapture':      // this broke, fix it some time
                        if(!rules['SectionBattle']) {
                            errors.push({
                                errorType: 'errors',
                                msg:       children[i].type + ' ' + children[i].id + ' has been declared before a battle.',
                                nodeType:  children[i].type,
                                nodeId:    children[i].id
                            });
                            dupes[children[i].id] = true;
                        }
                        break;

                    default:
                        break;
                }
    */
                rCheck[children[i].id]      = true;
                this.traverse(children[i], errors, rCheck, dupes, rules);
            }
        }

        return errors;
    };

    // Not quite convinced this should go here
    // Grabbed the next set of nodes to be rendered
    // For these connectors, it's all the same, but for parent, it would be get this.getChildren
    this.getNextRenderNodes = {
        'default': this.getOuts,
        display:   this.getOuts,
        trigger:   this.getOuts,
        unlock:    this.getIns
    };


	// defaultSerializer, defaultUnserializer, and getNodeRepresentation here will be defaults for the game if defined
	// will look for defaults first, then node specific versions, then game specific before failing

	this.defaultSerializer = {
	/*	// game specific serializer that can be reused
		exampleType : function (data, field) {
			var value  = field.find('.dataValue option:selected').val();
			data.type  = 'string';
			data.value = value;
			return data;
		}
	*/
	};


	this.defaultUnserializer = {
	/*	// game specific unserializer that can be reused
		exampleType: function (data, field) {
            field.find('.dataValue option[value="' + data.value + '"]').attr('selected', true);
		}
	*/
	};


	this.getNodeRepresentation = function (node, params) {
		var desc = node.type + ' (' + node.id + ') ';

		if (node.data && node.data.name) {
			for (var i = 0, len = node.data.name.length; i < len; i++) {
				var curname = node.data.name[i];
				if (curname.language === window.tool.gc.language) {
					desc += '<br />' + curname.value;
				}
			}
		}

		return desc;
	};
}

Cardgame.prototype = Object.create(Game.prototype);
