'use strict'

var util = require('./util');

// var request = require('request');

function repeat(rep, n)
{
	var str = '';
	while(--n >= 0)
	{
		str += rep;
	}
	return str;
}

module.exports = {
	'!': (v) => !v,
	'==': (a, b) => a === b,
	'!=': (a, b) => a !== b,
	'>': (a, b) => a > b,
	'<': (a, b) => a < b,
	'>=': (a, b) => a >= b,
	'<=': (a, b) => a <= b,
	'&&': (a, b) => a && b,
	'||': (a, b) => a || b,
	'+'(a, b) {return arguments.length == 1 ? +a : a + b},
	'-'(a, b) {return arguments.length == 1 ? -b : b - b},
	'*': (a, b) => typeof a === 'string' ? repeat(a, b) : typeof b === 'string' ? repeat(b, a) : a * b,
	'/': (a, b) => a / b,
	'%': util.async(function(args, done, scope)
	{
		var a = args[0], b = args[1];
		if(typeof b === 'function')
		{
			util.invoke(b, a, [a], done, scope);
		}
		else
		{
			done(a % b);
		}
	}),
	'<>'(a, b)
	{
		var list = [];
		for(var i = a; i <= b; i++)
		{
			list.push(i);
		}
		return list;
	},
	'>>'(a, b)
	{
		var list = [];
		for(var i = a; i < b; i++)
		{
			list.push(i);
		}
		return list;
	},
	'^': util.async(function(args, done, scope)
	{
		var target = args[0], transform = args[1];
		var i = 0;
		util.all(target, (value, done) => transform([value, i++], done), done);
	}),
	'~': util.async(function(args, done, scope)
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
	}),
	'^^': util.async(function(args, done, scope)
	{
		var target = args[0], transform = args[1];
		var i = 0;
		reduce(target[i]);
		function reduce(value)
		{
			i++;
			if(i >= target.length) return done(value);
			
			util.invoke(transform, value, [value, target[i]], reduce);
		}
	}),
	scope: util.async(function(args, done, scope)
	{
		done(args.length ? scope[args[0]] : scope);
	}),
	sleep: util.async(function(args, done)
	{
		setTimeout(() => done(args[1]), args[0]);
	}),
	Debug:
	{
		log()
		{
			console.log.apply(console, arguments);
			return arguments[0];
		},
		break: util.async(function(args, done, scope)
		{
			console.log.apply(null, args);
			console.log('Scope: ', scope);
		}),
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
	Object, JSON, Math,
}