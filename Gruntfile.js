module.exports = function(grunt) {
	grunt.initConfig({
		uglify: {
			options: {
				output: {
					comments: 'some',
				},
			},
			min: {
				files: {
					'papaparse.min.js': ['papaparse.js']
				},
			},
		},
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('build', ['uglify']);
	grunt.registerTask('default', ['uglify']);
};
