#!/usr/bin/env node
/*jslint node:true, unused:true */
"use strict";

var userService = require('../../server/services/user-service');
var pushNotificationGateway = require('../../server/gateways/push-notification-gateway');
var shutdown = require('shutdown');
var Q = require('q');
var onMongoConnect = require('../../server/utils/on-mongo-connect');

var opts = require("nomnom")
  .option('username', {
    position: 0,
    required: true,
    help: "username to send badge update to"
  })
  .parse();

onMongoConnect()
  .then(function() {
    return userService.findByUsername(opts.username);
  })
  .then(function(user) {
    return user._id;
  })
  .then(function(userId) {
    return pushNotificationGateway.sendUsersBadgeUpdates([userId]);
  })
  .delay(5000)
  .then(function() {
    shutdown.shutdownGracefully();
  })
  .catch(function(err) {
    console.error(err.stack);
    shutdown.shutdownGracefully(1);
  });
