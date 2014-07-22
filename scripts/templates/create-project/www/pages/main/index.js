var mageLoader = require('loader');

mageLoader.displayPage('main');

var page = mageLoader.renderPage('main');
page.innerHTML = require('./page.html');

