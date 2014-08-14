var actionsByNum = [
	'SEND',       // 0
	'CONNECT',    // 1
	'DISCONNECT', // 2
	'CONFIRM'     // 3
];

var actionsByStr = {};
for (var i = 0; i < actionsByNum.length; i += 1) {
	actionsByStr[actionsByNum[i]] = i;
}

function actionToStr(action) {
	var type = typeof action;

	if (type === 'string') {
		// assert that this action is valid
		if (actionsByStr.hasOwnProperty(action)) {
			return action;
		}
	} else if (type === 'number') {
		if (actionsByNum[action]) {
			return actionsByNum[action];
		}
	}

	throw new Error('Unknown action: ' + action + ' (type: ' + type + ')');
}

function actionToNum(action) {
	var type = typeof action;

	if (type === 'string') {
		// assert that this action is valid
		if (actionsByStr.hasOwnProperty(action)) {
			return actionsByStr[action];
		}
	} else if (type === 'number') {
		if (actionsByNum[action]) {
			return action;
		}
	}

	throw new Error('Unknown action: ' + action + ' (type: ' + type + ')');
}


function toBuffer(str) {
	if (typeof str === 'string') {
		return new Buffer(str);
	}

	if (Buffer.isBuffer(str)) {
		return str;
	}

	throw new TypeError('Argument is not a string or Buffer');
}


/* message format:
 *   1 byte:  action
 *   1 byte:  length of target address in bytes (N)
 *   N bytes: the target address (something identifying a user, or '*', etc)
 *   remaining bytes: the payload
 */

function StoreCommand(address, action, msg) {
	if (!Buffer.isBuffer(address) && typeof address !== 'string') {
		throw new TypeError('Address must be a Buffer or string');
	}

	if (msg && !Buffer.isBuffer(msg) && typeof msg !== 'string') {
		throw new TypeError('Message must be a buffer or string');
	}

	this.address = address;
	this.action = actionToStr(action);
	this.msg = msg;
}


module.exports = StoreCommand;


StoreCommand.prototype.toBuffer = function () {
	var address = toBuffer(this.address);
	var action = actionToNum(this.action);
	var msg = this.msg ? toBuffer(this.msg) : undefined;

	if (address.length > 255) {
		throw new Error('Address may not consume more than 255 bytes');
	}

	var buff = new Buffer(2 + address.length + (msg ? msg.length : 0));
	buff[0] = action;
	buff[1] = address.length;

	address.copy(buff, address, 2);

	if (msg) {
		msg.copy(buff, 2 + address.length);
	}

	return buff;
};


StoreCommand.fromBuffer = function (buff) {
	var action = buff[0];
	var addressLen = buff[1];

	var address = buff.slice(2, 2 + addressLen);
	var msg;

	if (buff.length > 2 + addressLen) {
		msg = buff.slice(2 + addressLen);
	}

	return new StoreCommand(address, action, msg);
};
