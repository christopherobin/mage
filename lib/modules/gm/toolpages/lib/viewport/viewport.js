/*
 * Dependency: 
 * - events:EventManager (mandatory)
 * - nav:Navigation (optional)
 * - screenSize: {height, width} (optional)
 * - canvas:DomElement (optional)
 */

//function Viewport(options) {
(function () {
	
	var viewport = {};
	
	if (!window.viewport) {
		window.viewport = viewport;
	}
	
	var events = (typeof EventManager !== 'undefined') ? new EventManager() : null;
	
	var nav = null;
	var canvas = document;
	var screenSize = { height: window.innerHeight, width: window.innerWidth };
	
	
	viewport.setup = function (options) {
		options = options || {};
		nav = options.nav || nav;
		canvas = options.canvas || canvas;
		screenSize = options.screenSize || screenSize;
	};
	
	var viewHandler = {};
	var current = null;
	var changing = false;
	var popupDisplaying = false;
	var popupStack = [];

	viewport.events = events;
	viewport.views = viewHandler;
	viewport.currentName = null;
	viewport.currentParams = null;
	viewport.currentView = null;
	var scrollYOffset = 0;

	viewport.getViewElement = function (name) {
		var elm = document.querySelector('.view[data-name="' + name + '"]');
		if (!elm) {
			throw ('View element not found for "' + name + '"');
		}
		return elm;
	};

	/*
	 * Receive: { name:String, obj:ViewClass, elm:ViewDom}
	 */
	viewport.setViewHandler = function (options) {
		viewHandler[options.name] = options;
	};

	// single view effects

	var showViewEffect = function (elm, fromClassName, toClassName, endCb) {
		elm.addEventListener('webkitTransitionEnd', function () {
			elm.removeEventListener('webkitTransitionEnd', arguments.callee, false);
			elm.delClassName(fromClassName, toClassName);
			if (endCb) {
				endCb();
			}
		}, false);

		elm.addClassName('visible', fromClassName);
		window.setTimeout(function () {
			elm.replaceClassNames([fromClassName], [toClassName]);
		}, 20);
	};


	var hideViewEffect = function (elm, fromClassName, toClassName, endCb) {
		elm.addEventListener('webkitTransitionEnd', function () {
			elm.removeEventListener('webkitTransitionEnd', arguments.callee, false);
			elm.delClassName(fromClassName, toClassName, 'visible');
			if (endCb) {
				endCb();
			}
		}, false);

		elm.addClassName(fromClassName);
		window.setTimeout(function () {
			elm.replaceClassNames([fromClassName], [toClassName]);
		}, 20);
	};

	var viewFadeOut = function (view, endCb) {
		hideViewEffect(view.elm, 'fadedin', 'fadedout', endCb);
	};

	var viewFadeIn = function (view, endCb) {
		showViewEffect(view.elm, 'fadedout', 'fadedin', endCb);
	};

	var hideView = function (elm) {
		elm.delClassName('visible');
	};

	var showView = function (elm) {
		elm.addClassName('visible');
	};

	// transition effects from view, to view

	var transitionPlain = function (from, to, endCb) {
		if (from) {
			hideView(from.elm);
		}
		showView(to.elm);
		endCb();
	};


	var transitionCrossFade = function (from, to, endCb) {
		if (from) {
			viewFadeOut(from);
		}

		viewFadeIn(to, endCb);
	};


	var transitionFade = function (from, to, endCb) {
		if (from) {
			viewFadeOut(from, function () {
				viewFadeIn(to, endCb);
			});
		} else {
			viewFadeIn(to, endCb);
		}
	};


	var transitionSlide = function (from, to, direction, endCb) {
		var dirFrom = (direction === 'left') ? 'right' : 'left';
		var dirTo   = direction;

		var cb = function () {
			if (from) {
				from.elm.delClassName('slide');
			}
			to.elm.delClassName('slide');
			if (endCb) {
				endCb();
			}
		};

		if (from) {
			from.elm.addClassName('slide');
			to.elm.addClassName('slide');

			hideViewEffect(from.elm, 'center', dirTo);
			showViewEffect(to.elm, dirFrom, 'center', cb);
		} else {
			to.elm.addClassName('slide');
			showViewEffect(to.elm, dirFrom, 'center', cb);
		}
	};


	var transitionFlip = function (from, to, direction, endCb) {
		var dirFrom = (direction === 'left') ? 'right' : 'left';
		var dirTo   = direction;

		var cb = function () {
			if (from) {
				from.elm.delClassName('flip');
			}
			to.elm.delClassName('flip');
			if (endCb) {
				endCb();
			}
		};

		if (from) {
			hideViewEffect(from.elm, 'flip', 'flip' + dirTo);
			showViewEffect(to.elm, 'flip' + dirFrom, 'flip', cb);
		} else {
			showViewEffect(to.elm, 'flip' + dirFrom, 'flip', cb);
		}
	};


	var applyTransition = function (transition, from, to, endCb) {
		switch (transition)	{
		case 'fade':
			transitionFade(from, to, endCb);
			break;
		case 'crossfade':
			transitionCrossFade(from, to, endCb);
			break;
		case 'slideleft':
			transitionSlide(from, to, 'left', endCb);
			break;
		case 'slideright':
			transitionSlide(from, to, 'right', endCb);
			break;
		case 'flipleft':
			transitionFlip(from, to, 'left', endCb);
			break;
		case 'flipright':
			transitionFlip(from, to, 'right', endCb);
			break;
		default:
			transitionPlain(from, to, endCb);
			break;
		}
	};

	var navigate = function (name, params, options)	{
		options = options || {};
		params = params || {};

		if (changing || (current && current.name === name && isEqual(params, current.params) && !options.force)) {
			return false;
		}

		changing = true;

		var from = current;

		var to = { name: name, obj: viewHandler[name].obj, elm: viewHandler[name].elm, params: params };

		if (from && from.obj && from.obj.onclose) {
			from.obj.onclose.call(from.obj, from);
		}
		
		if (current && to.name === current.name) {
			options.transition = null;
		}

		if (events) {
			events.dispatch('beforechange', { from: from, to: to });
		}

		var endCb = function () {
			current = to;
			if (to.obj && to.obj.onafterpaint) {
				window.setTimeout(function () {
					to.obj.onafterpaint.call(to.obj, to);
				}, 0);
			}

			changing = false;

			if (events) {
				events.dispatch('afterchange', { from: from, to: to });
			}
		};

		if (to.obj && to.obj.onbeforepaint) {
			to.obj.onbeforepaint.call(to.obj, to);
		}

		applyTransition(options.transition, from, to, endCb);

		return true;
	};


	viewport.popup = function (name, params, options) {

		scrollYOffset = document.body.scrollTop;
		document.scrollToTop();
		options = options || {};
		params = params || {};
		
		if (popupDisplaying || (popupStack.indexOf(name) !== -1) || (current && current.name === name && isEqual(params, current.params))) {
			return false;
		}
		
		popupDisplaying = true;
		
		var to = { name: name, obj: viewHandler[name].obj, elm: viewHandler[name].elm, params: params };

		if (to.obj && to.obj.onbeforepaint) {
			to.obj.onbeforepaint.call(to.obj, to);
		}
		
		popupStack.push(name);
		
		applyTransition(options.transition, null, to, function () {
			if (to.obj && to.obj.onafterpaint) {
				window.setTimeout(function () {
					to.obj.onafterpaint.call(to.obj, to);
				}, 0);
			}
			popupDisplaying = false;
		});
		
		if (popupStack.length < 2) {
			viewHandler[name].elm.style.minHeight = screenSize.height + "px";
			canvas.style.height = screenSize.height + "px";
		}
		
		to.elm.addClassName('stack');
	};

	viewport.closePopup = function (name) {

		if (popupStack.length < 2) {
			canvas.style.height = "";
			document.body.scrollTop = scrollYOffset;
		}
		
		if (name) {
			if (viewHandler[name]) {
				popupStack = popupStack.filter(function (view) {
					return name !== view;
				});
				viewHandler[name].elm.delClassName(['visible', 'stack']);
			}
		} else {
			name = popupStack.pop();
			if (name && viewHandler[name]) {
				viewHandler[name].elm.delClassName(['visible', 'stack']);
			}
		}
		
		var view = viewHandler[name];
		if (view && view.obj && view.obj.onclose) {
			view.obj.onclose.call(view.obj, view);
		}
		
	};
	
	viewport.closeAllPopup = function () {
		var name = null;
		while (name = popupStack.pop()) {
			viewport.closePopup(name);
		}
	};


	viewport.change = function (name, params, options) {
		options = options || {};
		if (navigate(name, params, options)) {
			viewport.currentName = name;
			viewport.currentParams = params;
			viewport.currentView = viewHandler[name].elm;
			if (nav && !options.ignoreNavHistory) {
				if (!params) {
					params = {};
				}
				if (options.transition) {
					params.transition = options.transition;
				}
				nav.add(name, params);
			}
		}
	};


	viewport.replace = function (name, params, transition) {
		if (navigate(name, params, { transition: transition })) {
			if (nav) {
				nav.replace(name, params);
			}
		}
	};


	viewport.back = function (transition) {
		if (nav) {
			var view = nav.back();
			if (view) {
				navigate(view.name, view.params, { transition: transition });
			}
		}
	};


	viewport.refresh = function (transition) {
		if (nav) {
			var view = nav.current();
			if (view) {
				view.params.refresh = true;
				navigate(view.name, view.params, { transition: transition, force: true });
			}
		}
	};


	viewport.forward = function (transition) {
		if (nav) {
			var view = nav.forward();
			if (view) {
				navigate(view.name, view.params, { transition: transition });
			}
		}
	};


	if (nav) {
		nav.onback = nav.onforward = nav.onchange = function (name, params) {
			var transition = null;
			if (params && 'transition' in params) {
				transition = params.transition;
			}

			navigate(name, params, { transition: transition });
		};
	}

//}
}());
