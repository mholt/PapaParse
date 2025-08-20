module.exports = function(grunt) {
	grunt.initConfig({
		uglify: {
			options: {
				compress: {
					global_defs: {
						'PAPA_BROWSER_CONTEXT': true
					},
					dead_code: true
				},
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
