(function () {

	var mithril = window.mithril;


	function TimedNumber() {
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
					if (value >= that.max) {
						return value;
					}

					if (value <= that.min) {
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


	mithril.datatypes.register('TimedNumber', TimedNumber);


	TimedNumber.prototype = new mithril.datatypes.TimedValue();

}());

