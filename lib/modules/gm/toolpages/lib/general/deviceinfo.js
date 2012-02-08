function DeviceInfo() {
	this.able = {};
	this.issues = {};
	this.inIframe = (top !== window);

	var ua = window.navigator.userAgent.toLowerCase();


	this.versionCompare = function (a, b) {
		a = a.split('.');
		b = b.split('.');

		var minLength = Math.min(a.length, b.length);

		for (var i = 0; i < minLength; i++) {
			var va = a.shift();
			var vb = b.shift();

			if (va === vb) {
				continue;
			}

			while (va.length > 0 || vb.length > 0) {
				var na = va.match(/^0*([0-9]+)/);
				var nb = vb.match(/^0*([0-9]+)/);

				if (na) {
					va = va.substring(na[0].length);
				}
				if (nb) {
					vb = vb.substring(nb[0].length);
				}

				na = na ? parseInt(na[1], 10) : 0;
				nb = nb ? parseInt(nb[1], 10) : 0;

				if (na !== nb) {
					return (na < nb) ? -1 : 1;
				}

				// both numeric versions equal, check non-numeric part

				na = va.match(/^([^0-9]+?)/);
				nb = vb.match(/^([^0-9]+?)/);

				if (na) {
					va = va.substring(na[0].length);
				}
				if (nb) {
					vb = vb.substring(nb[0].length);
				}

				na = na ? na[1] : '';
				nb = nb ? nb[1] : '';

				if (na !== nb) {
					return (na < nb) ? -1 : 1;
				}
			}
		}

		if (a.length === b.length) {
			return 0;
		}

		return (a.length < b.length) ? -1 : 1;
	};


	this.getWebKitVersion = function () {
		var m = ua.match(/(applewebkit\/)([0-9]+(?:\.[0-9]*)*)/);
		if (m) {
			return m[2];
		}
		return false;
	};


	this.isIOS = function () {
		return (ua.indexOf('iphone') > -1 || ua.indexOf('ipod') > -1 || ua.indexOf('ipad') > -1);
	};


	this.isAndroid = function () {
		return (ua.indexOf('android') > -1);
	};


	this.isMinWebKitVersion = function (version) {
		return (this.versionCompare(this.getWebKitVersion(), version) >= 0);
	};


	this.getIOSVersion = function () {
		if (!this.isIOS()) {
			return false;
		}

		var m = ua.match(/os ([0-9]+(_[0-9]+)*)/);
		if (m) {
			return m[1].replace(/_/g, '.');
		}
		return false;
	};


	this.getAndroidVersion = function () {
		var m = ua.match(/android ([0-9]+(\.[0-9]+)?)/);
		if (m) {
			return m[1];
		}
		return false;
	};


	// define able

	if (this.isIOS()) {
		var version = this.getIOSVersion();

		if (version === '4.1' && this.inIframe) {
			this.issues.TOUCHSTART_TOUCHEND_BUG = true;
		}

		this.able.transform3d = true;
		this.able.multiTouch = true;
		this.able.hwAcceleration = true;
	} else {
		if (this.isAndroid()) {
			this.able.multiTouch = true;
		} else {
			// consider this a desktop browser
			this.able.hwAcceleration = true;
		}
	}
}

