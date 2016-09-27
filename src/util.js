
module.exports =
{
	sync(handler)
	{
		return function(args, done, scope)
		{
			done(handler.apply(this, args));
		}
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