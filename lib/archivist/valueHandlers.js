
var valueHandlers = {};  // { vaultName: { topic: { key: function(){} }, topic: {}, topic: {} }, .. }


function getVaultTopics(vaultName) {
	if (valueHandlers[vaultName]) {
		return Object.keys(valueHandlers[vaultName]);
	}

	return [];
}


function requestHandler(vaultName, topic) {
	// creates an empty handler if it doesn't yet exist

	if (!valueHandlers[vaultName]) {
		valueHandlers[vaultName] = {};
	}

	if (!valueHandlers[vaultName][topic]) {
		valueHandlers[vaultName][topic] = {};
	}

	return valueHandlers[vaultName][topic];
}


exports.getHandler = function (vaultName, topic) {
	return valueHandlers[vaultName] && valueHandlers[vaultName][topic];
};


exports.setValueHandlersForVaultAndTopic = function (vaultName, topic, addedHandlers, overwriteExisting) {
	if (!addedHandlers) {
		return;
	}

	var handlersForTopic = requestHandler(vaultName, topic);

	if (typeof addedHandlers === 'object') {
		for (var apiName in addedHandlers) {
			if (overwriteExisting || !handlersForTopic[apiName]) {
				handlersForTopic[apiName] = addedHandlers[apiName];
			}
		}
	}
};


exports.addDefaultHandlersForVault = function (vaultName, defaultHandlers) {
	var topics = getVaultTopics(vaultName);

	for (var i = 0; i < topics.length; i++) {
		exports.setValueHandlersForVaultAndTopic(vaultName, topics[i], defaultHandlers, false);
	}
};


exports.registerValueHandlersForTopic = function (topic, vaults) {
	// { vaultName: { api }, vaultName: { api } }

	for (var vaultName in vaults) {
		exports.setValueHandlersForVaultAndTopic(vaultName, topic, vaults[vaultName], true);
	}
};
