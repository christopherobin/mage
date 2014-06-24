var mageLoader = require('loader');
var page = mageLoader.renderPage('styleguide');

page.innerHTML = require('./page.html');
