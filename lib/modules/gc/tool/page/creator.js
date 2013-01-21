var creator;
var mage = window.mage;

function initApp(creator) {
	creator = creator;
    creator.renderer.init(renderOptions);
	var viewTypes = creator.config.viewTypes;

    for(var types in viewTypes){
            $('#viewButtons').append('<button class="viewType" data-id="' + types + '">' + types + '</button>');
    }
//    getSaves();
}

function loadDialog(action, type, title, id, cb) {
    var buttons  = [];
    var template = $('.nodetemplate[data-type="' + type + '"]').clone().removeClass('nodetemplate');
//	var test = creator.nodes.serialize($(template));
//	creator.nodes.types[type].options.autoAdd ???	// do something like this later?
/*
    if(!test.data && action === 'add') {
        addNode(type, cb);
        return;
    }
*/

    if (id) {
        $('#dialogBox').attr('data-id', id);
    } else {
        $('#dialogBox').removeAttr('data-id');
    }

    buttons.push({ text: 'Cancel', click: function() { $(this).dialog('close'); } });
    switch(action) {
        case 'add':
            buttons.push({
				text: 'Add',
				click: function() {
//					showProgress();
					addNode(type, cb);
				}
			});
            break;

        case 'edit':
            buttons.push({ text: 'Save', click: function () { showProgress(); editNode(creator.nodes.nodesMap[id]); } });
            template = creator.nodes.unserialize(creator.nodes.nodesMap[id]);
            break;

        default:
            break;
    }

    $('#dialogBox').bind('dialogopen', function (event, ui) {
        $('#dialogBox').empty();
		$('#dialogBox').html(template);

        var inputs = $('#dialogBox').find('input, textarea');
        if(inputs && inputs.length > 0) {
            inputs[0].focus();
        }
        // TODO -- ?? why is this still here? remove asap
        var ndata = creator.nodes.nodesMap[id];
        if (ndata && ndata.data) {
            var len = ndata.data.length;
            var bsl = null;
            for (var i = 0; i < len; i++){
                if (ndata.data[i].property == 'bonusSpirits'){
                    bsl = ndata.data[i];
                    break;
                }
            }

            if (bsl){
                // distribute the data on UI
                var list = document.getElementById('bonusSpiritListHolder');
                if (list){
                    var spirits = JSON.parse(bsl.value);
                    for (var k = 0, klen = spirits.length; k < klen; k++){
                        addBonusSpirit(spirits[k]);
                    }
                }
                else {
                    console.error('creator.js loadDialog > missing bonusSpiritListHolder element');
                }
            }
        }
    });

	$('#dialogBox').bind('dialogclose', function(event, ui) {
		$('#dialogBox').empty();
	});

    $('#dialogBox').dialog('option', 'title', title);
    $('#dialogBox').dialog('option', 'buttons', buttons);
    $('#dialogBox').dialog('open');
    $('#dialogBox').dialog('option', 'position', 'center');
}

function loadDialogE(node, inout, nodeDef, cType) {
    var id      = node.attr('data-id');
    var type    = node.attr('data-type');
    var layer   = node.parents('.layer');
    var title   = 'Add Endpoint';
    var buttons = [];

    var html = '';
/*  for(var eType in nodeDef) {
        if(eType == 'custom') {
            html += '<div class="itemLabel sequenceLabel">Custom State</div>';
            html += '<input type="text" class="stateName" />';
        } else
            html += '<input type="radio" name="endpoints" value="' + eType + '" /> ' + eType;
    }
*/
    html += '<div class="itemLabel sequenceLabel">Custom State</div>';
    html += '<input type="text" class="stateName" />';

    buttons.push({ text: 'Cancel', click: function() { $(this).dialog('close'); } });
    buttons.push({ text: 'Add', click: function() {
//      var state = $('#stateDialogBox').find('input[name="endpoints"]:checked').val();
        var state = $('#stateDialogBox').find('.stateName').val();
        if(state !== '') {
            creator.renderer.addEndpoint(node, inout, state, { jNode: layer }, cType);
            creator.renderer.loadConnections({ jNode: layer, viewMode: cType });
            creator.renderer.renderLabels(layer);
            $(this).dialog('close');
        } else {
            showErrors([{errorType: 'errors', msg: 'Custom state name cannot be empty.' }], 'stateDialog');
        }
    } });

    $('#stateDialogBox').bind('dialogopen', function(event, ui) {
        $('#stateDialogBox').empty();
        $(this).append(html);
        $(this).find('.stateName').val('');
//      $(this).find('input[name="endpoints"]:eq(0)').attr('checked', 'checked');
    });

    $('#stateDialogBox').dialog('option', 'title', title);
    $('#stateDialogBox').dialog('option', 'buttons', buttons);
    $('#stateDialogBox').dialog('open');
    $('#stateDialogBox').dialog('option', 'position', 'center');
}

function addNode(type, cb) {
    var nDef = creator.nodes.types[type];
    var content = creator.nodes.serialize($('#dialogBox div').filter(':first'));
    var targetId = $('#dialogBox').attr('data-id');
    var parentId;
    var layer;

    if(targetId) {
        if(creator.nodes.nodesMap[targetId] && creator.nodes.nodesMap[targetId].cout && creator.nodes.nodesMap[targetId].cout.parent && creator.nodes.nodesMap[targetId].cout.parent.any) {
            parentId = creator.nodes.nodesMap[targetId].cout.parent.any[0];
        }
        layer = { jNode: $('.node[data-id="' + targetId + '"]').parents('.layer') };
    } else {
        if($('.curNode').length == 1) {
            parentId = $('.curNode').attr('data-id');
        }
        layer = { jNode: $('.layer').has('.addNodeBtn') };
    }

    if(content === false)
        content = {};
    if(content.errors) {
        showErrors(content.errors, 'dialog');
        return false;
    }

    if(content.data) {
        for(var i = 0; i < content.data.length; i++) {
            if(content.data[i].type == 'string') {
                content.data[i].value = content.data[i].value.trim();
            }
        }

    }

    if(nDef && nDef.output && nDef.output.parent && parentId) {
        content.cout = {};
        content.cout.parent = { any: [parentId] };
    }

    content.type = type;

	mage.gc.addNodes([content], function (error, newNodes) {
		if (error) {
			return console.log('Could not add node(s) : ', content);
		}
		// must make sure "connect to node" function still works
	});
}

function editNode(node, raw) {      // edit node function
    var temp = Object.create(node);
    if(!raw) {
        var dialog = $('#dialogBox');
        var serialized = creator.nodes.serialize(dialog.find('div').filter(':first'));
        if(serialized.errors) {
            showErrors(serialized.errors, 'dialog');
            console.log(serialzed.errors);
            return false;
        }else {
            // TODO -- What?? Need to remove || bonus spirit list (Quest Node ONLY)
            var list = document.querySelectorAll('.bonusSpiritSelect');
            if (list){
                var listData = [];
                var len = list.length;
                for (var i = 0; i < len; i++){
                    var options = list[i].options;
                    var l = options.length;
                    for (var j = 0; j < l; j++){
                        if (options[j].selected){
                            listData[listData.length] = options[j].value;
                            break;
                        }
                    }
                }
                if (listData.length > 0){
                    var data = {
                        property: 'bonusSpirits',
                        value: JSON.stringify(listData),
                        type: 'object',
                        language: ''
                    };
                    serialized.data.push(data);
                }
            }

			if (serialized.data) {
				for(var k = 0, klen = serialized.data.length; k < klen; k++) {
					if(serialized.data[k].type == 'string') {
						serialized.data[k].value = serialized.data[k].value.trim();
					}
				}
				node.data = serialized.data;
			}
        }
    }

	mage.gc.editNodes([node], function (error) {
		if (error) {
			console.log('Could not edit node : ', node);
			creator.nodes.nodesMap[node.id] = temp;		// revert to the original if failed
			updateNodeArray(node.id, temp);
		} else {
//			node.data = nodeDataToObject(node.data);
            $('#dialogBox').dialog('close');
//            hideProgress();
            // TODO:: need to refresh the node display with the newly edited data
            //changeView(creator.nodes.nodesMap[curParent]);
		}
	});
}

function deleteNodes(node, deleteType) {
    var nodes = [];

    if(node) {
        nodes = [node.id];
        if(deleteType === 'allChilds') {
            var descendents = creator.getDescendents(node.id, [], {});
            nodes = nodes.concat(descendents);
        }
    } else {
        $('.ui-selected').each(function() {
            var id = $(this).attr('data-id');
            nodes.push(id);
            if(deleteType === 'allChilds') {
                nodes = nodes.concat(creator.getDescendents(id, [], {}));
            }
        });
    }


    if(confirm("Are you sure you want to delete this?")) {

		mage.gc.delNodes(nodes, function (error) {
			if (error) {
				return console.log('Could not delete nodes! ', nodes);
			}

			$('#deleteDialog').dialog('close');
		});
    }
}


function nodeDataToObject(data) {
	var objData = {};

	if (!data) {
		return objData;
	}

	for (var i = 0, len = data.length; i < len; i++) {
		var prop     = data[i];
		var propData = {};

		if (!objData[prop.property]) {
			objData[prop.property] = [];
		}

		switch (prop.type) {
			case 'string':
				if (prop.language) {
					propData.language = prop.language;
				}

				propData.value = prop.value;
				break;

			case 'number':
				propData.value = parseInt(prop.value, 10);
				break;

			case 'bool':
				propData.value = (prop.value === 'true') ? true : false;			// this should always be true, but just in case
				break;

			case 'object':
				try {
					propData.value = JSON.parse(prop.value);
				} catch (e) {
					console.warn('Could not parse value of type object : ', propData);
				}
				break;

			default:
				console.log('Unknown data type : ', prop.type);
				break;
		}

		objData[prop.property].push(propData);
	}

	return objData;
}


function updateNodeArray(id, node) {
    for(var i = 0, len = creator.nodes.nodesArr.length; i < len; i++) {
        if(creator.nodes.nodesArr[i].id == id) {
            creator.nodes.nodesArr.splice(i, 1);
        }
    }

    creator.nodes.nodesArr.push(node);
}

function deleteNodeFromLists(id) {
//    creator.nodes.nodesArr = creator.nodes.nodesArr.filter(function(node) { return node.id != id; });
    delete creator.nodes.nodesMap[id];

    for(var i = 0, len = creator.nodes.nodesArr.length; i < len; i++) {
        if(creator.nodes.nodesArr[i].id === id) {
            creator.nodes.nodesArr.splice(i, 1);
            len--;
            break;
        }
    }
}


// Removes references to argument id
// Should I delete nodes that reference this id as parent?

function removeAllReferences(id) {
    for(var i in creator.nodes.nodesMap) {
        if(creator.nodes.nodesMap[i].output) {
            var output = creator.nodes.nodesMap[i].output;
            for(var j in output) {
                var type    = output[j];
                var tlength = type.length;
                for(var k = 0; k < tlength; k++) {
                    if(type[k].node == id) {
                        delete type[k];
                    }
                }
                if(output[j].length < 1) {
                    delete output[j];
                }
            }
            if(Object.keys(creator.nodes.nodesMap[i].output).length < 1) {
                delete creator.nodes.nodesMap[i].output;
            }
        }
    }
}

function removeReference(source, target, inout, ctype, state) {
    var type = [];
	var node = creator.nodes.nodesMap[source];
	inout    = (inout === 'output') ? 'cout' : 'cin';

    if(node && node[inout] && node[inout][ctype]) {
        type = node[inout][ctype];
	}


	if (inout === 'cout') {
		if(node.cout[ctype] && node.cout[ctype][state]) {
			var outs = node.cout[ctype][state];

			for (var i = 0, len = outs.length; i < len; i++) {
				if (outs[i] == target) {
					outs.splice(i, 1);
				}
			}

			if (outs.length < 1) {
				delete node.cout[ctype][state];
			}
		}
	} else {
		// TODO -- cin connectors
	}

    if(Object.keys(node[inout][ctype]).length < 1) {
        delete node[inout][ctype];
    }
}

// get tail node
/*function calcTailNodes() {
    lastAddedNodes = {};
    for(var node in creator.nodes.nodesMap) {
        if(!creator.nodes.nodesMap[node].output) {
            lastAddedNodes[getGroup(creator.nodes.nodesMap[node].type)] = node;
        }else if(!creator.nodes.nodesMap[node].output.display) {
            lastAddedNodes[getGroup(creator.nodes.nodesMap[node].type)] = node;
        }
    }
}
*/

function detachConnection(con) {
    var comp       = computeSource(con);
    var source     = comp.source;
    var target     = comp.target;
    var sEndpoint  = comp.sEndpoint;
    var tEndpoint  = comp.tEndpoint;
    var inout      = sEndpoint.attr('data-inout');
    var state      = comp.state;
    var count      = sEndpoint.attr('data-count');
    var cType      = sEndpoint.attr('data-cType');
    removeReference(source, target, inout, cType, state);


	var node = creator.nodes.nodesMap[source];


/*
	inout = (inout === 'output') ? 'cout' : 'cin';

	var outs = node[inout][cType][state];

	for (var i = 0, len = outs.length; i < len; i++) {
		if (outs[i] == target) {
			outs.splice(i, 1);
		}
	}

	if (node[inout][cType][state].length === 0) {
		delete node[inout][cType][state];
	}

	if (Object.keys(node[inout][cType]).length === 0) {
		delete node[inout][cType];
	}
*/

	mage.gc.editNodes([node], function (error) {
		if (error) {
			console.warn('Could not delete connection for node : ', node);
		}
	});

/*
    if(inout == 'cin') {
        delConnection.onState = tEndpoint.attr('data-onstate');
		delConnection.group   = count;

		mage.gc.delInConnectors([delConnection], function (error) {
			if (error) {
				console.log('Could not delete connection. ', delConnection);
			}
		});
    }else {
		mage.gc.delOutConnectors([delConnection], function (error) {
			if (error) {
				console.log('Could not delete connection. ', delConnection);
			}
		});
    }
*/
}

function createConnection(con) {
    var comp       = computeSource(con);
    var source     = comp.source;
    var target     = comp.target;
    var sEndpoint  = comp.sEndpoint;
    var tEndpoint  = comp.tEndpoint;
    var cType      = sEndpoint.attr('data-cType');

    var eCon = getConnection(comp, cType);
    if (eCon) {
        $(eCon.connection.canvas).attr('data-layer', sEndpoint.attr('data-layer'));
	}

    if(!checkValidConnection(con)) {
        renderFlag = true;
        jsPlumb.detach(con);
        renderFlag = false;
        return false;
    }

    var inout     = (sEndpoint.attr('data-inout') == 'input') ? 'cin' : 'cout';

    var pNode = { node: target };
    var state = comp.state;

    if(state) {
        pNode.onState = state;
    } else {
        state = 'any';
	}



//    if(!creator.nodes.nodesMap[source][inout]) creator.nodes.nodesMap[source][inout] = {};
//    if(!creator.nodes.nodesMap[source][inout][cType]) creator.nodes.nodesMap[source][inout][cType] = [];

    if((creator.config.connectionTypes[cType].type === 'in') && (inout === 'cin')) {		// in connection
		// TODO -- do this for in connectors
/*
        var count = sEndpoint.attr('data-count');
        if(!count || count == '')
            count = 0;
        if(!creator.nodes.nodesMap[source][inout][cType][count]) {
            creator.nodes.nodesMap[source][inout][cType][count] = [];
        }

        creator.nodes.nodesMap[source][inout][cType][state][count].push(target);

		var newConnection = { node: source, type: cType, onState: state, target: target, group: count };
		mage.gc.addInConnectors([newConnection], function (error) {
			if (error) {
				console.log('Unable to create connection : ', newConnection);
			}
		});
*/
    }else {			// out connection
		var node = creator.nodes.nodesMap[source];
        if (!node[inout]) {
			node[inout] = {};
		}

        if (!node[inout][cType]) {
			node[inout][cType] = {};
		}

        if (!node[inout][cType][state]) {
			node[inout][cType][state] = [];
		}

        node[inout][cType][state].push(parseInt(target, 10));

		mage.gc.editNodes([node], function (error) {
			if (error) {
				console.warn('Unable to create connection : ', node[inout][cType][state]);
				return false;
			}
		});
    }

    return true;
}

// function to get a connection canvas element since jsPlumb doesn't have this correctly implemented
function getConnection(comp, cType) {
    var source     = $('.node[data-id="' + comp.source + '"]');
    var target     = $('.node[data-id="' + comp.target + '"]');

    var cons = jsPlumb.getConnections()[cType];

	if (cons) {
		for (var i = 0, len = cons.length; i < len; i++) {
			if (cons[i].sourceId == $(source).attr('id') && cons[i].targetId == $(target).attr('id')) {
				return cons[i];
			}
		}
	}

	return false;
}

function checkValidConnection(con) {
    var valid      = true;
    var comp       = computeSource(con);
    var source     = comp.source;
    var target     = comp.target;
    var sEndpoint  = comp.sEndpoint;
    var tEndpoint  = comp.tEndpoint;
    var stype      = sEndpoint.attr('data-type');
    var sid        = sEndpoint.attr('data-id');
    var tid        = tEndpoint.attr('data-id');
    var ttype      = tEndpoint.attr('data-type');
    var cType      = sEndpoint.attr('data-cType');
	var parentMask = null;
    var npar;

    if (creator.nodes.nodesMap[sid] && creator.nodes.nodesMap[sid].cout && creator.nodes.nodesMap[sid].cout.parent && creator.nodes.nodesMap[sid].cout.parent.any) {
        npar = creator.nodes.nodesMap[creator.nodes.nodesMap[sid].cout.parent.any[0]];
    }

    if (source === target) {
        valid = false;
    }

    if (sEndpoint.attr('data-inout') === tEndpoint.attr('data-inout')) {
        valid = false;
    }

    var siblings = [];
    var nodeDef  = creator.nodes.types[stype];

    if (nodeDef && nodeDef.output && nodeDef.output[cType] && nodeDef.output[cType].types) {
        var parentType = (npar) ? npar.type : null;
        parentMask = creator.getChildTypes(parentType);
        siblings = nodeDef.output[cType].types;
    }

    var length = siblings.length;
    if (!siblings.some(function(check) { return check === ttype; })) {
        valid = false;
	}

    if (!parentMask.some(function(mask) { return mask === ttype; })) {
        valid = false;
	}

    return valid;
}

function computeSource(con) {           // figures what the source is regardless of how you drag and create a connection
    var source;
    var target;
    var sEndpoint;
    var tEndpoint;
    var state;


    var sourcePoint = (con.sourceEndpoint.getUuid) ? $('#' + con.sourceEndpoint.getUuid()) : con.sourceEndpoint;
    var targetPoint = (con.targetEndpoint.getUuid) ? $('#' + con.targetEndpoint.getUuid()) : con.targetEndpoint;
    var conType     = sourcePoint.attr('data-cType');

    var cfilter     = { scope: conType, source: con.sourceId, target: con.targetId };
    var connectors  = jsPlumb.getConnections(cfilter);

	if (connectors.length > 0) {
        var clayer = targetPoint.attr('data-layer');
		$(connectors[0]).attr('data-layer', clayer);
	}

    if(conType == 'in') {               // in connection
        if(sourcePoint.attr('data-inout') == 'input') {
            source    = con.source.attr('data-id');
            target    = con.target.attr('data-id');
            sEndpoint = sourcePoint;
            tEndpoint = targetPoint;
        }else {
            source    = con.target.attr('data-id');
            target    = con.source.attr('data-id');
            sEndpoint = targetPoint;
            tEndpoint = sourcePoint;
        }
        state = tEndpoint.attr('data-onState');
    }else {                             // out connection
        if(sourcePoint.attr('data-inout') == 'output') {
            source    = con.source.attr('data-id');
            target    = con.target.attr('data-id');
            sEndpoint = sourcePoint;
            tEndpoint = targetPoint;
        }else {
            source    = con.target.attr('data-id');
            target    = con.source.attr('data-id');
            sEndpoint = targetPoint;
            tEndpoint = sourcePoint;
        }
        state = sEndpoint.attr('data-onState');
    }

    return { source: source, target: target, sEndpoint: sEndpoint, tEndpoint: tEndpoint, state: state };
}

Array.prototype.removeDupes = function() {
    var uniqueArray = [];
    var unique = {};
    for(var i = 0; i < this.length; i++) {
        if(!unique[this[i]]) {
            unique[this[i]] = true;
        }
    }

    for(var item in unique) {
        uniqueArray.push(item);
    }

    return uniqueArray;
};

function buildChildTree() {
    var tree = {};
    for(var node in creator.nodes.nodesMap) {
        var children = [];
        for(var node2 in creator.nodes.nodesMap) {
            if(creator.nodes.nodesMap[node2].output && creator.nodes.nodesMap[node2].output.parent) {
                if(creator.nodes.nodesMap[node2].output.parent[0].node == node) {
                    children.push(node2);
                }
            }
        }
        tree[node] = children;
    }
    return tree;
}

function uploadFile() {
    showProgress();
    var xhr      = new XMLHttpRequest();
    var save     = $('#previousSaves option:selected').val();
    var action   = 'import' + $('#importDialog input[name="importType"]:checked').val();
    var fd       = new FormData();
    fd.append('action', action);

    if(save == 'none') {
        var file     = document.getElementById('importFile').files[0];
        fd.append('file', file);
    } else {
        fd.append('save', save);
    }

    xhr.addEventListener("load", function (data) {
        initNodes();
        //changeView();
        hideProgress();
    }, false);

	// TODO: remove baseDir (from php)
    xhr.open("post", baseDir + "/csv.php", true);
    xhr.send(fd);
}

function getSaves() {
	// TODO: remove baseDir (from php)
    var data = {
        url : baseDir + '/csv.php?action=getsaves',
        type: 'GET',
        success: function(data) {
            prevSaves = data;
            updatePrevSaves();
        }
    };

// TODO -- should probably fix csv import/export at some time
//    ajaxCall(data);
}

// TODO: need to use csv directory from config and not hard-coded
function updatePrevSaves() {
    var type = $('#importDialog input[name="importType"]:checked').val();
    if(type === '') {
        type = 'all';
    }

    $('#previousSaves').empty().append('<option value="none">none</option>');

    var saves = prevSaves[type];

    for(var i = 0; i < saves.length; i++) {
        var filename = saves[i].filename.replace('/home/te/cardgame/tool/creator/csv/', '');
        $('#previousSaves').append('<option value="' + filename + '">' + filename + '</option>');
    }
}
