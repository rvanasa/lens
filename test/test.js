var fs = require('fs');

var Environment = require('../src/env');

var testDir = __dirname + '/lens';

var env = new Environment(testDir);

for(var name of fs.readdirSync(testDir))
{
	console.log('Running test:', name);
	env.import([name.replace(/\.lens$/, '')], (result) =>
	{
		console.log('->', result);
	});
}