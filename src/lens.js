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
			eval(context)
			{
				var scope = Object.create(null);
				
				Object.assign(scope, Lens.lib, {
					ast: this.ast,
				}, context);
				
				return new Promise((resolve, reject) => this.ast.eval(scope, resolve));
			}
		};
	},
	eval(data, context)
	{
		if(!data) return Promise.resolve();
		
		return Lens.parse(data).eval(context);
	},
};

module.exports = Lens;