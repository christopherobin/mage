var hideTimer = false;
var creator;



function setupUiHandlers() {
	creator = window.tool.gc.creator;
//  document.onselectstart = function () { return false; };
    $(document).click(function() {
        $('.context-menu').hide();
    });

    // Add New Node Handlers
    // loadDialog takes action, type and title

    $('.addNodeBtn').live('click', function()  {
        $('#addNodeDialog').dialog('open');
    });

    // Edit Node Handlers

    $('.editNode').live('click', function(e) {
        // reset preview window
        var preview = document.getElementById('preview');
        if (preview){
            preview.innerHTML = '';
        }
        creator.editNode($(this));
        e.preventDefault();
        return false;
    });

/*  jsPlumb.bind('jsPlumb_dragged', {       // probably not a good idea, but hacked jsPlumb to fire a jsPlumb_dragged event since it was hiding them
        jsPlumb_dragged: function(p) {
            renderLabels();
        }
    });
*/
    jsPlumb.bind('jsPlumbConnection', function (p) {
		if(!creator.renderFlag) {
			if(!createConnection(p)) {
				console.log('bad connection');
			}
		}
	});

    jsPlumb.bind('jsPlumbConnectionDetached', function (p) {
		if(!creator.renderFlag) {
			detachConnection(p);
		}
	});

    // Delete Node Handler

    $('.deleteNode').live('click', function(e) {
        var id = $(this).parents('.node').attr('data-id');
        creator.deleteNodes(creator.nodes.nodesMap[id]);
        e.preventDefault();
        return false;
    });

    // Select Node Handlers
    //

    $('.layer').live('mouseenter', function(e) {
        $(this).selectable({
            filter: '.node',
            start: function() {
                $('.ui-selected').removeClass('ui-selected');
                var newCurId   = $(this).attr('data-selected-id');
                var curNodeId  = $('.curNode').attr('data-id');
                if(curNodeId !== newCurId) {
                    $('.curNode').removeClass('curNode');
                    $('.node[data-id="' + newCurId + '"]').addClass('curNode');
                    creator.nodeClick($('.curNode'));
                }
            },
        });
    });

    $('.node').live('click', function(e) {
        creator.nodeClick($(this));
        e.preventDefault();
        return false;
    });

    $('.node').live('mousedown', function() {
        $(this).css({ '-webkit-box-shadow': '0 0 30px blue', 'box-shadow': '0 0 30px blue' });

    });

    $('.node').live('mouseup', function() {
        $(this).css({ '-webkit-box-shadow': '', 'box-shadow': '' });
    });

    // Keyboard Handlers
    $('.mithril-page[data-page="gc"]').keydown(function(event) {
        creator.keydownHandler(event);
    });

    $('button').live('mousedown', function(e) {
        $(this).css('opacity', 0.5);
        e.preventDefault();
        return false;
    });

    $('button').live('mouseup', function(e) {
        $(this).css('opacity', 1);
        e.preventDefault();
        return false;
    });

    $('button').live('mouseleave', function(e) {
        $(this).css('opacity', 1);
        e.preventDefault();
        return false;
    });

    $('#checkStructure').click(function() {
        $('.verifyBox input').attr('disabled', true);
        creator.checkStructure();
    });

    $('#checkData').click(function() {
        $('.verifyBox input').attr('disabled', true);
        creator.checkData();
    });

    $('#toolBox').draggable();

    $('#toolTop').click(function() {
        $('html,body').animate({ scrollTop: 0 }, { duration: 'slow', easing: 'linear'});
        creator.renderer.setActiveLayer($('.layer[data-layer="layer1"]'));
    });

    $('#prevLayer').click(function() {
        var top = 0;
        var layer = $('.curLayer').prev('.layer');
        if(layer.position())
            top = $('.curLayer').prev('.layer').position().top;

        $('html,body').animate({ scrollTop: top }, { duration: 'slow', easing: 'linear'});
    });

    $('#layerTop').click(function() {
        var top = $('.curLayer').position().top;
        $('html,body').animate({ scrollTop: top }, { duration: 'slow', easing: 'linear'});
    });

    $('#refreshLayer').click(function() {
        $('.curNode').click();
    });

    $('#dialogBox, #stateDialogBox').dialog({
        autoOpen:   false,
        height:     'auto',
        width:      'auto',
        modal:      true,
        zIndex:     10000
    });

    $('#addNodeDialog').dialog({
        autoOpen:   false,
        height:     'auto',
        width:      'auto',
        modal:      true,
        zIndex:     10000,
        title:      'Add New Node',
        open:       function() {
            var pNode = creator.nodes.nodesMap[$('.curNode').attr('data-id')];
            var type  = (pNode) ? pNode.type : null;
            var types = creator.getChildTypes(type);
            $(this).empty();
            for(var i = 0; i < types.length; i++) {
                $(this).append('<input type="radio" name="newNodeType" value="' + types[i] + '" /> ' + types[i] + '<br />');
            }

            $(this).find('input:first-child').attr('checked', 'checked');
        },
        buttons: {
            'Add': function() {
                var type = $(this).find('input:checked').val();
                $(this).dialog('close');
                creator.addNode(type);
            },
            'Cancel': function() {
                $(this).dialog('close');
            }
        }
    });

    $('#deleteDialog').dialog({
        autoOpen:   false,
        height:     'auto',
        width:      'auto',
        modal:      true,
        zIndex:     10000,
        title:      'Delete Node',
        buttons: {
            'Delete': function() {
                var deleteType = $(this).find('input:checked').val();
                var id         = $(this).attr('data-id');
                var type       = $(this).attr('data-type');
                if(type === 'keyboard')
                    deleteNodes(null, deleteType);
                else
                    deleteNodes(creator.nodes.nodesMap[id], deleteType);
            },
            'Cancel': function() {
                $(this).dialog('close');
            }
        }
    });

    $('#pasteDialog').dialog({
        autoOpen:   false,
        height:     'auto',
        width:      'auto',
        modal:      true,
        zIndex:     10000,
        title:      'Paste Node',
        buttons: {
            'Paste': function() {
                var pasteType = $(this).find('input:checked').val();
                creator.pasteCopyNodes(pasteType);
            },
            'Cancel': function() {
                $(this).dialog('close');
            }
        }
    });

    $('#errorDialog').dialog({
        autoOpen:   false,
        height:     500,
        width:      500,
        maxWidth:   'auto',
        zIndex:     10000,
        title:      'Errors',
        open: function() {
//          $(this).dialog('option', 'width', 'auto');
            $(this).parent().css('position', 'fixed');
        }
    });

    $('#exportDialog').dialog({
        autoOpen:  false,
        height:    'auto',
        width:     'auto',
        modal:     true,
        title:     'Export to csv',
        zIndex:    10000,
        open: function() {
            $(this).find('input[name="exportType"]:first-child').attr('checked', true);
            updatePrevSaves();
        },
        buttons: {
            "Export": function() {
                var url = 'csv.php?action=export' + $(this).find('input:checked').val();
                var elemIF = document.createElement("iframe");
                elemIF.src = url;
                elemIF.style.display = "none";
                document.body.appendChild(elemIF);
                $(this).dialog('close');
            },
            "Cancel": function() {
                $(this).dialog('close');
            }
        }
    });

    $('#importDialog').dialog({
        autoOpen:  false,
        height:    'auto',
        width:     'auto',
        modal:     true,
        title:     'Load from csv',
        zIndex:    10000,
        open: function() {
            $(this).find('input[name="importType"]:first-child').attr('checked', true);
            $('#fileClear').trigger('click');
            $('#fileSelect').show();
            updatePrevSaves();
        },
        buttons: {
            "Load": function() {
                uploadFile();
                $(this).dialog('close');
            },
            "Cancel": function() {
                $(this).dialog('close');
            }
        }
    });

    $('#popupType').change(function() {
        popupType = $(this).find('option:selected').val();
    });

    $('.node').live('mouseenter', function(){
        if(popupType !== 'none') {
            var type = $(this).attr('data-type');
            if (hideTimer) clearTimeout(hideTimer);
            var pTop = $(this).offset().top;
            var pLeft = $(this).offset().left + 350;
            $('#preview').css({ 'top': pTop, 'left': pLeft });

			$('#preview').html('');
            if(popupType === 'debug')
                $('#preview').text(JSON.stringify(creator.nodes.nodesMap[$(this).attr('data-id')], null, '\t'));
            else {
                $('#preview').html(creator.nodes.unserialize(creator.nodes.nodesMap[$(this).attr('data-id')]));
            }
            $('#preview').fadeIn();
        }
    });

    $('.node').live('mouseleave', function() {
        hideTimer = setTimeout(function() {
            $('#preview').fadeOut('slow');
        }, 250);
    });

    $('#preview').click(function(e) {
        e.preventDefault();
        return false;
    });
/*
    $('#prevNode').bind({
        mouseenter: function() {
            $(this).find('#prevList').slideDown('fast').show();
        },
        mouseleave: function() {
            $(this).find('#prevList').slideUp('slow').hide();
        }
    });

    $('#nextNode').bind({
        mouseenter: function() {
            $(this).find('#nextList').slideDown('fast').show();
        },
        mouseleave: function() {
            $(this).find('#nextList').slideUp('slow').hide();
        }
    });
*/
    $('#exportCsv').click(function() {
        $('#exportDialog').dialog('open');
    });

    $('#importCsv').click(function() {
        $('#importDialog').dialog('open');
    });

    $('input[name="importType"]').change(function() {
        updatePrevSaves();
        $('#fileSelect').show();
    });

    $('#previousSaves').change(function() {
        if($('#previousSaves option:selected').val() === 'none')
            $('#fileSelect').show();
        else
            $('#fileSelect').hide();
    });

    $('#importFile').change(function() {
        $('#previousHolder').hide();
        $('#fileClear').show();
    });

    $('#fileClear').click(function() {
        $('#previousHolder').show();
        $('#importFile').val('');
        $(this).hide();
    });

    // Add endpoints

    $('.addInput').live('click', function(e) {
        creator.addInput($(this));
        e.preventDefault();
        return false;
    });

    $('.addOutput').live('click', function(e) {
        creator.addOutput($(this));
        e.preventDefault();
        return false;
    });


    $('._jsPlumb_endpoint').live('mouseenter', function(event, ui) {
        var _this    = $(this);
        var type     = $(this).attr('data-type');
        var id       = $(this).attr('data-id');
        var inout    = $(this).attr('data-inout');
        var cType    = $(this).attr('data-ctype');
        var point    = jsPlumb.getEndpoint($(this).attr('id'));
        var siblings = [];
        var nodeDef  = creator.nodes.types[type];
        var npar;

        if(creator.nodes.nodesMap[id] && creator.nodes.nodesMap[id].output && creator.nodes.nodesMap[id].output.parent && creator.nodes.nodesMap[id].output.parent[0]) {
            npar = creator.nodes.nodesMap[creator.nodes.nodesMap[id].output.parent[0].node];
        }

        if(nodeDef && nodeDef.output && nodeDef.output[cType] && nodeDef.output[cType].types) {
            var parentType = (npar) ? npar.type : null;
            var parentMask = creator.getChildTypes(parentType);
            siblings = nodeDef.output[cType].types;
        }

        var menus    = {
            'Delete Endpoint': {
                click: function() {
                    jsPlumb.removeEndpoint(type + id, point);
                },
                klass: 'deleteMenu redGradient'
            }
        };

        var connect = function(targetId) {
            var refine = (inout === 'input') ? 'output' : 'input';
            var targetEndpoint = $('._jsPlumb_endpoint[data-id="' + targetId + '"][data-inout="' + refine + '"]');
            if(targetEndpoint.length === 0) {
                renderer.addEndpoint($('.node[data-id="' + targetId + '"]'), refine);
            }
            var conn = {
                source:           $('.node[data-id="' + id + '"]'),
                target:           $('.node[data-id="' + targetId + '"]'),
                sourceEndpoint:   _this,
                targetEndpoint:   $('._jsPlumb_endpoint[data-id="' + targetId + '"][data-inout="' + refine + '"]')
            };

            createConnection(conn);
        };

        for(var i = 0; i < siblings.length; i++) {
            var sType = siblings[i];

            if(parentMask.some(function(mask) { return mask === sType; })) {
                var name = 'Add ' + sType;
                var obj = { klass: 'addMenu greenGradient', data: { 'data-type': sType } };

                obj.click = function(aEle, mEle) {
                    var type = mEle.attr('data-type');
                    loadDialog('add', type, 'Add ' + type, id, connect);
                }

                menus['Add ' + sType] = obj;
            }
        }

        $(this).contextMenu('endpointMenu', menus);
    });

    $('._jsPlumb_connector path').live('mouseenter', function(event, ui) {
        $(this).contextMenu('deleteConnectorMenu', {
            'Delete Connector': {
                click: function(connector) {
					connector      = $(connector).parents('._jsPlumb_connector');
					var filter = {
						scope:  connector.attr('data-cType'),
						source: connector.attr('data-source'),
						target: connector.attr('data-target')
					};

					var connection = jsPlumb.getConnections(filter)[0];
					jsPlumb.detach(connection);
                },
                klass: 'deleteMenu redGradient'
            }
        });
    });

    $('.crumb').live('click', function() {
        var id      = $(this).attr('data-type');
        var curNode = $(this).attr('data-id');
        curNodes[id]  = curNode;
        curParent     = curNode;
        changeView(creator.nodes.nodesMap[curNode]);
    });

    $('.errorLink').live('click', function() {
        creator.gotoError($(this));
    });

    $('.viewType').live('click', function(event, ui) {
        app.creator.viewType = $(this).data('id');
        changeView(creator.nodes.nodesMap[curParent]);
    });

    $('.insertTextButton').live('click', function(event, ui) {
        var text   = $(this).attr('data-text');
        $('input:focus, textarea:focus').insertAtCaret(text);
    });
}

function changeView(node) {
    if(node && node.type)
        curType = node.type;
    else
        curType = undefined;

    viewMode = viewTypes[app.creator.viewType][((node && node.type) ? node.type : app.creator.viewType)][0];
    creator.renderFlag = true;
//  jsPlumb.removeEveryEndpoint();
    $('#nodeCanvas').empty();
    creator.renderFlag = false;
    if(node && node.id) {
        loadChildren(node.id);
//      setCrumb(node.type, node.id);
        curParent = node.id;
    }else{
//      setCrumb();
        loadChildren();
    }
    resizeCanvas();
    scroll(0, 0);
}

function resizeCanvas() {
    var maxHeight = 400;
    var maxWidth = 800;
    $('.node').each(function() {
        if($(this).offset().top > maxHeight)
            maxHeight = $(this).offset().top;

        if(($(this).offset().left + 300) > maxWidth)
            maxWidth = $(this).offset().left + 300;
    });
    maxHeight += 200;
    maxWidth  += 200;

    maxWidth = Math.max( ($(window).width() * 0.9), maxWidth );
    maxHeight = Math.max( ($(window).height() * 0.9), maxHeight );
    $('#contentHolder').height(maxHeight);
    $('#contentHolder').width(maxWidth);
}

function setCrumb(type, id) {
    $('#breadcrumb').empty();
    var newCrumb = '<div class="crumb" data-type="Top"><div class="cName">Top</div><div class="crumbDetail">Top</div></div>';
    crumb = $(newCrumb).appendTo($('#breadcrumb'));


    if(id) {
        var ancestors = [creator.nodes.nodesMap[id]].concat(creator.getAncestors(id, []));
        ancestors.reverse();
        for(var i = 0; i < ancestors.length; i++) {
            var newCrumb = '<div class="crumb" data-id="' + ancestors[i].id + '" data-type="' + ancestors[i].type + '"><div class="cName">' + ancestors[i].type + '</div><div class="crumbDetail"></div></div>';
            crumb = $(newCrumb).appendTo($('#breadcrumb'));

            var detail = creator.nodes.getNodeRepresentation(creator.nodes.nodesMap[ancestors[i].id]);
            if(!detail || detail === '')
                detail = type + ' ' + id;
            crumb.find('.crumbDetail').html(detail);
        }
    }

    setCurNodeNav(id, type);
    setAddButtons(id, type);
}

function setAddButtons(id, type) {
    var types = creator.getChildTypes(type);
    $('#addMenu').empty();
    for(var i = 0; i < types.length; i++) {
        var button = '<button class="addNode greenGradient" data-type="' + types[i] + '">Add ' + types[i] + '</button>';
        $('#addMenu').append(button);
    }
}

function setCurNodeNav(id, type) {
    $('#curNodeNav').empty();
    if(!id)
        return;

    $('#curNodeNav').append('<div class="curNodeNavHead">' + type + 's</div>');
//  var prevLimit = 3;
//  var nextLimit = 3;
    var sibs  = creator.getSiblings(id);
    var prevs = creator.getPrevSiblings(id, [], {}, sibs);
    var nexts = creator.getNextSiblings(id, [], {});
/*
    var p = prevLimit - prevs.length;
    var n = nextLimit - nexts.length;

    if(p > 0)
        nextLimit += p;
    if(n > 0)
        prevLimit += n;

    prevs     = prevs.slice(0, prevLimit);
    prevs     = prevs.reverse();
    nexts     = nexts.slice(0, nextLimit);
*/

    prevs     = prevs.reverse();

    var siblings = prevs.concat([creator.nodes.nodesMap[id]].concat(nexts));

    for(var i = 0; i < siblings.length; i++) {
//      var crumb = '<div class="crumb" data-type="' + siblings[i].type + '"><div class="cName">' + siblings[i].type + '</div><div class="crumbDetail"></div></div>';
        var crumb = '<div class="crumb" data-type="' + siblings[i].type + '"><div class="crumbDetail"></div></div>';
        var sCrumb = $(crumb).appendTo($('#curNodeNav'));
        var detail = creator.nodes.getNodeRepresentation(siblings[i], { siblings: siblings});
        if(!detail || detail === '')
            detail = siblings[i].id;
        sCrumb.find('.crumbDetail').html(detail);
        sCrumb.attr('data-id', siblings[i].id);
        if(siblings[i].id === curNodes[type]) {
            sCrumb.addClass('curNode');
        }
    }
}

function showErrors(errors, type, clear) {
    switch(type) {
        case 'stateDialog':
            var errEle = $('#dialogErrors');
            if(errEle.length === 0) {
                errEle = $('<div id="dialogErrors"></div>');
                $('#stateDialog').prepend(errEle);
            }

            errEle.empty();
            errors.forEach(function(val, key) {
                errEle.append('<div class="' + val.errorType + '"> - ' + val.msg + '</div>');
            });

            break;

        case 'dialog':
            var errEle = $('#dialogErrors');
            if(errEle.length === 0) {
                errEle = $('<div id="dialogErrors"></div>');
                $('#dialogBox').prepend(errEle);
            }

            errEle.empty();
            errors.forEach(function(val, key) {
                errEle.append('<div class="' + val.errorType + '"> - ' + val.msg + '</div>');
            });

            break;

        case 'window':
            if (clear)
                $('#errorDialog').empty();

            if ($('#errorDialog div').length < 1 && errors.length === 0) {
                $('#errorDialog').append('<div class="noerrors"> - No Errors</div>');
                $('#errorDialog').append('<div class="smallSpinner"></div>');
            } else {
                $('.noerrors').remove();
                errors.forEach(function(val, key) {
                    var errorMsg = '<div class="' + val.errorType + '"><a class="errorLink" data-id="' + val.nodeId + '">' + val.nodeType + ' ' + val.nodeId + '</a> -- ' + val.msg + '</div>'
                    $('#errorDialog').append(errorMsg);
                });
            }

            $('#errorDialog').dialog('open');

            break;

        default:
            break;
    }
}

jQuery.fn.extend({
    insertAtCaret: function(myValue){
        return this.each(function(i) {
            if (document.selection) {
                this.focus();
                sel = document.selection.createRange();
                sel.text = myValue;
                this.focus();
            }
            else if (this.selectionStart || this.selectionStart === '0') {
                var startPos = this.selectionStart;
                var endPos = this.selectionEnd;
                var scrollTop = this.scrollTop;
                this.value = this.value.substring(0, startPos)+myValue+this.value.substring(endPos,this.value.length);
                this.focus();
                this.selectionStart = startPos + myValue.length;
                this.selectionEnd = startPos + myValue.length;
                this.scrollTop = scrollTop;
            } else {
                this.value += myValue;
                this.focus();
            }
        })
    }
});

function makeSelectable(layer) {
}
