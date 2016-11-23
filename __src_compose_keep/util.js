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
		var ct;
		var results = Array(values.length);
		if(!values || values.length == 0) callback(results);
		if(Array.isArray(values))
		{
			var len = values.length;
			ct = len;
			for(let i = 0; i < len; i++)
			{
				request(values[i], i);
			}
		}
		else if(values.next)
		{
			ct = 1;
			let i = 0;
			var entry;
			while(!(entry = values.next()).done)
			{
				ct++;
				request(entry.value, i++);
			}
			if(--ct == 0)
			{
				callback(results);
			}
		}
		else return values;
		
		function request(value, i)
		{
			mapper(value, (result) =>
			{
				results[i] = result;
				if(--ct == 0)
				{
					callback(results);
				}
			});
		}
	},
};