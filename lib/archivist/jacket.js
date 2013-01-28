function Jacket(topic, vars, markedNew) {
	this.topic = topic;
	this.vars = vars;
	this.value = null;
	this.ttl = null;

	this.markedNew = markedNew ? true : false;  // indicates whether or not we should create or update
	this.markedDeleted = false;
	this.ttlChanged = false;                    // ttl changed, will need to be distributed
}

exports.Jacket = Jacket;


Jacket.prototype.setTTL = function (ttl) {
	this.ttl = ttl;
	this.ttlChanged = true;
};


Jacket.prototype.setValue = function (value) {
	this.value = value;
	this.markedDeleted = false;
};


Jacket.prototype.del = function () {
	this.value = undefined;
	this.markedDeleted = true;
};


Jacket.prototype.hasChanges = function () {
	return (this.value && this.value.hasChanged) || this.markedNew || this.markedDeleted || this.ttlChanged;
};

