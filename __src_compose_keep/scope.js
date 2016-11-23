'use strict'

var parentSymbol = Symbol();
var baseSymbol = Symbol();
var targetSymbol = Symbol();

var Scope =
{
	create(parent)
	{
		var scope = Object.create(null);
		if(parent)
		{
			Object.assign(scope, parent);
			scope[parentSymbol] = parent;
		}
		return scope;
	},
	createTangent(parent, value)
	{
		var scope = Object.create(value);
		scope[parentSymbol] = parent;
		scope[baseSymbol] = Scope.getBase(parent);
		scope[targetSymbol] = value;
		return scope;
	},
	isTangent(scope)
	{
		return !!scope[baseSymbol];
	},
	getParent(scope)
	{
		return scope[parentSymbol];
	},
	getRootParent(scope)
	{
		while(scope[parentSymbol])
		{
			scope = scope[parentSymbol];
		}
		return scope;
	},
	getBase(scope)
	{
		return scope[baseSymbol] || scope;
	},
	getTarget(scope)
	{
		return scope[targetSymbol];
	},
};

module.exports = Scope;