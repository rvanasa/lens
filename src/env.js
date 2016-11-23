'use strict'

var fs = require('fs');
var path = require('path');

var lens = require('./lens');

module.exports = function(dir)
{
	var imports = [];
	
	function resolveImport(id)
	{
		return path.resolve(dir, id.replace(/\./g, '/') + '.lens');
	}
	
	this.import = lens.util.async(function(args, done)
	{
		var id = args[0];
		if(typeof id !== 'string') id = id.join('.');
		
		var resource = imports[id];
		if(!resource)
		{
			resource = lens.eval(fs.readFileSync(resolveImport(id)), this).then(done, done);
			imports[id] = resource;
		}
		else
		{
			done(resource);
		}
		return resource;
	});
};