$html5client('module.docs');

(function () {
	var mage = window.mage;

	mage.loader.once('docs.display', function () {
		var controls = document.getElementById('docs_controls');
		var content = document.getElementById('docs_content');
		var path = document.getElementById('docs_path');

		var ui = mage.dashboard.ui;

		var currentPath;


		function pathJoin() {
			var result = [];
			var isAbsolute = false;

			for (var i = 0, len = arguments.length; i < len; i++) {
				var arg = arguments[i];

				while (arg[0] === '/') {
					isAbsolute = true;
					arg = arg.slice(1);
					result = [];
				}

				if (arg.length > 0) {
					result = result.concat(arg.split('/'));
				}
			}

			// remove relative "current path" periods and empty chunks (double slashes),

			for (i = 0; i < result.length; i++) {
				var chunk = result[i];

				if (chunk === '.' || chunk === '') {
					result.splice(i, 1);
					i -= 1;
				} else if (chunk === '..') {
					// backup one step

					if (i === 0 && isAbsolute) {
						//  we can't back up from "/", so we just ignore the ".."

						result.splice(i, 1);
						i -= 1;
					} else {
						var prev = result[i - 1];

						if (prev === '.') {
							// the case where we're at the top on a relative path: "."
							// make it a relative ".." instead

							result[i - 1] = '..';

							result.splice(i, 1);
							i -= 1;
						} else if (prev !== '..' && prev !== '') {
							// drop the previous entry, and our ".."

							result.splice(i - 1, 2);
							i -= 2;
						}
					}
				}
			}

			return (isAbsolute ? '/' : '') + result.join('/');
		}


		function followLink(event) {
			event.preventDefault();

			var relPath = this.getAttribute('href');

			renderDoc(pathJoin(currentPath, relPath));

			return false;
		}

		function renderDoc(relPath) {
			mage.docs.render(relPath, function (error, rendered) {
				if (error) {
					content.textContent = error;
					return;
				}

				content.innerHTML = rendered;

				// make links work

				var aTags = content.getElementsByTagName('a');
				for (var i = 0, len = aTags.length; i < len; i++) {
					aTags[i].onclick = followLink;
				}
			});
		}


		function setNode(relPath, tree) {
			currentPath = relPath;

			controls.innerHTML = '';
			content.innerHTML = '';
			path.textContent = relPath;

			var relTree = tree;
			var splitPath = relPath ? relPath.split('/') : [];

			for (var i = 0; i < splitPath.length; i++) {
				var chunk = splitPath[i];
				if (chunk !== '.' && chunk !== '') {
					relTree = relTree.folders[chunk];
				}
			}

			var values = [];
			var active;

			var upPath = pathJoin(relPath, '..');

			if (upPath && upPath !== relPath) {
				values.push({
					toString: function () { return 'up'; },
					click: function () {
						setNode(upPath, tree);
					}
				});
			}

			relTree.files.forEach(function (fileName) {
				if (!active || fileName.match(/README/i)) {
					active = fileName;
				}

				values.push({
					toString: function () { return fileName; },
					click: function () {
						renderDoc(pathJoin(relPath, fileName));
					}
				});
			});

			Object.keys(relTree.folders).forEach(function (folderName) {
				values.push({
					toString: function () { return folderName; },
					click: function () {
						setNode(pathJoin(relPath, folderName), tree);
					}
				});
			});

			function onchange(value) {
				value.click();
			}

			var radios = ui.forms.radiobuttons('asset', values, onchange);

			controls.appendChild(radios.fragment);

			if (active) {
				radios.inputs[active].click();
			}
		}

		mage.docs.getDocTree(function (error, tree) {
			if (error) {
				return ui.notifications.send('Error while loading documentation');
			}

			setNode('/', tree);
		});
	});

}());
