'use strict';

const Promise = require('bluebird');
const path = require('path');
const gulp = require('gulp');

const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer-core');
const mqpacker = require('css-mqpacker');
const csswring = require('csswring');
const styleBuilder = require('./style-builder');
const getSourceMapOptions = require('./get-sourcemap-options');
const webpack = require('webpack-stream');
const uglify = require('gulp-uglify');
const childProcessPromise = require('./child-process-promise');
const extractUrls = require('./extract-urls');

var opts = require('yargs')
  .option('android', {
    type: 'boolean',
    default: false,
    description: 'Output'
  })
  .option('ios', {
    type: 'boolean',
    default: false,
    description: 'Output'
  })
  .help('help')
  .alias('help', 'h')
  .argv;

let buildPath;
if(opts.android) {
  buildPath = 'output/android/www/';
}
else if(opts.ios) {
  buildPath = 'output/ios/www/';
}
else {
  throw new Error('Please define the --android of --ios args when running the embedded build')
}

/**
 * Hook into the compile stage
 */
gulp.task('embedded:compile', [
  'clientapp:compile:copy-files',
  'embedded:compile:markup',
  'embedded:compile:css',
  'embedded:compile:webpack'
]);

// We also copy files after the CSS is compiled in `embedded:post-compile:copy-linked-assets`
gulp.task('clientapp:compile:copy-files', function() {
  return gulp.src([
      'public/images/emoji/*',
      // 'public/sprites/**',
      'public/repo/katex/**',
    ], {
      base: './public',
      stat: true
    })
    .pipe(gulp.dest(buildPath));
});

gulp.task('embedded:compile:markup', function() {
  const args = [
    path.join(__dirname, './render-embedded-chat.js'),
    '--output', path.join(buildPath, 'mobile/embedded-chat.html'),
  ];
  if(opts.android) {
    args.push('--android');
  }
  if(opts.ios) {
    args.push('--ios');
  }

  return childProcessPromise.spawn('node', args, Object.assign({}, process.env, {
    // Default to prod config
    NODE_ENV: process.env.NODE_ENV || 'prod'
  }));
});

const cssIosStyleBuilder = styleBuilder([
  'public/less/mobile-native-chat.less'
], {
  dest: path.join(buildPath, 'styles'),
  watchGlob: 'public/**/*.less',
  sourceMapOptions: getSourceMapOptions(),
  lessOptions: {
    paths: ['public/less'],
    globalVars: {
      'target-env': '"mobile"'
    }
  },
  streamTransform: function(stream) {
    return stream
      .pipe(postcss([
        autoprefixer({
          browsers: ['ios_saf >= 6'],
          cascade: false
        }),
        mqpacker,
        csswring
      ]));
  }
});

gulp.task('embedded:compile:css', function() {
  return cssIosStyleBuilder.build();
});

/* Generate embedded native */
gulp.task('embedded:compile:webpack', ['clientapp:compile:copy-files'], function() {
  return gulp.src('./public/js/webpack-mobile-native.config')
    .pipe(webpack(require('../public/js/webpack-mobile-native.config')))
    .pipe(gulp.dest(path.join(buildPath, 'js')));
});

gulp.task('embedded:post-compile', [
  'embedded:post-compile:uglify',
  'embedded:post-compile:copy-linked-assets'
]);

gulp.task('embedded:post-compile:uglify', function() {
  return gulp.src(path.join(buildPath, 'js/*.js'))
    .pipe(uglify())
    .pipe(gulp.dest(path.join(buildPath, 'js')));
});

gulp.task('embedded:post-compile:copy-linked-assets', function() {
  return Promise.all([
    extractUrls(path.join(buildPath, 'styles/mobile-native-chat.css'), buildPath),
  ])
    .then((resourceLists) => {
      const resourceList = resourceLists.reduce((list, resultantList) => {
        return resultantList.concat(list);
      }, []);

      return gulp.src(resourceList, {
          base: './public',
          stat: true
        })
        .pipe(gulp.dest(buildPath));
    })
});
