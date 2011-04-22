function MithrilGameModGc(mithril)
{
	this.mithril = mithril;
}


MithrilGameModGc.prototype.setup = function()
{
};


MithrilGameModGc.prototype.loadNodes = function(options, cb)
{
	this.mithril.io.send('gc.loadNodes', options, function(result) {
		cb(result.errors, result.response);
	});
};

