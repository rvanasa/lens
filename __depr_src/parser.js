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

function optJoin(a, b, combiner)
{
	return seq(a, opt(b), (a, b) => b !== undefined ? combiner(a, b) : a);
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
var OPR = lexeme(p.regex(/[+\-*/<>^~%!?&|]+=*|==/));
var STR = lexeme(p.regex(/'([^'\\]*(\\.[^'\\]*)*)'|"([^"\\]*(\\.[^"\\]*)*)"/)).map(s => s.substring(1, s.length - 1));
var NUM = lexeme(p.regex(/-?[0-9]+(.[0-9]+)?/)).map(Number);
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

var F_SLASH = keyword('/');
var AT_MARK = keyword('@');

var IMPORT = keyword('import');
var EXPORT = keyword('export');

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
		TargetExp,
		BlockExp,
		ConditionExp
	);
	return optJoin(exp, sameLine.then(TupleExp.or(Exp)), AST.invoke);
});

var Statement = p.lazy('Statement', () => p.alt(
	ImportStatement,
	ExportStatement,
	FunctionStatement,
	AssignStatement
));

var Pattern = p.lazy('Pattern', () => p.alt(
	BasicPattern,
	LiteralPattern,
	TuplePattern,
	RoutePattern
));

var BasicPattern = IDENT.map(AST.basicPattern);

var LiteralPattern = Literal.map(AST.literalPattern);

var TuplePattern = p.alt(
	surround(L_PAREN, sep1(COMMA, Pattern), R_PAREN).map(AST.tuplePattern),
	L_PAREN.skip(R_PAREN).result(AST.emptyPattern())
);

var RoutePattern = p.lazy('RoutePattern', () => F_SLASH.then(sep1(F_SLASH, RouteNode).or(p.succeed([]))).map(AST.routePattern));

var RouteNode = p.lazy('RouteNode', () => p.alt(
	VariableRouteNode,
	BasicRouteNode
));

var BasicRouteNode = ROUTE_NODE.map(AST.basicRouteNode);

var VariableRouteNode = COLON.then(IDENT).map(AST.variableRouteNode);

var LiteralExp = Literal.map(AST.literal);

var TargetExp = p.lazy('TargetExp', () =>
{
	var exp = optJoin(p.alt(
		IdentExp,
		TupleExp,
		ClosureExp,
		AnonymousExp
	), sameLine.then(TupleExp), AST.invoke);
	
	return optJoin(exp, DOT.then(TargetExp), AST.target);
});

var IdentExp = IDENT.map(AST.ident).or(OPR.map(AST.opr));

var TupleExp = surround(L_PAREN, sep1(COMMA, Exp), R_PAREN).map(AST.tuple);

var MultiExp = Statement.skip(SEMICOLON.many()).many().map(AST.multi);

var BlockExp = surround(L_BRACE, MultiExp, R_BRACE).map(AST.block);

var ClosureExp = surround(L_BRACKET, Exp, R_BRACKET).map(AST.closure);

var ConditionExp = seq(IF.then(Exp), Exp, opt(ELSE.then(Exp)), AST.condition);

var AnonymousExp = AT_MARK.then(opt(p.alt(IDENT, STR, NUM))).map(AST.anonymous);

var AssignStatement = seq(IDENT.skip(ASSIGN), Exp, AST.assign);

var FunctionStatement = seq(p.alt(IDENT, OPR), p.alt(TuplePattern, RoutePattern.map(r => AST.tuplePattern([r]))), p.alt(ASSIGN.then(Exp), BlockExp), AST.functionDef);

var ImportStatement = IMPORT.then(sep1(DOT, IDENT).map(list => list.join('.'))).map(AST.import);

var ExportStatement = EXPORT.then(Exp).map(AST.export);

module.exports = MultiExp.skip(ignore);