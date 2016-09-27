'use strict'

var parser = require('./parser');

var lib = require('./lib');
var util = require('./util');

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
			eval(env, done)
			{
				var scope = Object.create(null);
				
				var exported = false;
				var result = undefined;
				
				Object.assign(scope, lib, {
					env,
					ast: this.ast,
					'import': (args, done) => env.import(args[0], done),
					'export': util.sync((value) => (exported = true) && (result = value)),
				});
				
				this.ast.eval(scope, (value) => done(exported ? result : value));
			}
		}
	},
	eval(data, context, done)
	{
		return lens.parse(data).eval(context, done);
	},
};

module.exports = lens;