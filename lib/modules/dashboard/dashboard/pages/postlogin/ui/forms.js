(function (window) {

	var mage = window.mage;
	var document = window.document;


	function checkbox(name, value, labelText) {
		var fragment = document.createDocumentFragment();

		var input = document.createElement('input');
		input.type = 'checkbox';
		input.name = name;

		if (value) {
			input.value = value;
		}

		input.id = 'check:' + name + ':' + value;

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


	function checkboxes(names, onchange) {
		var result = {
			fragment: document.createDocumentFragment(),
			inputs: {},
			labels: {},
			checked: []
		};

		function update() {
			if (this.checked) {
				if (result.checked.indexOf(this.name) === -1) {
					result.checked.push(this.name);
				}
			} else {
				var index = result.checked.indexOf(this.name);
				if (index !== -1) {
					result.checked.splice(index, 1);
				}
			}

			if (onchange) {
				onchange(this.name, this.checked, this.value);
			}
		}

		function addCheckButton(name, value, labelText) {
			var check = checkbox(name, value, labelText);

			result.fragment.appendChild(check.fragment);

			check.input.onclick = update;

			result.inputs[name] = check.input;
			result.labels[name] = check.label;
		}


		if (Array.isArray(names)) {
			for (var i = 0; i < names.length; i++) {
				addCheckButton(names[i], '1', names[i]);
			}
		} else {
			for (var name in names) {
				if (names.hasOwnProperty(name)) {
					addCheckButton(name, names[name], name);
				}
			}
		}

		return result;
	}


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
			labels: {},
			value: null,
			activeInput: null
		};

		function addRadioButton(value, labelText) {
			var radio = radiobutton(name, value, labelText);

			result.fragment.appendChild(radio.fragment);

			if (onchange) {
				radio.input.onclick = function () {
					result.value = value;
					result.activeInput = result.inputs[value];

					onchange(value);
				};
			}

			result.inputs[value] = radio.input;
			result.labels[value] = radio.label;
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
		checkbox: checkbox,
		checkboxes: checkboxes,
		select: select
	};


}(window));
