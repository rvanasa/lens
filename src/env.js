'use strict'

var fs = require('fs');
var path = require('path');

var lens = require('./lens');

class Environment
{
	constructor(path)
	{
		this.path = path;
		
		this.imports = [];
	}
	
	resolve(id)
	{
		return path.resolve(this.path, id.replace(/\./g, '/') + '.lens');
	}
}

Environment.prototype.import = lens.util.async(function(args, done)
{
	var id = args[0];
	if(typeof id !== 'string') id = id.join('.');
	
	var resource = this.imports[id];
	if(!resource)
	{
		resource = lens.eval(fs.readFileSync(this.resolve(id)), this, done);
		this.imports[id] = resource;
	}
	else
	{
		done(resource);
	}
	return resource;
});

module.exports = Environment;