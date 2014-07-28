module.exports = {
	copy: copy,
	isFunction: isFunction,
	isWorker: isWorker
}

function isFunction(func) {
	return typeof func === 'function';
}

function copy(obj) {
	if (typeof obj !== 'object') {
		return obj;
	}
	var cpy = obj instanceof Array ? [] : {};
	for (var key in obj) {
		cpy[key] = copy(obj[key]);
	}
	return cpy;
}

function isWorker() {
	return !global.document;
}
