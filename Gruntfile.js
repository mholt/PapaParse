module.exports = function(grunt) {
	grunt.initConfig({
		uglify: {
			options: {
				preserveComments: 'some',
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
}
