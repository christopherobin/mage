var mage = require('mage');

function createElement(name, attrs, parent) {
	var el = document.createElement(name);

	for (var attribute in attrs) {
		el[attribute] = attrs[attribute];
	}

	parent.appendChild(el);

	return el;
}

function displayCreateUserForm(el, appName, engine, cfg) {
	var algo = null;

	if (cfg.config.hash) {
		algo = cfg.config.hash;
	}

	if (cfg.config.hmac) {
		algo = cfg.config.hmac.algorithm;
	}

	if (cfg.config.pbkdf2) {
		algo = 'pbkdf2';
	}

	// "create user" section
	var createUserSection = document.createElement('section');
	createUserSection.className = 'dialog c6';

	createElement('h1', { textContent: 'Create user' }, createUserSection);

	var upSuccess = createElement('span', { textContent: 'User created successfully' }, createUserSection);
	var upFailure = createElement('span', { textContent: 'User creation failed' }, createUserSection);

	// hide those 2 and give them some colors
	upSuccess.style.color = 'green';
	upSuccess.style.display = 'none';
	upFailure.style.color = 'red';
	upFailure.style.display = 'none';

	// create a small form
	createElement('label', { className: 'c6', textContent: 'Username' }, createUserSection);
	var upUsername = createElement('input', { className: 'c6 end', type: 'text', id: 'upUsername' }, createUserSection);
	createElement('br', {}, createUserSection);
	createElement('label', { className: 'c6', textContent: 'Password' }, createUserSection);
	var upPassword = createElement('input', { className: 'c6 end', type: 'password', id: 'upPassword' }, createUserSection);
	createElement('br', {}, createUserSection);
	var submitBtn = createElement('button', { textContent: 'Create user'}, createUserSection);

	submitBtn.onclick = function () {
		mage.ident.sendCommand(
			// the engine we target
			{
				appName: appName,
				name: engine
			},
			// we want to create a user
			'createUser',
			// send the credentials
			{
				username: upUsername.value,
				password: upPassword.value
			},
			function (err) {
				if (err) {
					upSuccess.style.display = 'none';
					upFailure.style.display = 'block';
					return;
				}

				upSuccess.style.display = 'block';
				upFailure.style.display = 'none';
			}
		);
	};

	// finally display the section
	el.appendChild(createUserSection);
}

exports.display = function (el, appName, engine, cfg) {
	displayCreateUserForm(el, appName, engine, cfg);
};