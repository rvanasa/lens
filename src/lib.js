'use strict'

var util = require('./util');

// var request = require('request');

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
	'&': (a, b) => a !== undefined ? (b !== undefined ? [a, b] : b) : a,
	'|': (a, b) => a !== undefined ? a : (b !== undefined ? b : a),
	'+'(a, b) {return arguments.length == 1 ? +a : a + b},
	'-'(a, b) {return arguments.length == 1 ? -a : a - b},
	'*': (a, b) => a * b,
	'**': (a, b) => Math.pow(a, b),
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
	'|<': Math.max,
	'|>': Math.min,
	'::': (a, b) => [].concat(a !== undefined ? a : [], b !== undefined ? b : []),
	'<>'(a, b)
	{
		var list = [];
		for(var i = a; i <= b; i++)
		{
			list.push(i);
		}
		return list;
	},
	'<<'(a, b)
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
			
			util.invoke(transform, value, [value, target[i]], reduce, scope);
		}
	}),
	select: util.async(function(args, done, scope)
	{
		var target = args[0], select = args[1];
		var i = 0;
		var selected = 0;
		step(target[i]);
		function step(bool)
		{
			if(bool) selected = i;
			
			i++;
			if(i >= target.length) return done(selected);
			
			util.invoke(select, null, [target[selected], target[i]], step, scope);
		}
	}),
	len: (value) => value.length,
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
	permute: function*(list) {yield* permute(list, 0)},
	zip(a, b)
	{
		var length = Math.max(a.length, b.length);
		var array = [];
		for(var i = 0; i < length; i++)
		{
			array[i] = [a[i], b[i]];
		}
		return array;
	},
	Object, Error, JSON, Math,
}

function* permute(list, index)
{
	if(index >= list.length - 1)
	{
		yield list;
	}
	else
	{
		yield* permute(list, index + 1);
		for(var i = index + 1; i < list.length; i++)
		{
			var j = index;
			var prev = list[j];
			
			list[j] = list[i];
			list[i] = prev;
			
			yield* permute(list, index + 1);
			
			list[i] = list[j];
			list[j] = prev;
		}
	}
}