var mageLoader = require('loader');

var page = mageLoader.displayPage('main');
page.innerHTML = require('./page.html');

