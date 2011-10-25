(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('appleAppStore', mod);


	mod.purchaseWithReceipt = function (receiptData, cb) {
		mithril.io.send('appleAppStore.purchaseWithReceipt', { receipt: receiptData }, cb);
	};

}());
