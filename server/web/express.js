/*jslint node: true */
"use strict";

var express = require('express'),
  passport = require('passport'),
  nconf = require('../utils/config'),
  handlebars = require('handlebars'),
  expressHbs = require('express-hbs'),
  http = require('./http'),
  fineuploaderExpressMiddleware = require('fineuploader-express-middleware');

module.exports = {
  installFull: function(app, server, sessionStore) {
    handlebars.registerHelper('cdn', require('./cdn-helper'));
    app.engine('hbs', expressHbs.express3({
      partialsDir: __dirname + '/../../' + nconf.get('web:staticContent') +'/templates/partials',
      handlebars: handlebars
    }));

    app.set('view engine', 'hbs');
    app.set('views', __dirname + '/../../' + nconf.get('web:staticContent') +'/templates');
    if(nconf.get("express:logging")) {
      app.use(express.logger());
    }



    app.use(express['static'](__dirname + "/../../" + nconf.get('web:staticContent')));

    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(fineuploaderExpressMiddleware());


    app.use(express.session({ secret: 'keyboard cat', store: sessionStore, cookie: { path: '/', httpOnly: true, maxAge: 14400000, domain: nconf.get("web:cookieDomain"), secure: false /*nconf.get("web:secureCookies") Express won't sent the cookie as the https offloading is happening in nginx. Need to have connection.proxySecure set*/ }}));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(require('./rememberme-middleware').rememberMeMiddleware());
    app.use(app.router);

    app.use(express.errorHandler({ showStack: nconf.get('express:showStack'), dumpExceptions: nconf.get('express:dumpExceptions') }));

  },

  installSocket: function(app, server, sessionStore) {
    if(nconf.get("express:logging")) {
      app.use(express.logger());
    }

    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(express.session({ secret: 'keyboard cat', store: sessionStore, cookie: { path: '/', httpOnly: true, maxAge: 14400000, domain: nconf.get("web:cookieDomain"), secure: nconf.get("web:secureCookies") }}));

    app.use(express.errorHandler({ showStack: nconf.get('express:showStack'), dumpExceptions: nconf.get('express:dumpExceptions') }));

  }
};