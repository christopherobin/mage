
exports.setup = function (name, tool, asset, cb) {
    var pagePath = __dirname + '/page';
    tool.addPage(name, pagePath, { assetMap: asset });
    cb();


};
