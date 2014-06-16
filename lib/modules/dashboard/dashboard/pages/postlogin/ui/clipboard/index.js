var mage = require('mage');

var Clip = require('clipboard-dom');

// set the path to the clipboard swf file
Clip.swf(mage.assets.swf('ZeroClipboard'));

// prevents jshint from complaining
var showButton;
// this is our button instance
var button = null;
// this is our clipboard-dom instance
var clip = null;
// this is where we store the current element to copy
var activeElement = null;
// this is the state of elements being hovered
var hoverState = {
	element: false,
	clip: false
};

/**
 * Hides the button
 *
 * @private
 */
function hideButton() {
	button.style.display = 'none';
}

/**
 * This function takes care of tracking the hover state of elements, and showing the button
 * only if necessary
 *
 * @param {string}  type   Either "element" or "clip"
 * @param {boolean} status The current hover status
 * @private
 */
function setHoverState(type, status) {
	// we need the previous status
	var before = hoverState.element || hoverState.clip;

	// then we update it
	hoverState[type] = status;

	// if one of the items is currently active
	if (hoverState.element || hoverState.clip) {
		// and none was before
		if (!before) {
			// then show the button
			showButton();
		}
	} else {
		// and if it was visible before, but we are not hovering anymore, hide it
		if (before) {
			hideButton();
		}
	}
}

/**
 * Retrieve the current position and size of a DOMElement, it will not work on some browsers if the element
 * is currently not visible
 *
 * @param {Element} obj The DOM element for which you want the current position and size
 * @returns {Object}    { top: number, left: number, width: number, height: number }
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
 * @returns {Element}
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
 * The variable showButton holds the showButton function so that jslint won't complain about it being used
 * before being declared
 *
 * @private
 */
showButton = function showButton() {
	// retrieve the button, create it if necessary
	var button = getCopyButton();

	// retrieve the element details
	var rect = getRect(activeElement);

	// position the button based on those details
	button.style.display = '';
	button.style.top = (rect.top - (button.clientHeight / 2)) + 'px';
	button.style.left = ((rect.left + rect.width) - button.clientWidth) + 'px';

	// we cannot init clipboard-dom until we display the button because otherwise dom will return a width and height
	// of 0 which will make it go all wonky
	if (!clip) {
		clip = new Clip(button);

		clip.on('mouseover', function () {
			setHoverState('clip', true);
		});

		clip.on('mouseout', function () {
			setHoverState('clip', false);
		});

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
};

/**
 * Sets up the element to receive a "Copy to clipboard" button when hovered
 * @param {Element} element
 */
exports.install = function (element) {
	element.addEventListener('mouseover', function () {
		// update the active element
		activeElement = element;
		// then tell the system that we are hovering valid stuff
		setHoverState('element', true);
	});
	element.addEventListener('mouseout', function () {
		setHoverState('element', false);
	});
};