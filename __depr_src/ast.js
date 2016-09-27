'use strict'

var Resource = require('plasma').Resource;

var Scope = require('./scope');

var AST =
{
	literal(value)
	{
		return {
			value,
			eval(scope, done)
			{
				done(value);
			}
		};
	},
	ident(id)
	{
		return {
			id,
			eval(scope, done)
			{
				get(scope, id, done);
			}
		};
	},
	opr(id)
	{
		return AST.ident(id);
	},
	scope()
	{
		return {
			eval(scope, done)
			{
				done(scope);
			}
		};
	},
	tuple(list)
	{
		// if(list.length == 1) return list[0];
		return {
			list,
			eval(scope, done)
			{
				evalList(scope, list, done);
			}
		};
	},
	closure(exp)
	{
		return {
			exp,
			eval(scope, done)
			{
				done(function(args, done)
				{
					var fnScope = Scope.create(scope);
					fnScope['@'] = args[0];
					exp.eval(fnScope, done);
				});
			}
		};
	},
	target(base, exp)
	{
		return {
			base, exp,
			eval(scope, done)
			{
				base.eval(scope, (value) =>
				{
					exp.eval(Scope.createTangent(scope, value), done);
				});
			}
		};
	},
	invoke(target, arg)
	{
		return {
			target, arg,
			eval(scope, done)
			{
				target.eval(scope, (fn) =>
				{
					if(typeof fn !== 'function')
					{
						throw new Error('Cannot invoke ' + (target.id ? '`' + target.id + '` ' : '') + '-- ' + JSON.stringify(fn));
					}
					var self = 'target' in target ? target.target : undefined;
					arg.eval(Scope.getBase(scope), (value) =>
					{
						if(fn.pattern && !fn.pattern.validate(scope, value))
						{
							throw new Error(`Invalid argument: ${renderValue(value)} ; expecting ${fn.pattern}`);
						}
						fn.call(self, value, done, scope);
					});
				});
			}
		}
	},
	block(body)
	{
		return {
			body,
			eval(scope, done)
			{
				body.eval(Scope.create(scope), done);
			}
		};
	},
	multi(list)
	{
		return {
			list,
			eval(scope, done)
			{
				var result = {};
				
				evalList(scope, list, (values) =>
				{
					for(var i = 0; i < values.length; i++)
					{
						var ast = list[i];
						if(ast.id)
						{
							var value = values[i];
							result[ast.id] = value;
						}
					}
					done(result);
				})
			}
		};
	},
	condition(condition, trueExp, falseExp)
	{
		return {
			condition, trueExp, falseExp,
			eval(scope, done)
			{
				condition.eval(scope, (value) =>
				{
					if(value)
					{
						trueExp.eval(scope, done);
					}
					else if(falseExp)
					{
						falseExp.eval(scope, done);
					}
					else
					{
						done();
					}
				})
			}
		};
	},
	assign(id, exp)
	{
		return {
			id, exp,
			eval(scope, done)
			{
				var resource = new Resource((resolve) =>
				{
					exp.eval(scope, resolve);
				});
				resource.id = id;
				
				add(scope, id, resource);
				resource.request(done, (err) => done(err instanceof Error ? err : new Error(err)));
			}
		};
	},
	anonymous(target)
	{
		return {
			target,
			eval(scope, done)
			{
				get(scope, '@', target === undefined ? done : (value) =>
				{
					get(Scope.createTangent(scope, value), target, done);
				});
			}
		};
	},
	functionDef(id, pattern, exp)
	{
		return {
			id, pattern, exp,
			eval(scope, done)
			{
				var fn = function(args, done)
				{
					var fnScope = Scope.create(scope);
					fnScope.export = (exportArgs, exportDone) =>
					{
						exportDone(exportArgs[0]);
						done(exportArgs[0]);
					}
					pattern.setup(fnScope, args);
					exp.eval(fnScope, done);
				};
				fn.pattern = pattern;
				
				if(id in scope)
				{
					var first = scope[id];
					var next = fn;
					fn = function(args, done, scope)
					{
						if(first.pattern && first.pattern.validate(scope, args))
						{
							first(args, done, scope);
						}
						else
						{
							next(args, done, scope);
						}
					}
					fn.pattern = AST.orPattern(first.pattern, next.pattern);
				}
				
				add(scope, id, fn);
				done(fn);
			}
		};
	},
	import(id)
	{
		return {
			id,
			eval(scope, done)
			{
				scope.import([id], (value) =>
				{
					add(scope, id, value);
					done(value);
				});
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
					scope.export([value], done);
				});
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
				scope[id] = value;
			},
			toString()
			{
				return '<' + id + '>';
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
				return literal;
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
	basicRouteNode(text)
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
	variableRouteNode(id)
	{
		return {
			id,
			validate(scope, value)
			{
				return true;
			},
			setup(scope, value)
			{
				scope[id] = value;
			},
			toString()
			{
				return ':' + id;
			}
		};
	},
	// basicSelector(id)
	// {
	// 	return {
	// 		id,
	// 		select(dir, done)
	// 		{
	// 			if(!dir || !(id in dir))
	// 			{
	// 				throw new Error(`'${id}' not found in ${dir}`);
	// 			}
	// 			done(id, dir[id]);
	// 		}
	// 	};
	// },
	// subSelector(target, selector)
	// {
	// 	return {
	// 		target, selector,
	// 		select(dir, done)
	// 		{
	// 			target.select(dir, (id, sub) =>
	// 			{
	// 				selector.select(sub, done);
	// 			});
	// 		}
	// 	};
	// },
}

module.exports = AST;

function get(scope, id, done)
{
	if(!(id in scope))
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

// function set(scope, id, value)
// {
// 	if(id in scope)
// 	{
// 		throw new Error('Duplicate reference: ' + id);
// 	}
// 	scope[id] = value;
// }

function evalList(scope, args, callback)
{
	var results = [];
	var len = args.length;
	if(len == 0) callback(results);
	var ct = len;
	for(var i = 0; i < len; i++)
	{
		request(i);
	}
	function request(i)
	{
		var arg = args[i];
		var flag = true;
		function done(value)
		{
			results[i] = value;
			if(flag && --ct == 0)
			{
				flag = false;
				callback(results);
			}
		}
		arg.eval(scope, done);
	}
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
	else if(type === 'string')
	{
		return '\'' + value + '\'';
	}
	else if(type === 'undefined')
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

function inspect(done)
{
	return (value) => (console.log(value), done(value));
}