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

			result.inputs[value] = result.fragment.input;
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


	mage.dashboard.ui.forms = {
		radiobutton: radiobutton,
		radiobuttons: radiobuttons
	};


}(window));
