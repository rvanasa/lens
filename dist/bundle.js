/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	window.Lens = __webpack_require__(1);

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict'

	var lens =
	{
		util: __webpack_require__(2),
		parser: __webpack_require__(3),
		lib: __webpack_require__(9),
		Scope: __webpack_require__(8),
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

/***/ },
/* 2 */
/***/ function(module, exports) {

	'use strict'

	module.exports =
	{
		invoke(fn, self, args, done, scope)
		{
			if(fn.async)
			{
				fn.call(self, args, done, scope);
			}
			else
			{
				done(fn.apply(self, args));
			}
		},
		async(fn)
		{
			fn.async = true;
			return fn;
		},
		all(values, mapper, callback)
		{
			var results = [];
			var len = values.length;
			if(!len) callback(results);
			var ct = len;
			for(var i = 0; i < len; i++)
			{
				request(i);
			}
			function request(i)
			{
				var value = values[i];
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
				mapper(value, done);
			}
		},
	};

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict'

	var p = __webpack_require__(4);

	var AST = __webpack_require__(5);

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

	var IMPORT = keyword('import');
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
		
		// exp = optNext(exp, sameLine.then(TupleListExp.or(Exp)), AST('invoke'));
		
		return p.seqMap(exp, p.seq(OPR.map(AST('opr')), exp).many(), (exp, tails) =>
		{
			var invoke = AST('invoke');
			var tuple = AST('tuple');
			
			for(var i = 0; i < tails.length; i++)
			{
				var tail = tails[i];
				exp = invoke(tail[0], tuple([exp, tail[1]]));
			}
			return exp;
		});
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

	var LambdaExp = seq(p.succeed(null), TuplePattern.skip(ARROW), Exp, AST('functionDef'));

	var ClosureExp = surround(L_BRACKET, Exp, R_BRACKET).map(AST('closure'));

	var ConditionExp = seq(IF.then(Exp), Exp, opt(ELSE.then(Exp)), AST('conditional'));

	var AnonymousExp = seq(p.alt(AT_MARK, POUND_SYMBOL), opt(p.alt(IDENT, STR, NUM)), AST('anonymous'));

	var AssignStatement = seq(IDENT.skip(ASSIGN), Exp, AST('assign'));

	var FunctionStatement = seq(p.alt(IDENT, OPR), p.alt(TuplePattern, RoutePattern.map(r => AST('tuplePattern')([r]))), p.alt(ASSIGN.then(Exp), BlockExp), AST('functionDef'));

	var ImportStatement = seq(IMPORT.then(p.alt(STR, RouteLiteral, sep1(DOT, IDENT))), opt(AS.then(IDENT)), AST('import'));

	var ExportStatement = EXPORT.then(Exp).map(AST('export'));

	module.exports = p.alt(MultiExp, Exp).skip(ignore);

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;// This unsightly UMD-module header is here to make this code work without
	// modification with CommonJS, AMD, and browser globals.

	(function(root, factory) {
	  if (true) {
	    // AMD. Register as an anonymous module.
	    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory), __WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? (__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  } else if (typeof module === 'object' && module.exports) {
	    // Node. Does not work with strict CommonJS, but
	    // only CommonJS-like environments that support module.exports,
	    // like Node.
	    module.exports = factory();
	  } else {
	    // Browser globals (root is window).
	    root.Parsimmon = factory();
	  }
	}(this, function() {
	  "use strict";

	  var Parsimmon = {};

	  // The Parser object is a wrapper for a parser function.
	  // Externally, you use one to parse a string by calling
	  //   var result = SomeParser.parse('Me Me Me! Parse Me!');
	  // You should never call the constructor, rather you should
	  // construct your Parser from the base parsers and the
	  // parser combinator methods.
	  function Parser(action) {
	    if (!(this instanceof Parser)) return new Parser(action);
	    this._ = action;
	  };

	  Parsimmon.Parser = Parser;

	  var _ = Parser.prototype;

	  function makeSuccess(index, value) {
	    return {
	      status: true,
	      index: index,
	      value: value,
	      furthest: -1,
	      expected: []
	    };
	  }

	  function makeFailure(index, expected) {
	    return {
	      status: false,
	      index: -1,
	      value: null,
	      furthest: index,
	      expected: [expected]
	    };
	  }

	  function mergeReplies(result, last) {
	    if (!last) return result;
	    if (result.furthest > last.furthest) return result;

	    var expected = (result.furthest === last.furthest)
	      ? result.expected.concat(last.expected)
	      : last.expected;

	    return {
	      status: result.status,
	      index: result.index,
	      value: result.value,
	      furthest: last.furthest,
	      expected: expected
	    }
	  }

	  // For ensuring we have the right argument types
	  function assertParser(p) {
	    if (!(p instanceof Parser)) throw new Error('not a parser: '+p);
	  }
	  function assertNumber(x) {
	    if (typeof x !== 'number') throw new Error('not a number: '+x);
	  }
	  function assertRegexp(x) {
	    if (!(x instanceof RegExp)) throw new Error('not a regex: '+x);
	  }
	  function assertFunction(x) {
	    if (typeof x !== 'function') throw new Error('not a function: '+x);
	  }
	  function assertString(x) {
	    if (typeof x !== 'string') throw new Error('not a string: '+x)
	  }

	  function formatExpected(expected) {
	    if (expected.length === 1) return expected[0];

	    return 'one of ' + expected.join(', ')
	  }

	  function formatGot(stream, error) {
	    var index = error.index;
	    var i = index.offset;

	    if (i === stream.length) return ', got the end of the stream'


	    var prefix = (i > 0 ? "'..." : "'");
	    var suffix = (stream.length - i > 12 ? "...'" : "'");

	    return ' at line ' + index.line + ' column ' + index.column
	      +  ', got ' + prefix + stream.slice(i, i+12) + suffix
	  }

	  var formatError = Parsimmon.formatError = function(stream, error) {
	    return 'expected ' + formatExpected(error.expected) + formatGot(stream, error)
	  };

	  _.parse = function(stream) {
	    if (typeof stream !== 'string') {
	      throw new Error('.parse must be called with a string as its argument');
	    }
	    var result = this.skip(eof)._(stream, 0);

	    return result.status ? {
	      status: true,
	      value: result.value
	    } : {
	      status: false,
	      index: makeLineColumnIndex(stream, result.furthest),
	      expected: result.expected
	    };
	  };

	  // [Parser a] -> Parser [a]
	  var seq = Parsimmon.seq = function() {
	    var parsers = [].slice.call(arguments);
	    var numParsers = parsers.length;

	    for (var j = 0; j < numParsers; j += 1) {
	      assertParser(parsers[j]);
	    }

	    return Parser(function(stream, i) {
	      var result;
	      var accum = new Array(numParsers);

	      for (var j = 0; j < numParsers; j += 1) {
	        result = mergeReplies(parsers[j]._(stream, i), result);
	        if (!result.status) return result;
	        accum[j] = result.value
	        i = result.index;
	      }

	      return mergeReplies(makeSuccess(i, accum), result);
	    });
	  };


	  var seqMap = Parsimmon.seqMap = function() {
	    var args = [].slice.call(arguments);
	    var mapper = args.pop();
	    return seq.apply(null, args).map(function(results) {
	      return mapper.apply(null, results);
	    });
	  };

	  /**
	   * Allows to add custom primitive parsers
	   */
	  var custom = Parsimmon.custom = function(parsingFunction) {
	    return Parser(parsingFunction(makeSuccess, makeFailure));
	  };

	  var alt = Parsimmon.alt = function() {
	    var parsers = [].slice.call(arguments);
	    var numParsers = parsers.length;
	    if (numParsers === 0) return fail('zero alternates')

	    for (var j = 0; j < numParsers; j += 1) {
	      assertParser(parsers[j]);
	    }

	    return Parser(function(stream, i) {
	      var result;
	      for (var j = 0; j < parsers.length; j += 1) {
	        result = mergeReplies(parsers[j]._(stream, i), result);
	        if (result.status) return result;
	      }
	      return result;
	    });
	  };

	  var sepBy = Parsimmon.sepBy = function(parser, separator) {
	    // Argument asserted by sepBy1
	    return sepBy1(parser, separator).or(Parsimmon.of([]));
	  };

	  var sepBy1 = Parsimmon.sepBy1 = function(parser, separator) {
	    assertParser(parser);
	    assertParser(separator);

	    var pairs = separator.then(parser).many();

	    return parser.chain(function(r) {
	      return pairs.map(function(rs) {
	        return [r].concat(rs);
	      })
	    })
	  };

	  // -*- primitive combinators -*- //
	  _.or = function(alternative) {
	    return alt(this, alternative);
	  };

	  _.then = function(next) {
	    if (typeof next === 'function') {
	      throw new Error('chaining features of .then are no longer supported, use .chain instead');
	    }

	    assertParser(next);
	    return seq(this, next).map(function(results) { return results[1]; });
	  };

	  // -*- optimized iterative combinators -*- //
	  // equivalent to:
	  // _.many = function() {
	  //   return this.times(0, Infinity);
	  // };
	  // or, more explicitly:
	  // _.many = function() {
	  //   var self = this;
	  //   return self.then(function(x) {
	  //     return self.many().then(function(xs) {
	  //       return [x].concat(xs);
	  //     });
	  //   }).or(succeed([]));
	  // };
	  _.many = function() {
	    var self = this;

	    return Parser(function(stream, i) {
	      var accum = [];
	      var result;
	      var prevResult;

	      for (;;) {
	        result = mergeReplies(self._(stream, i), result);

	        if (result.status) {
	          i = result.index;
	          accum.push(result.value);
	        }
	        else {
	          return mergeReplies(makeSuccess(i, accum), result);
	        }
	      }
	    });
	  };

	  // equivalent to:
	  // _.times = function(min, max) {
	  //   if (arguments.length < 2) max = min;
	  //   var self = this;
	  //   if (min > 0) {
	  //     return self.then(function(x) {
	  //       return self.times(min - 1, max - 1).then(function(xs) {
	  //         return [x].concat(xs);
	  //       });
	  //     });
	  //   }
	  //   else if (max > 0) {
	  //     return self.then(function(x) {
	  //       return self.times(0, max - 1).then(function(xs) {
	  //         return [x].concat(xs);
	  //       });
	  //     }).or(succeed([]));
	  //   }
	  //   else return succeed([]);
	  // };
	  _.times = function(min, max) {
	    if (arguments.length < 2) max = min;
	    var self = this;

	    assertNumber(min);
	    assertNumber(max);

	    return Parser(function(stream, i) {
	      var accum = [];
	      var start = i;
	      var result;
	      var prevResult;

	      for (var times = 0; times < min; times += 1) {
	        result = self._(stream, i);
	        prevResult = mergeReplies(result, prevResult);
	        if (result.status) {
	          i = result.index;
	          accum.push(result.value);
	        }
	        else return prevResult;
	      }

	      for (; times < max; times += 1) {
	        result = self._(stream, i);
	        prevResult = mergeReplies(result, prevResult);
	        if (result.status) {
	          i = result.index;
	          accum.push(result.value);
	        }
	        else break;
	      }

	      return mergeReplies(makeSuccess(i, accum), prevResult);
	    });
	  };

	  // -*- higher-level combinators -*- //
	  _.result = function(res) { return this.map(function(_) { return res; }); };
	  _.atMost = function(n) { return this.times(0, n); };
	  _.atLeast = function(n) {
	    var self = this;
	    return seqMap(this.times(n), this.many(), function(init, rest) {
	      return init.concat(rest);
	    });
	  };

	  _.map = function(fn) {

	    assertFunction(fn);

	    var self = this;
	    return Parser(function(stream, i) {
	      var result = self._(stream, i);
	      if (!result.status) return result;
	      return mergeReplies(makeSuccess(result.index, fn(result.value)), result);
	    });
	  };

	  _.skip = function(next) {
	    return seq(this, next).map(function(results) { return results[0]; });
	  };

	  _.mark = function() {
	    return seqMap(index, this, index, function(start, value, end) {
	      return { start: start, value: value, end: end };
	    });
	  };

	  _.desc = function(expected) {
	    var self = this;
	    return Parser(function(stream, i) {
	      var reply = self._(stream, i);
	      if (!reply.status) reply.expected = [expected];
	      return reply;
	    });
	  };

	  // -*- primitive parsers -*- //
	  var string = Parsimmon.string = function(str) {
	    var len = str.length;
	    var expected = "'"+str+"'";

	    assertString(str);

	    return Parser(function(stream, i) {
	      var head = stream.slice(i, i+len);

	      if (head === str) {
	        return makeSuccess(i+len, head);
	      }
	      else {
	        return makeFailure(i, expected);
	      }
	    });
	  };

	  var regex = Parsimmon.regex = function(re, group) {

	    assertRegexp(re);
	    if (group) assertNumber(group);

	    var anchored = RegExp('^(?:'+re.source+')', (''+re).slice((''+re).lastIndexOf('/')+1));
	    var expected = '' + re;
	    if (group == null) group = 0;

	    return Parser(function(stream, i) {
	      var match = anchored.exec(stream.slice(i));

	      if (match) {
	        var fullMatch = match[0];
	        var groupMatch = match[group];
	        if (groupMatch != null) return makeSuccess(i+fullMatch.length, groupMatch);
	      }

	      return makeFailure(i, expected);
	    });
	  };

	  var succeed = Parsimmon.succeed = function(value) {
	    return Parser(function(stream, i) {
	      return makeSuccess(i, value);
	    });
	  };

	  var fail = Parsimmon.fail = function(expected) {
	    return Parser(function(stream, i) { return makeFailure(i, expected); });
	  };

	  var letter = Parsimmon.letter = regex(/[a-z]/i).desc('a letter')
	  var letters = Parsimmon.letters = regex(/[a-z]*/i)
	  var digit = Parsimmon.digit = regex(/[0-9]/).desc('a digit');
	  var digits = Parsimmon.digits = regex(/[0-9]*/)
	  var whitespace = Parsimmon.whitespace = regex(/\s+/).desc('whitespace');
	  var optWhitespace = Parsimmon.optWhitespace = regex(/\s*/);

	  var any = Parsimmon.any = Parser(function(stream, i) {
	    if (i >= stream.length) return makeFailure(i, 'any character');

	    return makeSuccess(i+1, stream.charAt(i));
	  });

	  var all = Parsimmon.all = Parser(function(stream, i) {
	    return makeSuccess(stream.length, stream.slice(i));
	  });

	  var eof = Parsimmon.eof = Parser(function(stream, i) {
	    if (i < stream.length) return makeFailure(i, 'EOF');

	    return makeSuccess(i, null);
	  });

	  var test = Parsimmon.test = function(predicate) {
	    assertFunction(predicate);

	    return Parser(function(stream, i) {
	      var char = stream.charAt(i);
	      if (i < stream.length && predicate(char)) {
	        return makeSuccess(i+1, char);
	      }
	      else {
	        return makeFailure(i, 'a character matching '+predicate);
	      }
	    });
	  };

	  var oneOf = Parsimmon.oneOf = function(str) {
	    return test(function(ch) { return str.indexOf(ch) >= 0; });
	  };

	  var noneOf = Parsimmon.noneOf = function(str) {
	    return test(function(ch) { return str.indexOf(ch) < 0; });
	  };

	  var takeWhile = Parsimmon.takeWhile = function(predicate) {
	    assertFunction(predicate);

	    return Parser(function(stream, i) {
	      var j = i;
	      while (j < stream.length && predicate(stream.charAt(j))) j += 1;
	      return makeSuccess(j, stream.slice(i, j));
	    });
	  };

	  var lazy = Parsimmon.lazy = function(desc, f) {
	    if (arguments.length < 2) {
	      f = desc;
	      desc = undefined;
	    }

	    var parser = Parser(function(stream, i) {
	      parser._ = f()._;
	      return parser._(stream, i);
	    });

	    if (desc) parser = parser.desc(desc)

	    return parser;
	  };

	  var makeLineColumnIndex = function(stream, i) {
	    var lines = stream.slice(0, i).split("\n");
	    // Note that unlike the character offset, the line and column offsets are
	    // 1-based.
	    var lineWeAreUpTo = lines.length;
	    var columnWeAreUpTo = lines[lines.length - 1].length + 1;

	    return {
	      offset: i,
	      line: lineWeAreUpTo,
	      column: columnWeAreUpTo
	    };
	  };

	  var index
	    = Parsimmon.index
	    = Parser(function(stream, i) {
	      return makeSuccess(i, makeLineColumnIndex(stream, i));
	    });

	  //- fantasyland compat

	  //- Monoid (Alternative, really)
	  _.concat = _.or;
	  _.empty = fail('empty')

	  //- Applicative
	  _.of = Parser.of = Parsimmon.of = succeed

	  _.ap = function(other) {
	    return seqMap(this, other, function(f, x) { return f(x); })
	  };

	  //- Monad
	  _.chain = function(f) {
	    var self = this;
	    return Parser(function(stream, i) {
	      var result = self._(stream, i);
	      if (!result.status) return result;
	      var nextParser = f(result.value);
	      return mergeReplies(nextParser._(stream, result.index), result);
	    });
	  };

	  return Parsimmon;
	}));


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict'

	var Resource = __webpack_require__(6).Resource;

	var util = __webpack_require__(2);

	var Scope = __webpack_require__(8);

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
							throw new Error('Cannot invoke ' + renderValue(fn) + (target.id ? ' `' + target.id + '`' : ''));
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
					})
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
		import(path, alias)
		{
			return {
				path, alias,
				eval(scope, done)
				{
					util.invoke(scope.import, scope, [path], (value) =>
					{
						var id = alias || (typeof path === 'string' ? path : path[path.length - 1]);
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
						util.invoke(scope.export, scope, [value], done);
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

	module.exports = function(id)
	{
		var ast = AST[id];
		if(!ast) throw new Error('AST type not found: ' + id);
		
		return ast;
	}

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = {
	    Resource: __webpack_require__(7)
	};

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	'use strict'

	function Resource(provider)
	{
		this.provider = provider;
		
		this.inputs = [];
		this.listeners = [];
	}

	Resource.prototype = {
		constructor: Resource,
		addInput: function(input)
		{
			if(~this.listeners.indexOf(input))
			{
				throw new Error('Circular inputs:', this.id || this, ' ~ ', input.id || input);
			}
			this.inputs.push(input);
			input.listeners.push(this);
		},
		removeInput: function(input)
		{
			this.inputs.splice(this.inputs.indexOf(input), 1);
			input.listeners.splice(input.listeners.indexOf(this), 1);
		},
		request: function(callback, errCallback)
		{
			if(this.destroyed) throw new Error('Resource is destroyed' + (this.id ? ': ' + this.id : ''));
			if(this.resolved || !this.provider) return callback ? callback(this.value) : this.value;
		
			if(callback)
			{
				if(typeof callback !== 'function') throw new Error('Callback must be a function: ' + callback);
				
				if(this.callback)
				{
					var prev = this.callback;
					this.callback = function(value)
					{
						prev(value);
						callback(value);
					}
				}
				else this.callback = callback;
			}
			if(errCallback)
			{
				if(typeof errCallback !== 'function') throw new Error('Error callback must be a function: ' + errCallback);
				
				if(this.errCallback)
				{
					var prevErr = this.errCallback;
					this.errCallback = function(value)
					{
						prevErr(value);
						errCallback(value);
					}
				}
				else this.errCallback = errCallback;
			}
			
			if(!this.loading)
			{
				this.loading = true;
				this.provider(this.resolve.bind(this), this);
			}
			
			return this.value;
		},
		resolve: function(value)
		{
			this.loading = false;
			this.resolved = true;
			this.value = value;
			
			if(this.callback)
			{
				this.callback(value, this);
				this.callback = undefined;
			}
			
			this.notify(this);
		},
		reject: function(error)
		{
			this.loading = false;
			this.resolved = false;
			this.error = error;
			
			if(this.errCallback)
			{
				this.errCallback(error, this);
				this.errCallback = undefined;
			}
			
			if(this.recover)
			{
				this.recover(error, this);
			}
		},
		notify: function(source)
		{
			if(this.provider && source != this)
			{
				this.resolved = false;
				if(this.eager) this.request();
			}
			
			for(var i = 0; i < this.listeners.length; i++)
			{
				this.listeners[i].notify(source);
			}
		},
		destroy: function()
		{
			this.destroyed = true;
			var i = this.inputs.length;
			while(--i >= 0)
			{
				this.removeInput(this.inputs[i]);
			}
		},
		// find: function(id)
		// {
		// 	var children = this.children;
		// 	if(!children) return;
		// 	else if(typeof children === 'function')
		// 	{
		// 		return children.apply(this, [].slice.call(arguments));
		// 	}
		// 	else
		// 	{
		// 		var resource = children[id];
		// 		if(typeof resource === 'function')
		// 		{
		// 			resource = resource.apply(this, [].slice.call(arguments, 1));
		// 		}
		// 		return resource;
		// 	}
		// },
	};

	Resource.all = function(resources, callback)
	{
		var results = [];
		var len = resources.length;
		if(len == 0) callback(results);
		var ct = len;
		for(var i = 0; i < len; i++)
		{
			request(i);
		}
		function request(i)
		{
			var resource = resources[i];
			if(typeof resource === 'function')
			{
				resource = Resource.lightAsync(resource);
			}
			var flag = true;
			function resolve(value)
			{
				results[i] = value;
				if(flag && --ct == 0)
				{
					flag = false;
					callback(results);
				}
			}
			resource.request(resolve);
		}
	}

	Resource.light = function(value)
	{
		return {
			request: function(done) {done(value)}
		};
	}

	Resource.lightAsync = function(provider)
	{
		return {request: provider};
	}

	Resource.static = function(value)
	{
		var resource = new Resource();
		resource.resolve(value);
		return resource;
	}

	Resource.staticAsync = function(provider)
	{
		var resource = new Resource();
		provider(resource.resolve.bind(resource), resource);
		return resource;
	}

	Resource.depend = function(inputs, syncProvider)
	{
		if(!inputs) return new Resource(function(done) {done(syncProvider())});
		var resource = new Resource(function(callback)
		{
			Resource.all(resource.inputs, function(args)
			{
				var result = syncProvider.apply(resource, args);
				if(!resource.resolved) callback(result);
			});
		});
		if(!Array.isArray(inputs)) inputs = [inputs];
		for(var i = 0; i < inputs.length; i++)
		{
			var input = inputs[i];
			resource.addInput(input);
		}
		return resource;
	}

	Resource.dependAsync = function(inputs, asyncProvider)
	{
		if(!inputs) return new Resource(asyncProvider);
		var resource = new Resource(function(callback)
		{
			Resource.all(resource.inputs, function(args)
			{
				asyncProvider.call(resource, args, callback);
			});
		});
		if(!Array.isArray(inputs)) inputs = [inputs];
		for(var i = 0; i < inputs.length; i++)
		{
			var input = inputs[i];
			resource.addInput(input);
		}
		return resource;
	}

	Resource.listen = function(inputs, callback)
	{
		var resource = Resource.depend(inputs, callback);
		resource.eager = true;
		resource.request();
		return resource;
	}

	if(true) module.exports = Resource;

/***/ },
/* 8 */
/***/ function(module, exports) {

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

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict'

	var util = __webpack_require__(2);

	// var request = require('request');

	module.exports = {
		'!': (v) => !v,
		'==': (a, b) => a === b,
		'!=': (a, b) => a !== b,
		'>': (a, b) => a > b,
		'<': (a, b) => a < b,
		'>=': (a, b) => a >= b,
		'<=': (a, b) => a <= b,
		'&&': (a, b) => a && b,
		'||': (a, b) => a || b,
		'+'(a, b) {return arguments.length == 1 ? +a : a + b},
		'-'(a, b) {return arguments.length == 1 ? -b : b - b},
		'*': (a, b) => a * b,
		'/': (a, b) => a / b,
		'%': util.async(function(args, done, scope)
		{
			var a = args[0], b = args[1];
			if(typeof b === 'function')
			{
				util.invoke(b, a, [a], done, scope);
			}
			else
			{
				done(a % b);
			}
		}),
		'<>'(a, b)
		{
			var list = [];
			for(var i = a; i <= b; i++)
			{
				list.push(i);
			}
			return list;
		},
		'>>'(a, b)
		{
			var list = [];
			for(var i = a; i < b; i++)
			{
				list.push(i);
			}
			return list;
		},
		'^': util.async(function(args, done, scope)
		{
			var target = args[0], transform = args[1];
			var i = 0;
			util.all(target, (value, done) => transform([value, i++], done), done);
		}),
		'~': util.async(function(args, done, scope)
		{
			var target = args[0], transform = args[1];
			var i = 0;
			util.all(target, (value, done) => transform([value, i++], done), (flags) =>
			{
				var list = [];
				for(var i = 0; i < flags.length; i++)
				{
					if(flags[i])
					{
						list.push(target[i]);
					}
				}
				done(list);
			});
		}),
		'^^': util.async(function(args, done, scope)
		{
			var target = args[0], transform = args[1];
			var i = 0;
			reduce(target[i]);
			function reduce(value)
			{
				i++;
				if(i >= target.length) return done(value);
				
				util.invoke(transform, value, [value, target[i]], reduce);
			}
		}),
		scope: util.async(function(args, done, scope)
		{
			done(args.length ? scope[args[0]] : scope);
		}),
		sleep: util.async(function(args, done)
		{
			setTimeout(() => done(args[1]), args[0]);
		}),
		Debug:
		{
			log()
			{
				console.log.apply(console, arguments);
				return arguments[0];
			},
			break: util.async(function(args, done, scope)
			{
				console.log.apply(null, args);
				console.log('Scope: ', scope);
			}),
		},
		// HTTP:
		// {
		// 	get(args, done)
		// 	{
		// 		request.get(args[0], (err, res, body) =>
		// 		{
		// 			if(err) throw err;
		// 			done(res, body);
		// 		});
		// 	},
		// },
		Object, JSON, Math,
	}

/***/ }
/******/ ]);