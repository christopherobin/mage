var mage = require('mage');
var ui = mage.dashboard.ui;


var userList;

function displayUserList(container, engineName) {
	if (userList && userList.parentNode) {
		userList.parentNode.removeChild(userList);
	}

	var table = document.createElement('table');
	table.style.clear = 'both';
	table.style.marginTop = '20px';

	userList = table;

	var thead = table.appendChild(document.createElement('thead'));
	var tbody = table.appendChild(document.createElement('tbody'));

	thead.innerHTML = '<tr><th>Username</th><th>Display name</th></tr>';

	mage.ident.listUsers(engineName, function (error, users) {
		if (error) {
			return ui.notifications.send('Error listing users.');
		}

		users.forEach(function (user) {
			var tr = document.createElement('tr');
			var td;

			td = tr.appendChild(document.createElement('td'));
			td.textContent = user.username;

			td = tr.appendChild(document.createElement('td'));
			td.textContent = user.displayName;

			tbody.appendChild(tr);
		});
	});

	container.appendChild(table);
}


function displayCreateUserForm(container, engineName) {
	var section = document.createElement('section');
	section.className = 'dialog';
	section.style.width = '380px';

	var h1 = section.appendChild(document.createElement('h1'));
	h1.textContent = 'Create new user';

	var form = section.appendChild(document.createElement('form'));

	var label, username, password, displayName;

	// username

	label = form.appendChild(document.createElement('label'));
	label.style.display = 'inline-block';
	label.style.width = '180px';
	label.textContent = 'Username';

	username = form.appendChild(document.createElement('input'));
	username.type = 'text';
	username.style.width = '150px';

	form.appendChild(document.createElement('br'));

	// password

	label = form.appendChild(document.createElement('label'));
	label.style.display = 'inline-block';
	label.style.width = '180px';
	label.textContent = 'Password';

	password = form.appendChild(document.createElement('input'));
	password.type = 'password';
	password.style.width = '150px';

	form.appendChild(document.createElement('br'));

	// displayName

	label = form.appendChild(document.createElement('label'));
	label.style.display = 'inline-block';
	label.style.width = '180px';
	label.textContent = 'Display name (optional)';

	displayName = form.appendChild(document.createElement('input'));
	displayName.type = 'text';
	displayName.style.width = '150px';

	form.appendChild(document.createElement('br'));

	var btn = form.appendChild(document.createElement('button'));
	btn.textContent = 'Create user';

	form.onsubmit = function (evt) {
		evt.preventDefault();

		var credentials = {
			username: username.value.trim(),
			password: password.value
		};

		var user = {
			displayName: displayName.value.trim()
		};

		mage.ident.createUser(engineName, credentials, user, function (error) {
			if (error) {
				return ui.notifications.send('Error creating user.');
			}

			ui.notifications.send('User created.');

			displayUserList(container, engineName);
			form.reset();
			username.focus();
		});

		return false;
	};

	// finally display the section
	container.appendChild(section);
	username.focus();
}


exports.display = function (container, engineName, cfg) {
	displayCreateUserForm(container, engineName, cfg);
	displayUserList(container, engineName);
};