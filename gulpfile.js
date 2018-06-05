/// <binding BeforeBuild='jshint' ProjectOpened='watch' />
(function () {
    'use strict';
    // Include Gulp & tools we'll use
    var gulp = require('gulp'),
        util = require('gulp-util'),
        $ = require('gulp-load-plugins')(),
        del = require('del'),
        fs = require('fs'),
        run = require('run-sequence'),
        LessPluginAutoPrefix = require('less-plugin-autoprefix'),
        browserSync = require('browser-sync').create(),
        historyApiFallback = require('connect-history-api-fallback'),
        pkg = require('./package.json'),
        config = {};

    config = {
        solution: '57e4e4992e74800ef8b69718',
        destination: 'release/' + pkg.version,
        'sdk-version': pkg['sdk-version'],
        'google-api-key': '',
        'google-analytics-key': '',

    };

    var AUTOPREFIXER_BROWSERS = [
        'ie >= 9',
        'ie_mob >= 9',
        'ff >= 30',
        'chrome >= 34',
        'safari >= 7',
        'opera >= 23',
        'ios >= 7',
        'android >= 4.4',
        'bb >= 10'
    ];

    var BUILD_DATE = (function (date) {
        return date.getFullYear().toString() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
    }(new Date()));

    var autoprefix = new LessPluginAutoPrefix({
        browsers: AUTOPREFIXER_BROWSERS
    });

    gulp.task('default', ['build:less', 'serve:dev']);

    gulp.task('watch', function () {
        gulp.watch(['*/**.js', '!node_modules/**', '!release/**'], ["run:jshint"]);
        gulp.watch(['*/**.less', '!node_modules/**', '!release/**'], ["build:less"]);
    });

    gulp.task('run:jshint', function () {
        return gulp.src(['**/*.js', '!node_modules/**', '!release/**'])
            .pipe($.jshint.extract())
            .pipe($.jshint())
            .pipe($.jshint.reporter('jshint-stylish'))
            .pipe($.count('run:jshint: ## files were processed.'));
    });

    // Clean output directory
    gulp.task('clean', function () {
        return del(['.tmp', config.destination]);
    });

    // Copy all assets to output folder
    gulp.task('copy', ['clean'], function () {
        return gulp.src(['assets/**'])
            .pipe(gulp.dest(config.destination + '/assets/'))
            .pipe($.count('copy: ## files were copied.'))
            .pipe($.size({
                title: 'copied'
            }));
    });

    //Compiling less files in to one css file.
    gulp.task('build:less', function () {
        var destination = 'styles/css/';

        return gulp.src(['styles/theme.less'])
            .pipe($.plumber({}))
            .pipe($.sourcemaps.init())
            .pipe($.less({
                plugins: [autoprefix]
            }))
            .pipe($.header('/* This code was generated by a tool. */\r\n\r\n'))
            .pipe($.sourcemaps.write('.'))
            .pipe(gulp.dest(destination))
            .pipe($.count('build:less: ## files where processed and copied.'))
            .on('end', function () {
                browserSync.reload();
            });

    });

    //Minifies the css file created from less files.
    gulp.task('minify:css', ['build:less'], function () {
        return gulp.src('styles/css/theme.css')
            .pipe($.plumber({}))
            .pipe($.replace('../assets/', '../'))
            .pipe($.cleanCss())
            .pipe($.header('/* This code was generated by a tool. */\r\n\r\n'))
            .pipe($.rename({
                suffix: '.min'
            }))
            .pipe(gulp.dest(config.destination + '/assets/css'))
            .pipe($.count('minify:css: ## files where processed and copied.'));
    });

    //Makes a ng-template cache from html templates
    gulp.task('build:ng-templates', function () {
        var options = {
            module: 'MapsIndoors',
            standAlone: true
        };

        return gulp.src(['**/*.tpl.html', '!node_modules/**', '!release/**'])
            .pipe($.minifyHtml({
                empty: true
            }))
            .pipe($.angularTemplatecache('ng-templates.js', options))
            .pipe(gulp.dest('.tmp/'))
            .pipe($.size({
                title: 'ng-templates'
            }));
    });

    gulp.task('build:release', ['clean', 'copy', 'build:less', 'minify:css', 'build:ng-templates'], build);

    gulp.task('serve:dev', ['build:less'], function () {
        var routes = {};
        routes["/app/"] = '.';
        browserSync.init({
            port: 5005,
            startPath: "/app/",
            server: {
                baseDir: ['.'],
				https: true,
                routes: routes,
                directory: true
            },
            middleware: [historyApiFallback()]
        });

        gulp.watch(['**/*.*', '!node_modules/**', '!release/**', '!styles/**', '!gulpfile.js'], browserSync.reload);
        gulp.watch(['styles/**/*.less'], ["build:less"]);
    });

    gulp.task('serve:release', ['build:release'], function () {
        var routes = {};
        routes["/"] = config.destination;
        browserSync.init({
            port: 5006,
            startPath: "/",
            server: {
                baseDir: [config.destination],
                routes: routes,
                directory: true
            },
            middleware: [historyApiFallback()]
        });
    });

    function build() {
        return gulp.src('index.html')
            .pipe($.htmlReplace({
                'base': '<base href="/">',
                'theme': 'assets/css/theme.min.css',
                'MapsIndoors': 'https://d3jdh4j7ox95tn.cloudfront.net/mapsindoors/js/sdk/MapsIndoors-' + config['sdk-version'] + '.min.gz.js?solutionId=' + config.solution
            }))
            .pipe($.replace(/(<script src="\/\/maps\.googleapis\.com\/maps\/api\/js\?v=\d&key=)(.+)?(&libraries=geometry,places"><\/script>)/g, `$1${config['google-api-key'] || '$2'}$3`))
            .pipe($.replace('UA-XXXXX-Y', config['google-analytics-key']))
            .pipe($.inject(gulp.src(['.tmp/ng-templates.js'], {
                read: false
            }), {
                name: 'inject:templates',
                relative: true
            }))
            .pipe($.useref())
            .pipe($.if('*.js', $.ngAnnotate()))
            .pipe($.if('*.js', $.uglify()))
            .pipe($.injectVersion())
            .pipe($.replace('%%BUILD_DATE%%', BUILD_DATE))
            .pipe(gulp.dest(config.destination))
            .pipe($.size({
                title: 'compiled'
            }));
    }
}());