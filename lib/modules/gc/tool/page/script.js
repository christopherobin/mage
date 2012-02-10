$html5client(module.gc);

var nodesMap = {};
var editNodeId;

mithril.loader.on('gc.loaded', function () {
	var mod = {};
	window.tool.gc = mod;


	mithril.setup(function (error) {
		if (error) {
			return console.error(error);
		}

		loadNodes();
	});


	mithril.loader.displayPage('gc');
	setupHandlers();
});

function setupHandlers() {
	$('#addNodeDialog').dialog({
		autoOpen: false,
		width: 'auto',
		modal: true,
		title: 'Add Node',
		buttons: [
			{
				text: 'Cancel',
				click: function () {
					$(this).dialog('close');
				}
			},
			{
				text: 'Add',
				click: function () {
					addNode();
				} 
			}
		]
	});

	$('#editNodeDialog').dialog({
		autoOpen: false,
		width: 'auto',
		modal: true,
		title: 'Edit Node',
		buttons: [
			{
				text: 'Cancel',
				click: function () {
					$(this).dialog('close');
				}
			},
			{
				text: 'Edit',
				click: function () {
					editNode();
				} 
			}
		]
	});


	$('#addNodeBtn').click(function (e) {
		$('#addNodeDialog').dialog('open');
		e.preventDefault();
		return false;
	});


	$('.node').live('click', function (e) {
		var nodeId = $(this).attr('data-id');
		$('#editNodeDialog').dialog('open');
		loadDialogData(nodeId);
		
		e.preventDefault();
		return false;
	});
}


function loadDialogData(nodeId) {
	var node = nodesMap[nodeId];
	var data = node.data;
	editNodeId = nodeId;

	$('#editidentifier').val(node.identifier);
	$('#editnodeType').val(node.type);

	for (var i = 0, len = data.length; i < len; i++) {
		var property = data[i];
		var name = property.property;

		switch (name) {
			case 'coin':
				$('#editcoin').val(property.value);
				break;

			case 'xp':
				$('#editxp').val(property.value);
				break;

			case 'reward':
				var reward = JSON.parse(property.value);
				$('#editrewardItem').val(reward.item);
				$('#editrewardRate').val(reward.rate);
				break;

			default:
				break;
		}
	}
}


function addNode() {
	var identifier = $('#identifier').val();
	var type = $('#nodeType').val();
	var coin = parseInt($('#coin').val(), 10);
	var xp   = parseInt($('#xp').val(), 10);
	var item = $('#rewardItem').val();
	var rate = parseInt($('#rewardRate').val(), 10);

	var node = {
		identifier: identifier,
		type: type,
		data: [
			{ property: 'identifier', type: 'string', value: identifier },
			{ property: 'coin', type: 'number', value: coin },
			{ property: 'xp', type: 'number', value: xp },
			{ property: 'reward', type: 'object', value: JSON.stringify({ item: item, rate: rate }) }
		]
	};

	mithril.gc.addNodes([node], function (error, nodes) {
		if (error) {
			return console.log('Could not add node');
		}

		console.log('Added node ', nodes);
		$('#addNodeDialog').dialog('close');
		loadNodes();
	});
}


function editNode() {
	var id = editNodeId;
	var type = $('#editnodeType').val();
	var coin = parseInt($('#editcoin').val(), 10);
	var xp   = parseInt($('#editxp').val(), 10);
	var item = $('#editrewardItem').val();
	var rate = parseInt($('#editrewardRate').val(), 10);

	var node = {
		id: id,
		type: type,
		data: [
			{ property: 'coin', type: 'number', value: coin },
			{ property: 'xp', type: 'number', value: xp },
			{ property: 'reward', type: 'object', value: JSON.stringify({ item: item, rate: rate }) }
		]
	};

	mithril.gc.editNodes([node], function (error, nodes) {
		if (error) {
			return console.log('Could not add node');
		}

		console.log('Edited node ', editNodeId);
		$('#editNodeDialog').dialog('close');
	});
}


function getIdentifier(node) {
	if (node.data) {
		var data = node.data;
		for (var i = 0, len = data.length; i < len; i++) {
			if (data[i].property === 'identifier') {
				return data[i].value;
			}
		}
	}
	return false;
}

function loadNodes() {
	$('#nodes').empty();
	nodesMap = {};
	window.mithril.gc.gmsync(function (error, nodes) {
		if (!error) {
			for (var i = 0, len = nodes.length; i < len; i++) {
				var node = nodes[i];
				nodesMap[node.id] = node;
				$('#nodes').append('<div class="node" data-id="' + node.id + '">Node id : ' + (getIdentifier(node) || node.id)  + '</div>');
			}

			console.log('nodes loaded! ', nodes);
		}
	});
}
