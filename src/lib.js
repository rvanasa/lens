'use strict'

var util = require('./util');

// var request = require('request');

module.exports = {
	'!': util.sync((v) => !v),
	'==': util.sync((a, b) => a === b),
	'!=': util.sync((a, b) => a !== b),
	'>': util.sync((a, b) => a > b),
	'<': util.sync((a, b) => a < b),
	'>=': util.sync((a, b) => a >= b),
	'<=': util.sync((a, b) => a <= b),
	'+': function(args, done) {done(args.length == 1 ? +args[0] : args[0] + args[1])},
	'-': function(args, done) {done(args.length == 1 ? -args[0] : args[0] - args[1])},
	'*': util.sync((a, b) => a * b),
	'/': util.sync((a, b) => a / b),
	'%': function(args, done, scope)
	{
		var a = args[0], b = args[1];
		if(typeof b === 'function')
		{
			b.call(a, [a], done, scope);
		}
		else
		{
			done(a % b);
		}
	},
	'<>': function(args, done)
	{
		var a = args[0], b = args[1];
		var list = [];
		for(var i = a; i <= b; i++)
		{
			list.push(i);
		}
		done(list);
	},
	'>>': function(args, done)
	{
		var a = args[0], b = args[1];
		var list = [];
		for(var i = a; i < b; i++)
		{
			list.push(i);
		}
		done(list);
	},
	'^': function(args, done, scope)
	{
		var target = args[0], transform = args[1];
		var i = 0;
		util.all(target, (value, done) => transform([value, i++], done), done);
	},
	'~': function(args, done, scope)
	{
		var target = args[0], transform = args[1];
		var i = 0;
		util.all(target, (value, done) => transform([value, i++], done), (flags) =>
		{
			var list = [];
			for(var i = 0; i < flags.length; i++)
			{
				if(flags[i])
				{
					list.push(target[i]);
				}
			}
			done(list);
		});
	},
	'^^': function(args, done, scope)
	{
		var target = args[0], transform = args[1];
		var i = 0;
		reduce(target[i]);
		function reduce(value)
		{
			i++;
			if(i >= target.length) return done(value);
			
			transform([value, target[i]], reduce);
		}
	},
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
	// HTTP:
	// {
	// 	get(args, done)
	// 	{
	// 		request.get(args[0], (err, res, body) =>
	// 		{
	// 			if(err) throw err;
	// 			done(res, body);
	// 		});
	// 	},
	// },
	JSON:
	{
		parse(args, done)
		{
			done(JSON.parse.apply(this, args));
		},
	},
}