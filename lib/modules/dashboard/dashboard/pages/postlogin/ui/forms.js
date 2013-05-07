(function (window) {

	var mage = window.mage;
	var document = window.document;


	function radiobutton(name, value, labelText) {
		var fragment = document.createDocumentFragment();

		var input = document.createElement('input');
		input.type = 'radio';
		input.name = name;
		input.value = value;
		input.id = 'radio:' + name + ':' + value;

		var label = document.createElement('label');
		label.setAttribute('for', input.id);
		label.textContent = labelText || value;

		fragment.appendChild(input);
		fragment.appendChild(label);

		return {
			fragment: fragment,
			input: input,
			label: label
		};
	}


	function radiobuttons(name, values, onchange) {
		var result = {
			fragment: document.createDocumentFragment(),
			inputs: {},
			value: null,
			activeInput: null
		};

		function update() {
			result.value = this.value;
			result.activeInput = result.inputs[this.value];

			if (onchange) {
				onchange(this.value);
			}
		}

		function addRadioButton(value, labelText) {
			var radio = radiobutton(name, value, labelText);

			result.fragment.appendChild(radio.fragment);

			if (onchange) {
				radio.input.onclick = update;
			}

			result.inputs[value] = radio.input;
		}


		if (Array.isArray(values)) {
			for (var i = 0; i < values.length; i++) {
				addRadioButton(values[i], values[i]);
			}
		} else {
			for (var value in values) {
				if (values.hasOwnProperty(value)) {
					addRadioButton(value, values[value]);
				}
			}
		}

		return result;
	}


	function select(name, values, onchange) {
		var sel = document.createElement('select');

		var result = {
			select: sel,
			value: undefined,
			options: {}
		};

		sel.selectedIndex = -1;
		sel.setAttribute('name', name);

		sel.onchange = function () {
			result.value = this.value;

			if (onchange) {
				onchange(this.value);
			}
		};

		function addOption(value, text) {
			var opt = document.createElement('option');

			opt.setAttribute('value', value);
			opt.textContent = text;

			sel.appendChild(opt);

			result.options[value] = opt;
		}

		if (Array.isArray(values)) {
			for (var i = 0; i < values.length; i++) {
				addOption(values[i], values[i]);
			}
		} else {
			for (var value in values) {
				if (values.hasOwnProperty(value)) {
					addOption(value, values[value]);
				}
			}
		}

		return result;
	}


	mage.dashboard.ui.forms = {
		radiobutton: radiobutton,
		radiobuttons: radiobuttons,
		select: select
	};


}(window));
