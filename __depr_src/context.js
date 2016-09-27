'use strict'

var fs = require('fs');
var path = require('path');

var lens = require('./lens');

class Context
{
	constructor(path)
	{
		this.path = path;
	}
	
	resolve(id)
	{
		return path.resolve(this.path, id.replace('.', '/') + '.lens');
	}
	
	import(id, done)
	{
		return lens.eval(fs.readFileSync(this.resolve(id)), this, done);
	}
}

module.exports = Context;