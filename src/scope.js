'use strict'

var parentSymbol = Symbol();
var baseSymbol = Symbol();

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
		var scope = Object.create(null);
		for(var key in value)
		{
			scope[key] = value[key];
		}
		scope[parentSymbol] = parent;
		scope[baseSymbol] = Scope.getBase(parent);
		return scope;
	},
	isTangent(scope)
	{
		return !!scope[baseSymbol];
	},
	getBase(scope)
	{
		return scope[baseSymbol] || scope;
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
};

module.exports = Scope;