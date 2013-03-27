var mage = require('../../mage');
var loggingService = mage.core.loggingService;


module.exports = loggingService.getCreator(true).context(mage.rootPackage.name);
