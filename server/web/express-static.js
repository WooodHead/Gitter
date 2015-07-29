/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

exports.install = function(app) {
  var express        = require('express');
  var resolveStatic  = require('./resolve-static');
  var favicon        = require('serve-favicon');

  var webpackMiddleware = require("webpack-dev-middleware");
  var webpack = require('webpack');

  process.env.WEBPACK_DEV_MODE = '1';

  app.use(webpackMiddleware(webpack(require('../../public/js/webpack.config')), {
      noInfo: false,
      quiet: true,
      lazy: false,
      watchOptions: {
        aggregateTimeout: 400
      },
      publicPath: "/_s/l/js/",
      stats: {
          colors: true
      }
  }));

  app.use('/_s/l/styles', express.static('output/assets/styles', {
    maxAge: 0
  }));

  app.use('/_s/l', express.static(resolveStatic(), {
    maxAge: 0
  }));

  app.use(favicon(resolveStatic('favicon.ico')));

};
