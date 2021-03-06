#!/usr/bin/env node
/*jslint node: true */
"use strict";

var env = require('gitter-web-env');
var winston = env.logger;
var presenceService = require('gitter-web-presence');
var userService = require('gitter-web-users');
var shutdown = require('shutdown');

var opts = require('yargs')
  .option('name', {
    alias: 'n',
    type: 'boolean',
    description: 'Display names'
  })
  .help('help')
  .alias('help', 'h')
  .argv;

presenceService.listOnlineUsers(function(err, userIds) {
  if(opts.name) {
    userService.findByIds(userIds, function(err, users) {
      users.forEach(function(user) {
        console.log(user.displayName);
      });

      shutdown.shutdownGracefully();
    });

    return;
  }

  userIds.forEach(function(userId) {
    console.log(userId);
  });
  shutdown.shutdownGracefully();

});
