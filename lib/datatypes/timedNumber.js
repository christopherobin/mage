var TimedValue = require('./timedValue');


function TimedNumber(baseCfg) {
	TimedValue.call(this, baseCfg);

	this.min = null;
	this.max = null;
	this.increment = null;
	this.allowOutOfRange = null;

	var that = this;

	this.setup({
		setMeta: function (meta) {
			that.min = Math.min.apply(null, meta.range);
			that.max = Math.max.apply(null, meta.range);
			that.increment = meta.increment;
			that.allowOutOfRange = meta.allowOutOfRange || false;
		},
		getNextValue: function (value) {
			// in case we allow the value to be set out of range

			if (that.allowOutOfRange) {
				if (that.increment > 0 && value >= that.max) {
					return value;
				}

				if (that.increment < 0 && value <= that.min) {
					return value;
				}
			}

			value += that.increment;

			if (value > that.max) {
				value = that.max;
			} else if (value < that.min) {
				value = that.min;
			}

			return value;
		},
		isLastValue: function (value) {
			return (that.increment > 0) ? (value >= that.max) : (value <= that.min);
		}
	});
}


module.exports = TimedNumber;


TimedNumber.prototype = new TimedValue();


TimedNumber.prototype.inc = function (size, time, allowTruncation) {
	if (typeof size !== 'number') {
		return false;
	}

	var currentValue = this.getCurrentValue();

	if (!this.allowOutOfRange) {
		if (currentValue + size > this.max) {
			if (allowTruncation) {
				size = this.max - currentValue;
			} else {
				return false;
			}
		}

		if (currentValue + size < this.min) {
			if (allowTruncation) {
				size = this.min - currentValue;
			} else {
				return false;
			}
		}
	}

	this.setValue(currentValue + size, time);
	return size;
};


TimedNumber.prototype.dec = function (size, time, allowTruncation) {
	if (typeof size !== 'number') {
		return false;
	}

	var increase = this.inc(-size, time, allowTruncation);
	if (increase === false) {
		return false;
	}

	return -increase;
};


TimedNumber.prototype.confirmMetaData = function () {
	var meta = {
		range: [this.min, this.max],
		increment: this.increment
	};

	if (this.allowOutOfRange) {
		meta.allowOutOfRange = true;
	}

	this.setMeta(meta);
};



TimedNumber.prototype.setRange = function (min, max) {
	this.min = min;
	this.max = max;

	this.confirmMetaData();
};


TimedNumber.prototype.setIncrement = function (size) {
	this.increment = size;

	this.confirmMetaData();
};

