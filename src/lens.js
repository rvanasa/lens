'use strict'

var Lens =
{
	util: require('./util'),
	parser: require('./parser'),
	lib: require('./lib'),
	parse(data)
	{
		data = String(data);
		
		var result = Lens.parser.parse(data);
		if(!result.status)
		{
			var nearby = data.substr(result.index.offset, 1);
			throw new Error(`Unexpected ${nearby.length ? 'symbol ' + nearby : 'end of script'} (line ${result.index.line}, col ${result.index.column})`);
		}
		
		return {
			ast: result.value,
			eval(env, done)
			{
				var scope = Object.create(null);
				
				var exported = false;
				var result = undefined;
				
				Object.assign(scope, env.lib || Lens.lib, {
					env,
					ast: this.ast,
					'import': Lens.util.async((args, done) => env.import(args[0], done)),
					'export': (value) => (exported = true) && (result = value),
				});
				
				this.ast.eval(scope, (value) => done(exported ? result : value));
			}
		}
	},
	eval(data, env, done)
	{
		return Lens.parse(data).eval(env, done);
	},
};

module.exports = Lens;