'use strict'

var fs = require('fs');
var path = require('path');

var lens = require('./lens');

module.exports = function(dir)
{
	this.imports = [];
	
	function resolveImport(id)
	{
		return path.resolve(dir, id.replace(/\./g, '/') + '.lens');
	}
	
	this.import = lens.util.async(function(args, done)
	{
		var id = args[0];
		if(typeof id !== 'string') id = id.join('.');
		
		var cache = this.imports[id];
		if(!cache)
		{
			var raw = fs.readFileSync(resolveImport(id)).toString();
			cache = {
				promise: lens.eval(raw, this),
				raw,
			}
			this.imports[id] = cache;
		}
		cache.promise.then(done, done);
	});
};