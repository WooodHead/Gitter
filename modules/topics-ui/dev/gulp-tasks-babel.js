'use strict';

var gulp = require('gulp');
var babel = require('gulp-babel');

function babelPipeline(rootDir) {
  return gulp.src(rootDir + '/containers/**/*.{js,jsx}')
    .pipe(babel({
      plugins: [
        "jsx-strip-ext"
      ]
    }));
}

module.exports = babelPipeline;
