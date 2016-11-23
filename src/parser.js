'use strict'

var p = require('parsimmon');

var AST = require('./ast');

function lexeme(token)
{
	return ignore.then(token);
}

function keyword(id)
{
	return lexeme(p.string(id));
}

var seq = p.seqMap;

function opt(parser)
{
	return parser.or(p.succeed(undefined));
}

function optNext(a, b, combiner)
{
	return seq(a, b, combiner).or(a);
}

function sep1(delim, parser)
{
	return seq(parser, delim.then(parser).many(), (f, list) => (list.unshift(f), list));
}

function surround(left, parser, right)
{
	return left.then(parser).skip(right);
}

var ignore = p.alt(p.string('//').then(p.regex(/.*$/m)), p.whitespace).many();

var IDENT = lexeme(p.regex(/[_A-Za-z$][_A-Za-z$0-9]*/));
var OPR = lexeme(p.regex(/[+\-*/<>^~%!?&|:]+|==/));
var STR = lexeme(p.regex(/'([^'\\]*(\\.[^'\\]*)*)'|"([^"\\]*(\\.[^"\\]*)*)"/)).map(s => s.substring(1, s.length - 1));
var NUM = lexeme(p.regex(/-?([0-9]+|[0-9]*\.[0-9]+)/)).map(Number);
var TRUE = keyword('true').result(true);
var FALSE = keyword('false').result(false);
var NULL = keyword('null').result(null);

var ROUTE_NODE = lexeme(p.regex(/[a-zA-Z0-9._\-]+/));

var L_PAREN = keyword('(');
var R_PAREN = keyword(')');
var L_BRACKET = keyword('[');
var R_BRACKET = keyword(']');
var L_BRACE = keyword('{');
var R_BRACE = keyword('}');
var ASSIGN = keyword('=');
var SEMICOLON = keyword(';');
var COLON = keyword(':');
var DOT = keyword('.');
var COMMA = keyword(',');

var ARROW = keyword('=>');
var F_SLASH = keyword('/');
var AT_MARK = keyword('@');
var POUND_SYMBOL = keyword('#');

var EXPORT = keyword('export');

var AS = keyword('as');

var IF = keyword('if');
var ELSE = keyword('else');

var sameLine = p.custom((success, failure) => (stream, i) =>
{
	if(i >= stream.length)
	{
		return success(i);
	}
	for(var j = i; /\s/.test(stream.charAt(j)); j++)
	{
		if(stream.charAt(j) === '\n')
		{
			return failure(j, 'Illegal newline character');
		}
	}
	return success(i);
});

var Literal = p.alt(STR, NUM, TRUE, FALSE, NULL, L_PAREN.skip(R_PAREN).result(undefined));

var Exp = p.lazy('Expression', () => 
{
	var exp = p.alt(
		LiteralExp,
		LambdaExp,
		ConditionExp,
		RouteExp,
		TargetExp
	);
	
	var oprExp = OPR.map(AST('opr'));
	var invokeExp = AST('invoke');
	var tupleExp = AST('tuple');
	
	exp = seq(oprExp.skip(sameLine), exp.map((exp) => [exp]), invokeExp).or(exp);
	
	return p.seqMap(exp, p.seq(oprExp, exp).many(), (exp, tails) =>
	{
		for(var i = 0; i < tails.length; i++)
		{
			var tail = tails[i];
			exp = invokeExp(tail[0], tupleExp([exp, tail[1]]));
		}
		return exp;
	});
});

var Statement = p.lazy('Statement', () => p.alt(
	ExportStatement,
	CompStatement,
	FunctionStatement,
	AssignStatement
));

var Pattern = p.lazy('Pattern', () => p.alt(
	BasicPattern,
	LiteralPattern,
	TuplePattern,
	RoutePattern
));

var BasicPattern = IDENT.map(AST('basicPattern'));

var LiteralPattern = Literal.map(AST('literalPattern'));

var TuplePattern = p.alt(
	surround(L_PAREN, sep1(COMMA, Pattern), R_PAREN).map(AST('tuplePattern')),
	L_PAREN.skip(R_PAREN).result(AST('emptyPattern')())
);

var RoutePattern = p.lazy('RoutePattern', () => F_SLASH.then(sep1(F_SLASH, RoutePatternNode).or(p.succeed([]))).map(AST('routePattern')));

var RoutePatternNode = p.lazy('RoutePatternNode', () => p.alt(
	COLON.then(IDENT).map(AST('variableRoutePattern')),
	Literal.or(ROUTE_NODE).map(AST('basicRoutePattern'))
));

var RouteExpNode = p.lazy('RouteExpNode', () => p.alt(
	COLON.then(p.alt(TargetExp)),
	Literal.or(ROUTE_NODE).map(AST('basicRouteExp'))
));

var RouteLiteral = F_SLASH.then(sep1(F_SLASH, Literal.or(ROUTE_NODE)).or(p.succeed([])));

var LiteralExp = Literal.map(AST('literal'));

var TargetExp = p.lazy('TargetExp', () =>
{
	var exp = optNext(p.alt(
		IdentExp,
		TupleExp,
		BlockExp,
		ClosureExp,
		AnonymousExp
	), sameLine.then(TupleListExp), AST('invoke'));
	
	exp = optNext(exp, surround(L_BRACKET, Exp, R_BRACKET), AST('indexer'));
	
	return optNext(exp, DOT.then(TargetExp), AST('target'));
});

var IdentExp = IDENT.map(AST('ident')).or(OPR.map(AST('opr')));

var TupleListExp = surround(L_PAREN, sep1(COMMA, Exp).or(p.succeed([])), R_PAREN).map(AST('tuple'));

var TupleExp = TupleListExp.map((tuple) => tuple.list.length == 1 ? tuple.list[0] : tuple);

var MultiExp = Statement.skip(SEMICOLON.many()).many().map(AST('multi'));

var BlockExp = surround(L_BRACE, MultiExp, R_BRACE).map(AST('block'));

var RouteExp = F_SLASH.then(sep1(F_SLASH, RouteExpNode).or(p.succeed([]))).map(AST('route'));

var LambdaExp = seq(Pattern, TuplePattern.skip(ARROW), Exp, AST('functionDef'));

var ClosureExp = surround(L_BRACKET, Exp, R_BRACKET).map(AST('closure'));

var ConditionExp = seq(IF.then(Exp), Exp, opt(ELSE.then(Exp)), AST('conditional'));

var AnonymousExp = seq(p.alt(AT_MARK, POUND_SYMBOL), opt(p.alt(IDENT, STR, NUM)), AST('anonymous'));

var AssignStatement = seq(p.alt(IDENT, OPR).skip(ASSIGN), Exp, AST('assign'));

var FunctionStatement = seq(p.alt(IDENT, OPR), p.alt(TuplePattern, RoutePattern.map(r => AST('tuplePattern')([r]))), p.alt(ASSIGN.then(Exp), BlockExp), AST('functionDef'));

var ExportStatement = EXPORT.then(Exp).map(AST('export'));

var CompStatement = seq(TargetExp, sep1(COMMA, p.seq(p.alt(STR, RouteLiteral, IDENT, sep1(DOT, IDENT)), opt(AS.then(IDENT)))), AST('composure'));
// allow multiple 'path as x' declarations per composure

module.exports = MultiExp.map(AST('block')).skip(ignore).skip(p.custom((success, failure) => (stream, i) => i >= stream.length ? success(i) : failure(i, 'Trailing input')))
	.or(Exp.skip(ignore));
