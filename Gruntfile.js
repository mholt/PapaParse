module.exports = function(grunt) {

	var headerTemplate = '/* <%= pkg.name %> v<%= pkg.version %> \n' +
		'<%= pkg.homepage %> \n' +
		'Build: <%= grunt.template.today("yyyy-mm-dd") %> */\n';

	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		browserify: {
			client: {
				src: 'main.js',
				dest: 'dist/papaparse.js',
				bundleOptions: {
					debug: true
				},
				options: {
					external: ['jQuery'],
					postBundleCB: function(err, src, next) {
						var header = grunt.template.process(headerTemplate, {pkg: grunt.file.readJSON('package.json')});
						next(err, header + src);
					}
				}
			}
		},
		watch: {
			scripts: {
				files: ['src/*.js', 'main.js'],
				tasks: ['browserify']
			}
		},
		uglify: {
			client: {
				files: {
					'dist/papaparse.min.js': ['dist/papaparse.js']
				},
				options: {
					banner: headerTemplate
				},
				mangle: {
					except: ['jQuery', 'Papa']
				},
				preserveComments: 'none'
			}
		}
	});

	grunt.registerTask('default', ['browserify']);
	grunt.registerTask('dist', ['browserify', 'uglify']);
}