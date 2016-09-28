'use strict'

var lens =
{
	util: require('./util'),
	parser: require('./parser'),
	lib: require('./lib'),
	Scope: require('./scope'),
	parse(data)
	{
		data = String(data);
		
		var result = lens.parser.parse(data);
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
				
				Object.assign(scope, env.lib || lens.lib, {
					env,
					ast: this.ast,
					'import': lens.util.async((args, done) => env.import(args[0], done)),
					'export': (value) => (exported = true) && (result = value),
				});
				
				this.ast.eval(scope, (value) => done(exported ? result : value));
			}
		}
	},
	eval(data, env, done)
	{
		return lens.parse(data).eval(env, done);
	},
};

module.exports = lens;