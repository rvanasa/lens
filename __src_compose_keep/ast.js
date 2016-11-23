'use strict'

var Resource = require('plasma').Resource;

var util = require('./util');
var Scope = require('./scope');

var builders = {};
var composers = {};

register({
	id: 'literal',
	props: ['value'],
	compose(ast, context)
	{
		return ast.value === undefined ? 'undefined' : JSON.stringify(ast.value(context));
	}
});

register({
	id: 'ident',
	props: ['value'],
	compose(ast, context)
	{
		return escapeIdent(ast.value(context));
	}
});

register({
	id: 'opr',
	props: ['value'],
	compose: composers['ident']
});

register({
	id: 'tuple',
	props: ['args'],
	compose(ast, context)
	{
		return '[' + ast.args(context).join(',') + ']';
	}
});

register({
	id: 'closure',
	props: ['exp'],
	compose(ast, context)
	{
		return 'function($AT, $HASH){return ' + ast.exp(context) + '}';
	}
});

register({
	id: 'target',
	props: ['base', 'exp'],
	compose(ast, context)
	{
		return ast.base(context) + '.' + ast.exp(context);
	}
});

register({
	id: 'indexer',
	props: ['base', 'exp'],
	compose(ast, context)
	{
		return ast.base(context) + '[' + ast.exp(context) + ']';
	}
});

register({
	id: 'invoke',
	props: ['target', 'args'],
	compose(ast, context)
	{
		return ast.target(context) + '(' + ast.args(context).join(',') + ')';
	}
});

register({
	id: 'block',
	props: ['body'],
	compose(ast, context)
	{
		return ast.body(context);
	}
});

register({
	id: 'multi',
	props: ['list'],
	compose(ast, context)
	{
		return ast.list(context).join(';');
	}
});

register({
	id: 'conditional',
	props: ['condition', 'trueValue', 'falseValue'],
	compose(ast, context)
	{
		return ast.condition(context) + '?' + ast.trueValue(context) + ':' + ast.falseValue(context);
	}
});

register({
	id: 'anonymous',
	props: ['symbol', 'target'],
	compose(ast, context)
	{
		var target = ast.target(context);
		return escapeIdent(ast.symbol(context)) + (target ? '.' + target : '');
	}
});

register({
	id: 'route',
	props: ['nodes'],
	compose(ast, context)
	{
		var target = ast.target(context);
		return escapeIdent(ast.symbol(context)) + (target ? '.' + target : '');
	}
});

var AST =
{
	route(nodes)
	{
		return {
			nodes,
			eval(scope, done)
			{
				evalList(scope, nodes, done);
			}
		}
	},
	basicRouteExp(text)
	{
		return {
			text,
			eval(scope, done)
			{
				done(text);
			}
		}
	},
	assign(id, exp)
	{
		return {
			id, exp,
			eval(scope, done)
			{
				if(exp._type === 'literal')
				{
					resource = exp.value;
				}
				else
				{
					var resource = new Resource((resolve) =>
					{
						exp.eval(scope, resolve);
					});
					resource.id = id;
				}
				
				add(scope, id, resource);
				// resource.request(done, (err) => done(err instanceof Error ? err : new Error(err)));
				
				done(resource);
			}
		};
	},
	functionDef(id, pattern, exp)
	{
		return {
			id, pattern, exp,
			eval(scope, done)
			{
				var fn = util.async(function(args, done)
				{
					var fnScope = Scope.create(scope);
					pattern.setup(fnScope, args);
					exp.eval(fnScope, done);
				});
				fn.pattern = pattern;
				fn.ast = this;
				
				if(id)
				{
					if(id in scope)
					{
						var first = scope[id];
						var next = fn;
						fn = util.async(function(args, done, scope)
						{
							if(first.pattern && first.pattern.validate(scope, args))
							{
								util.invoke(first, this, args, done, scope);
							}
							else
							{
								util.invoke(next, this, args, done, scope);
							}
						})
						fn.pattern = AST.orPattern(first.pattern, next.pattern);
					}
					add(scope, id, fn);
				}
				done(fn);
			}
		};
	},
	export(exp)
	{
		return {
			exp,
			eval(scope, done)
			{
				exp.eval(scope, (value) =>
				{
					util.invoke(scope.export, scope, [value], done);
				});
			}
		};
	},
	composure(target, nodes)
	{
		return {
			target, nodes,
			eval(scope, done)
			{
				for(var i = 0; i < nodes.length; i++)
				{
					var node = nodes[i];
					var path = node[0];
					var alias = node[1];
					
					var id = alias || (typeof path === 'string' ? path : path[path.length - 1]);
					
					var resource = new Resource((resolve) =>
					{
						target.eval(scope, (fn) =>
						{
							util.invoke(fn, scope, [path, alias, scope], resolve);
						});
					});
					resource.id = id;
					add(scope, id, resource);
					
					resource.request();
				}
				done();
			}
		};
	},
	basicPattern(id)
	{
		return {
			id,
			validate(scope, value)
			{
				return true;
			},
			setup(scope, value)
			{
				add(scope, id, value);
			},
			toString()
			{
				return id;
			}
		};
	},
	emptyPattern()
	{
		return {
			validate(scope, value)
			{
				return true;
			},
			setup(scope, value)
			{
			},
			toString()
			{
				return '()';
			}
		};
	},
	literalPattern(literal)
	{
		return {
			literal,
			validate(scope, value)
			{
				return value == literal;
			},
			setup(scope, value)
			{
			},
			toString()
			{
				return JSON.stringify(literal);
			}
		};
	},
	tuplePattern(list)
	{
		return {
			list,
			validate(scope, value)
			{
				if(typeof value !== 'object') return false;
				for(var i = 0; i < list.length; i++)
				{
					if(!list[i].validate(scope, value[i])) return false;
				}
				return true;
			},
			setup(scope, value)
			{
				for(var i = 0; i < list.length; i++)
				{
					list[i].setup(scope, value[i]);
				}
			},
			toString()
			{
				return '(' + list.join(', ') + ')';
			}
		};
	},
	andPattern(a, b)
	{
		return {
			a, b,
			validate(scope, value)
			{
				return a.validate(scope, value) && b.validate(scope, value);
			},
			setup(scope, value)
			{
				a.setup(scope, value);
			},
			toString()
			{
				return a + ' & ' + b;
			}
		};
	},
	orPattern(a, b)
	{
		return {
			a, b,
			validate(scope, value)
			{
				return a.validate(scope, value) || b.validate(scope, value);
			},
			setup(scope, value)
			{
				(a.validate(scope, value) ? a : b).setup(scope, value);
			},
			toString()
			{
				return a + ' | ' + b;
			}
		};
	},
	routePattern(nodes)
	{
		return {
			nodes,
			validate(scope, value)
			{
				if(typeof value === 'string') value = value.replace(/^\//, '').split('/');
				
				if(typeof value !== 'object' || nodes.length < value.length) return false;
				for(var i = 0; i < nodes.length; i++)
				{
					if(!nodes[i].validate(scope, value[i])) return false;
				}
				return true;
			},
			setup(scope, value)
			{
				if(typeof value === 'string') value = value.replace(/^\//, '').split('/');
				
				for(var i = 0; i < nodes.length; i++)
				{
					nodes[i].setup(scope, value[i]);
				}
			},
			toString()
			{
				return '(' + nodes.join(', ') + ')';
			}
		};
	},
	basicRoutePattern(text)
	{
		return {
			text,
			validate(scope, value)
			{
				return true;
			},
			setup(scope, value)
			{
			},
			toString()
			{
				return text;
			}
		};
	},
	variableRoutePattern(id)
	{
		return {
			id,
			validate(scope, value)
			{
				return true;
			},
			setup(scope, value)
			{
				add(scope, id, value)
			},
			toString()
			{
				return ':' + id;
			}
		};
	},
}

function escapeIdent(value)
{
	var symbolRef = {
		'~': 'TILDE',
		'!': 'XM',
		'@': 'AT',
		'#': 'HASH',
		'$': 'DOLLAR',
		'%': 'PERCENT',
		'^': 'CARET',
		'&': 'AMP',
		'*': 'STAR',
		'|': 'PIPE',
		'/': 'FSLASH',
		'>': 'LT',
		'<': 'GT',
		'?': 'QM',
	};
	for(var symbol in symbolRef)
	{
		value = value.replace(symbol, '$' + symbolRef[symbol]);
	}
	return value;
}

function compose(ast, context)
{
	if(!context) console.log('Context not provided')//temp
	
	if(typeof ast !== 'object') return ast;
	if(Array.isArray(ast)) return ast.map(x => compose(x, context));
	
	var obj = {};
	for(let key in ast)
	{
		obj[key] = (context) => compose(ast[key], context);
	}
	return composers[ast._type](obj, context);
}

function get(scope, id, done)
{
	if(!(id in scope || Scope.isTangent(scope)))
	{
		throw new Error('Unknown reference: ' + id);
	}
	var value = scope[id];
	if(value instanceof Resource)
	{
		value.request(done);
	}
	else
	{
		done(value);
	}
}

function add(scope, id, value)
{
	scope[id] = value;
}

function evalList(scope, args, callback)
{
	util.all(args, (arg, done) => arg.eval(scope, done), callback);
}

function renderValue(value)
{
	var type = typeof value;
	if(value instanceof Resource)
	{
		return '<resource>';
	}
	else if(Array.isArray(value))
	{
		return '(' + value.join(', ') + ')';
	}
	else if(type === 'function')
	{
		return (value.name || 'function') + '(..)';
	}
	else if(type === 'string')
	{
		return '\'' + value + '\'';
	}
	else if(value === undefined)
	{
		return 'undefined';
	}
	else if(value === null)
	{
		return 'null';
	}
	else
	{
		return value;
	}
}

function register(config, interpret)
{
	builders[config.id] = function()
	{
		var ast = {_type: config.id};
		for(var i = 0; i < arguments.length; i++)
		{
			ast[config.props[i]] = arguments[i];
		}
	};
	
	composers[config.id] = config.compose;
}

module.exports = function(id)
{
	var ast = AST[id];
	if(!ast) throw new Error('AST type not found: ' + id);
	
	return ast;
}