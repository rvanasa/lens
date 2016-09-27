var lens = require("../src/lens");

var Environment = require('./src/env');

describe("Lens Parser", () =>
{
	it("should parse a basic Hello World file", (done) =>
	{
		var env = new Environment(__dirname);

		env.import('Script', (config) =>
		{
			console.log('->', config);
			
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
			
			done();
		});
	});
});