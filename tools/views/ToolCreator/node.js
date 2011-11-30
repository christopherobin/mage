//**********************************************************************************************************//
//  File: nodes.js
//  Date: 2011/07/11
//  Description: Nodes class
//  A wrapper for nodes with some simple serializ/unserilize for basic types.
//  More advanced serialize/unserialize functions can be provided in each node's handler.js file
//
//*********************************************************************************************************//

function Nodes() {
	this.nodesMap  = {};
	this.nodesArr  = window.mithril.gc.filterNodes();
	this.types     = {};

	var len = this.nodesArr.length;

	for (var i = 0; i < len; i++) {
		var node = this.nodesArr[i];
		this.nodesMap[node.id] = node;
		if (!node.cout) {
			node.cout = {};
		}
	}
}

Nodes.prototype.registerHandler = function (name, handler) {
	this.types[name] = handler;
};


// node data is recieved as object, but serialized as an array
Nodes.prototype.serialize = function (form, cb) {
	var _this   = this;
	var objType = form.attr('data-type');
	var obj     = {};
	var data    = [];

	form.find('.nodeData').each(function () {
		var property = _this.getPropertyData(objType, $(this));
		if (property) {
			data.push(property);
		}
	});

	if (Object.keys(data).length > 0) {
		obj.data = data;
	}

	return obj;
}


Nodes.prototype.unserialize = function (obj, cb) {
	var data = obj.data;
	var type = obj.type;
	var form = $('.nodetemplate[data-type="' + type + '"]').clone().removeClass('nodetemplate');


	for (var property in data) {
		var curProperty = data[property];

		for (var i = 0, len = curProperty.length; i < len; i++) {
			var queryString = '.nodeData[data-property="' + property + '"]';

			if (curProperty[i].language) {
				queryString += '[data-language="' + curProperty[i].language + '"]';
			}

			var dataField   = form.find(queryString);
			var required    = (dataField.attr('data-required') === 'true');

			this.setPropertyData(type, curProperty[i], dataField, form);
		}
	}

	return form;
};


Nodes.prototype.getPropertyData = function (objType, field) {
	var propertyName = field.attr('data-property');
	var language     = field.attr('data-language');
	var type         = field.attr('data-type');
	var value        = field.find('.dataValue');
	var data         = { property: propertyName };

	var defaultSerializer = window.app.creator.defaultSerializer;

	switch (type) {
		case 'string':
			if (language) {
				data.language = language;
			}

			data.type  = type;
			data.value = value.val();
			break;

		case 'number':
			data.type  = type;
			data.value = value.val();
			break;

		case 'bool':
			var test = value.filter(function () {
				return $(this).val() === 'true';
			});

			if (test.length === 0) {
				console.log('Property ' + propertyName + ' does not have any input with a value of "true".');
				return;
			}

			var boolVal = value.filter(':checked').val();
			if (boolVal === 'true') {
				data.type  = type;
				data.value = 'true';
			}
			break;

		case 'defaultSelect':
			var value = field.find('.dataValue option:selected').val();
			if (value !== '') {
				data.type  = 'string';	
				data.value = value;
			}
			break;

		default:
			var handler = this.types[objType];
			if (handler.serialize && handler.serialize[type]) {
				handler.serialize[type](data, field);
			} else if (defaultSerializer && defaultSerializer[type]) {
				defaultSerializer[type](data, field);
			} else {
				console.log('Serialize error -- Unknown data type for object property : ', type, handler, field);
			}
			break;
	}

	if ((data.property && data.type) && (data.value !== null && data.value !== undefined)) {
		return data;
	}

	return null;
};


Nodes.prototype.setPropertyData = function (objType, data, field, form) {
	var type    = field.attr('data-type');
	var eleType = field.attr('data-formtype');
	var dataEle = field.find('.dataValue');


	var defaultUnserializer = window.app.creator.defaultUnserializer;

	switch (type) {
		case 'string':
			if (dataEle.tagName === 'textarea') {
				dataEle.text(data.value);
			} else {
				dataEle.val(data.value);
			}

			break;

		case 'number':
			dataEle.val(data.value);
			break;

		case 'bool':
			dataEle.val([data.value]);		// using val means that using a checkbox or radio for bool will work
			break;

		case 'defaultSelect':
            field.find('.dataValue option[value="' + data.value + '"]').attr('selected', true);
			break;

		default:
			var handler = this.types[objType];
			if (handler.unserialize && handler.unserialize[type]) {
				handler.unserialize[type](data, field, form);
			} else if (defaultUnserializer && defaultUnserializer[type]) {
				defaultUnserializer[type](data, field);
			} else {
				console.log('Unserialize error -- Unknown data type for object property : ', type, handler, data);
			}

			break;
	}
};


// Returns what to display inside the node. In the future, should be able to return custom representations
// Second argument is extra data that you might from outside of the node
Nodes.prototype.getNodeRepresentation = function (node, params) {
	var type = node.type;
	var desc = type + ' (' + node.id + ') ';	// default if nothing else is defined

	if (this.types[type].getNodeRepresentation) {
		desc = this.types[type].getNodeRepresentation(node, params);
	} else if (window.app.creator.getNodeRepresentation) {
		desc = window.app.creator.getNodeRepresentation(node, params);		// if one is defined for the game
	}

	return desc;
}


Nodes.prototype.addNodes = function (nodes, cb) {

};


Nodes.prototype.editNodes = function (nodes, cb) {

};


Nodes.prototype.deleteNodes = function (nodes, cb) {

};


Nodes.prototype.addCouts = function (nodes, cb) {

};


Nodes.prototype.editCouts = function (nodes, cb) {

};


Nodes.prototype.delCouts = function (nodes, cb) {

};


Nodes.prototype.addCins = function (nodes, cb) {

};


Nodes.prototype.editCins = function (nodes, cb) {

};

Nodes.prototype.delCins = function (nodes, cb) {

};
