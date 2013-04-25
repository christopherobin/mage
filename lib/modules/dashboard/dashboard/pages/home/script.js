(function () {

	// this is the dashboard

	var mage = window.mage;

	mage.loader.once('home.display', function () {
		var buttons = document.getElementsByTagName('button');

		function greet() {
	//		alert('Hello!')
		}

		for (var i = 0; i < buttons.length; i++) {
			var button = buttons[i];

			button.onclick = greet;
		}
	});

}());