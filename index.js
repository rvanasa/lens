// var express = require('express');

var Environment = require('./src/env');

var env = new Environment(process.argv[2] || process.cwd());

env.imports['console'] =
{
	in(args, done)
	{
		process.stdout.write((args[0] || 'input') + ' : ')
		
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (value) =>
		{
			if(!isNaN(+value)) value = +value;
			done(value);
		});
	},
}

env.import('test/lens/Test', (config) =>
{
	console.log('->', config);
	
	// var app = express();
	
	// app.listen(process.env.PORT, process.env.IP);
	
	// app.use((req, res) =>
	// {
	// 	var handle = config[req.method.toUpperCase()];
	// 	if(handle)
	// 	{
	// 		handle([req.path, req], (err, data) =>
	// 		{
	// 			if(err) return res.status(500).send(err.message);
				
	// 			res.status(data.status || 200).send(data.body);
	// 		});
	// 	}
	// });
});
