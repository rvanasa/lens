'use strict'

var Resource = require('plasma').Resource;

var util = require('./util');

var Scope = require('./scope');

var AST =
{
	literal(value)
	{
		return {
			value,
			_type: 'literal',
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
	tuple(list)
	{
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
				done(util.async(function(args, done)
				{
					var fnScope = Scope.create(scope);
					fnScope['@'] = args[0];
					fnScope['#'] = args[1];
					exp.eval(fnScope, done);
				}));
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
	indexer(base, exp)
	{
		return {
			base, exp,
			eval(scope, done)
			{
				base.eval(scope, (value) =>
				{
					exp.eval(scope, (index) => done(value[index]));
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
						while(fn.invoke)
						{
							fn = fn.invoke;
							if(!fn)
							{
								throw new Error('Cannot invoke ' + renderValue(fn) + (target.id ? ' `' + target.id + '`' : ''));
							}
						}
					}
					var self = Scope.getTarget(scope);
					arg.eval(Scope.getBase(scope), (value) =>
					{
						if(fn.pattern && !fn.pattern.validate(scope, value))
						{
							throw new Error(`Invalid argument: ${renderValue(value)} ; expecting ${fn.pattern}`);
						}
						util.invoke(fn, self, value, done, scope);
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
				var exported = false;
				var exportValue;
				
				var child = Scope.create(scope);
				child.export = function(value)
				{
					exported = true;
					exportValue = value;
				}
				body.eval(child, (value) => done(exported ? exportValue : value));
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
						if('id' in ast)
						{
							var value = values[i];
							result[ast.id] = value;
						}
					}
					done(result);
				});
			}
		};
	},
	conditional(condition, trueExp, falseExp)
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
	anonymous(symbol, target)
	{
		return {
			symbol,
			target,
			eval(scope, done)
			{
				get(scope, symbol, target === undefined ? done : (value) =>
				{
					get(Scope.createTangent(scope, value), target, done);
				});
			}
		};
	},
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
	assign(local, id, exp)
	{
		return {
			local, id, exp,
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
				
				if(!local) add(scope, id, resource);
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

module.exports = function(id)
{
	var ast = AST[id];
	if(!ast) throw new Error('AST type not found: ' + id);
	
	return ast;
}