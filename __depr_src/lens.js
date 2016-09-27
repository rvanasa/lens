'use strict'

var parser = require('./parser');

var lib = require('./lib');

var lens =
{
	parse(data)
	{
		data = String(data);
		
		var result = parser.parse(data);
		if(!result.status)
		{
			var nearby = data.substr(result.index.offset, 1);
			throw new Error(`Unexpected symbol '${nearby}' (line ${result.index.line}, col ${result.index.column})`);
		}
		
		return {
			ast: result.value,
			eval(context, done)
			{
				var scope = Object.create(null);
				Object.assign(scope, lib);
				
				scope.context = context;
				
				var exported = false;
				var result = undefined;
				
				Object.assign(scope, {
					'import': (args, done) => context.import(args[0], done),
					'export': lens.sync((value) => (exported = true) && (result = value)),
					'!': lens.sync((v) => !v),
					'==': lens.sync((a, b) => a === b),
					'!=': lens.sync((a, b) => a !== b),
					'>': lens.sync((a, b) => a > b),
					'<': lens.sync((a, b) => a < b),
					'>=': lens.sync((a, b) => a >= b),
					'<=': lens.sync((a, b) => a <= b),
					'+': lens.sync((a, b) => a + b),
					'-': function(args, done) {done(args.length == 1 ? -args[0] : args[0] - args[1])},
					'*': lens.sync((a, b) => a * b),
					'/': lens.sync((a, b) => a / b),
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
					}
				});
				
				this.ast.eval(scope, (value) => done(exported ? result : value));
			}
		}
	},
	eval(data, context, done)
	{
		return lens.parse(data).eval(context, done);
	},
	sync(handler)
	{
		return function(args, done, scope)
		{
			done(handler.apply(this, args));
		}
	},
};

module.exports = lens;