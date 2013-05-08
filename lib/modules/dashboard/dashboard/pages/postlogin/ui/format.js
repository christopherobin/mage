(function (window) {

	var mage = window.mage;


	function fileSize(bytes, useKibi) {
		var step = useKibi ? 1024 : 1000;
		var units = [
			'B',
			useKibi ? 'KiB' : 'KB',
			useKibi ? 'MiB' : 'MB',
			useKibi ? 'GiB' : 'GB',
			useKibi ? 'TiB' : 'TB'
		];

		var count = bytes, i = 0;

		while (count >= step) {
			count /= step;
			i += 1;
		}

		return (Math.round(count * 100) / 100) + ' ' + units[i];
	}


	mage.dashboard.ui.format = {
		fileSize: fileSize
	};

}(window));
