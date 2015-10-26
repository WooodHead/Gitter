#!/usr/bin/env node
/*jslint node:true */
"use strict";

var shutdown = require('shutdown');
var oauthService = require('../../server/services/oauth-service');

var opts = require("nomnom")
   .option('token', {
      abbr: 't',
      required: true,
      help: 'Token to delete'
   })
   .parse();


function runScript(token) {
  return oauthService.deleteToken(token);
}

runScript(opts.token)
  .then(function() {
    shutdown.shutdownGracefully(0);
  })
  .catch(function(e) {
    console.error(e);
    console.error(e.stack);
    shutdown.shutdownGracefully(1);
  })
  .done();