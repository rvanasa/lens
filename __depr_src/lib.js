'use strict'

var request = require('request');

module.exports = {
	scope(args, done, scope)
	{
		done(scope);
	},
	sleep(args, done)
	{
		setTimeout(() => done(args[1]), args[0]);
	},
	Debug:
	{
		log(args, done)
		{
			console.log.apply(null, args);
			done(args[0]);
		},
		break(args, done, scope)
		{
			console.log.apply(null, args);
			console.log('Scope: ', scope);
		},
	},
	HTTP:
	{
		get(args, done)
		{
			request.get(args[0], (err, res, body) =>
			{
				if(err) throw err;
				done(res, body);
			});
		},
	},
	JSON:
	{
		parse(args, done)
		{
			done(JSON.parse.apply(this, args));
		},
	},
}