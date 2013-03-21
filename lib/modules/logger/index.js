var mage = require('../../mage');
var loggingService = mage.core.loggingService;

// get a NEW INSTANCE of a LogCreator.

module.exports = loggingService.getCreator(true).context(mage.rootPackage.name);
