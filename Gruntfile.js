module.exports = function(grunt)
{
	grunt.loadNpmTasks('grunt-contrib-uglify');
	
	grunt.registerTask('default', ['uglify']);
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		build: {
	        src: 'src/<%= pkg.name %>.js',
	        dest: 'build/<%= pkg.name %>.min.js'
	      }
	});
};