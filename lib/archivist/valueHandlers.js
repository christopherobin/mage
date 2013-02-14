
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
	var handlersForTopic = requestHandler(vaultName, topic);

	if (addedHandlers) {
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


exports.registerValueHandlers = function (handlers) {
	// { topic: { vaultName: { api }, vaultName: { api } }, topic: { vaultName: { api } } }

	for (var topic in handlers) {
		for (var vaultName in handlers[topic]) {
			exports.setValueHandlersForVaultAndTopic(vaultName, topic, handlers[topic][vaultName], true);
		}
	}
};
