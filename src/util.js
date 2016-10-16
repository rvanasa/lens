'use strict'

var Resource = require('plasma').Resource;

module.exports =
{
	Resource,
	resolve(resource, done)
	{
		if(resource instanceof Resource)
		{
			resource.request(done);
		}
		else
		{
			done(resource);
		}
	},
	invoke(fn, self, args, done, scope)
	{
		if(fn.async)
		{
			fn.call(self, args, done, scope);
		}
		else
		{
			done(fn.apply(self, args));
		}
	},
	async(fn)
	{
		fn.async = true;
		return fn;
	},
	all(values, mapper, callback)
	{
		var results = [];
		var len = values.length;
		if(!len) callback(results);
		var ct = len;
		for(var i = 0; i < len; i++)
		{
			request(i);
		}
		function request(i)
		{
			var value = values[i];
			var flag = true;
			function done(value)
			{
				results[i] = value;
				if(flag && --ct == 0)
				{
					flag = false;
					callback(results);
				}
			}
			mapper(value, done);
		}
	},
};