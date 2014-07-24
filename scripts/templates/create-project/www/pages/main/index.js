var mageLoader = require('loader');

var page = mageLoader.renderPage('main');
page.innerHTML = require('./page.html');

mageLoader.displayPage('main');

