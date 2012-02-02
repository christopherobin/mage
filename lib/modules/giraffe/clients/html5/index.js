(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.giraffe.construct'));

	mod.tokenData = null;	// used to override token values for testing purposes


	// sha256 hash generation

	function sha256(subject) {
		var chrsz = 8;

		function safeAdd(x, y) {
			var lsw = (x & 0xFFFF) + (y & 0xFFFF);
			var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
			return (msw << 16) | (lsw & 0xFFFF);
		}

		function s(x, n) {
			return (x >>> n) | (x << (32 - n));
		}

		function ch(x, y, z) {
			return (x & y) ^ ((~x) & z);
		}

		function maj(x, y, z) {
			return (x & y) ^ (x & z) ^ (y & z);
		}

		function sigma0256(x) {
			return s(x, 2) ^ s(x, 13) ^ s(x, 22);
		}

		function sigma1256(x) {
			return s(x, 6) ^ s(x, 11) ^ s(x, 25);
		}

		function gamma0256(x) {
			return s(x, 7) ^ s(x, 18) ^ (x >>> 3);
		}

		function gamma1256(x) {
			return s(x, 17) ^ s(x, 19) ^ (x >>> 10);
		}

		function coreSha256(m, l) {
			var k = [0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0xFC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x6CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2];
			var hash = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19];
			var w = [64];
			var a, b, c, d, e, f, g, h, i, j, len;
			var t1, t2;

			m[l >> 5] |= 0x80 << (24 - l % 32);
			m[((l + 64 >> 9) << 4) + 15] = l;

			for (i = 0, len = m.length; i < len; i += 16) {
				a = hash[0];
				b = hash[1];
				c = hash[2];
				d = hash[3];
				e = hash[4];
				f = hash[5];
				g = hash[6];
				h = hash[7];

				for (j = 0; j < 64; j++) {
					if (j < 16) {
						w[j] = m[j + i];
					} else {
						w[j] = safeAdd(safeAdd(safeAdd(gamma1256(w[j - 2]), w[j - 7]), gamma0256(w[j - 15])), w[j - 16]);
					}

					t1 = safeAdd(safeAdd(safeAdd(safeAdd(h, sigma1256(e)), ch(e, f, g)), k[j]), w[j]);
					t2 = safeAdd(sigma0256(a), maj(a, b, c));

					h = g;
					g = f;
					f = e;
					e = safeAdd(d, t1);
					d = c;
					c = b;
					b = a;
					a = safeAdd(t1, t2);
				}

				hash[0] = safeAdd(a, hash[0]);
				hash[1] = safeAdd(b, hash[1]);
				hash[2] = safeAdd(c, hash[2]);
				hash[3] = safeAdd(d, hash[3]);
				hash[4] = safeAdd(e, hash[4]);
				hash[5] = safeAdd(f, hash[5]);
				hash[6] = safeAdd(g, hash[6]);
				hash[7] = safeAdd(h, hash[7]);
			}

			return hash;
		}

		function str2binb(str) {
			var bin = [];
			var mask = (1 << chrsz) - 1;

			for (var i = 0, len = str.length * chrsz; i < len; i += chrsz) {
				bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i % 32);
			}

			return bin;
		}

		function utf8Encode(str) {
			str = str.replace(/\r\n/g, '\n');
			var utftext = '';

			for (var n = 0, len = str.length; n < len; n++) {
				var c = str.charCodeAt(n);

				if (c < 128) {
					utftext += String.fromCharCode(c);
				} else if (c > 127 && c < 2048) {
					utftext += String.fromCharCode((c >> 6) | 192);
					utftext += String.fromCharCode((c & 63) | 128);
				} else {
					utftext += String.fromCharCode((c >> 12) | 224);
					utftext += String.fromCharCode(((c >> 6) & 63) | 128);
					utftext += String.fromCharCode((c & 63) | 128);
				}
			}

			return utftext;
		}

		function binb2hex(binarray) {
			var hex = '0123456789abcdef';
			var str = '';

			for (var i = 0, len = binarray.length * 4; i < len; i++) {
				var n = binarray[i >> 2];

				str += hex.charAt((n >> ((3 - i % 4) * 8 + 4)) & 0xF) + hex.charAt((n >> ((3 - i % 4) * 8)) & 0xF);
			}

			return str;
		}

		subject = utf8Encode(subject);

		return binb2hex(coreSha256(str2binb(subject), subject.length * chrsz));
	}


	// giraffe hash generation

	function randomInt() {
		return (Math.random() * 0xFFFFFFFF) >>> 0;
	}


	function generateHash(message) {
		var data = mod.tokenData;

		var userId = data.giraffeUserId;
		var tokenSecret = data.access_secret;

		var nonce = '' + randomInt() + randomInt() + randomInt() + randomInt();
		var timestamp = (Date.now() / 1000) >>> 0;
		var hash = sha256(tokenSecret + nonce + timestamp + message);

		return {
			userId: userId,
			nonce: nonce,
			timestamp: timestamp,
			hash: hash
		};
	}


	// the command hook for doing user commands with giraffe auth

	mithril.io.registerCommandHook('giraffe', function (messageData) {
		var info = generateHash(messageData);

		return { nonce: info.nonce, timestamp: info.timestamp, hash: info.hash, userId: info.userId };
	});


	// retrieving token data

	function getTokenData(cb) {
		if (mod.tokenData) {
			return cb(null, mod.tokenData);
		}

		var giraffePlugin = window.giraffe;

		if (!giraffePlugin) {
			console.error('Giraffe plugin missing, unable to authenticate.');
			return cb('fatal');
		}

		giraffePlugin.authenticateAndGetTokens(
			function (data) {
				// success callback

				mod.tokenData = data;
				cb();
			},
			function (error) {
				// error callback

				console.error('Giraffe authentication failed.', error);
				cb('auth');
			}
		);
	}


	// requestSession asks the mithril server to generate a session ID for this user

	function requestSession(cb) {
		var userId = mod.tokenData.giraffeUserId;

		var info = generateHash('giraffeUserId=' + userId);

		mod.getSession(info.userId, info.nonce, info.timestamp, info.hash, function (error, sessionId) {
			if (error) {
				return cb(error);
			}

			mithril.session.setSessionKey(sessionId);
			cb();
		});
	}


	// the authenticate function will ask giraffe to provide token data, after which that will be used to
	// request a mithril session to be started.

	mod.authenticate = function (cb) {
		getTokenData(function (error) {
			if (error) {
				return cb(error);
			}

			requestSession(cb);
		});
	};

}());
