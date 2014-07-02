exports.access = 'user';
exports.params = ['userId', 'amount'];

exports.execute = function (state, userId, amount, callback) {
	state.archivist.get('inventory', {
		userId: userId
	}, {}, function (error, data) {
		if (error) {
			return callback(error);
		}

		data.set('money', data.money + amount);

		console.log(data);
		console.log(data.money.valueOf());

		state.respond();
		callback();
	});
};
