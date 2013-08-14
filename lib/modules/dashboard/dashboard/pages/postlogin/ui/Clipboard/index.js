var mage = require('mage');

var Clip = require('clipboard-dom');

// set the path to the clipboard swf file
Clip.swf(mage.assets.swf('ZeroClipboard'));

// this is our button instance
var button = null;
// this is our clipboard-dom instance
var clip = null;
// this is where we store the current element to copy
var activeElement = null;

/**
 * Retrieve the current position and size of a DOMElement, it will not work on some browsers if the element
 * is currently not visible
 *
 * @param obj
 * @returns {{top: number, left: number, width: *, height: *}}
 * @private
 */
function getRect(obj) {
	var rect = {
		top: 0,
		left: 0,
		width: obj.clientWidth,
		height: obj.clientHeight
	};

	// walk back all the way to the body
	while (obj && (obj !== document.body)) {
		// add the position offsets
		rect.top += obj.offsetTop;
		rect.left += obj.offsetLeft;

		// then switch to the parent
		obj = obj.offsetParent;
	}

	return rect;
}

/**
 * Get the copy button, and create it if it doesn't exists
 *
 * @returns DOMElement
 * @private
 */
function getCopyButton() {
	if (button) {
		return button;
	}

	// create our button element, it is hidden by default
	button = document.createElement('div');
	button.className = 'copyButton';
	button.textContent = 'Copy to clipboard';
	button.style.display = 'none';

	// add to the DOM
	document.body.appendChild(button);

	return button;
}

/**
 * Show the button on a given element
 *
 * @param node
 * @private
 */
function showButton(node) {
	// retrieve the button, create it if necessary
	var button = getCopyButton();

	// save the current element
	activeElement = node;

	// retrieve the element details
	var rect = getRect(node);

	// position the button based on those details
	button.style.top = (rect.top - (button.clientHeight / 2)) + "px";
	button.style.left = ((rect.left + rect.width) - button.clientWidth) + "px";
	button.style.display = '';

	// we cannot init clipboard-dom until we display the button because otherwise dom will return a width and height
	// of 0 which will make it go all wonky
	if (!clip) {
		clip = new Clip(button);

		// when the guy click, copy stuff
		clip.on('mousedown', function () {
			// if we have an active element
			if (activeElement) {
				// copy text
				clip.text(activeElement.textContent);

				// make a nice notification to the guy
				mage.dashboard.ui.notifications.send(
					'Copy action successful',
					'The content was successfully copied into your clipboard'
				);
			}
		});
	}

	// have zeroclipboard reposition himself
	clip.reposition();
}

/**
 * Setups the element to receive a "Copy to clipboard" button when hovered
 * @param element
 */
exports.install = function (element) {
	element.addEventListener('mouseover', function () {
		showButton(element);
	});
};