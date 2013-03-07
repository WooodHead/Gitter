/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var PushNotificationDevice = require("./persistence-service").PushNotificationDevice;
var winston = require("winston").prefix("notifications");
var nconf = require('../utils/config');
var _ = require('underscore');
var redis = require("../utils/redis"),
    redisClient = redis.createClient();


var minimumUserAlertIntervalS = nconf.get("notifications:minimumUserAlertInterval");


exports.registerAppleDevice = function(deviceId, deviceToken, deviceName, callback) {
  PushNotificationDevice.findOneAndUpdate(
    { deviceId: deviceId },
    { deviceId: deviceId, appleToken: deviceToken, deviceType: 'APPLE', deviceName: deviceName, timestamp: new Date() },
    { upsert: true },
    callback);
};

exports.registerAppleUser = function(deviceId, userId, callback) {
  PushNotificationDevice.findOneAndUpdate(
    { deviceId: deviceId },
    { deviceId: deviceId, userId: userId, deviceType: 'APPLE', timestamp: new Date() },
    { upsert: true },
    callback);
};

exports.findDevicesForUser = function(userId, callback) {
  PushNotificationDevice.find({ userId: userId }, callback);
};

exports.findUsersWithDevices = function(userIds, callback) {
  userIds = _.uniq(userIds);
  PushNotificationDevice.distinct('userId', { userId: { $in: userIds } }, callback);
};

exports.findDevicesForUsers = function(userIds, callback) {
  userIds = _.uniq(userIds);
  PushNotificationDevice
    .where('userId').in(userIds)
    .exec(callback);
};


exports.findUsersAcceptingNotifications = function(userIds, callback) {
  userIds = _.uniq(userIds);

  var multi = redisClient.multi();
  userIds.forEach(function(userId) {
    multi.exists("nb:" + userId);
  });

  multi.exec(function(err, replies) {
    if(err) return callback(err);

    var response = [];
    replies.forEach(function(reply, index) {
      var userId = userIds[index];
      if(reply === 0) {
        response.push(userId);
      }
    });

    callback(null, response);
  });
};

exports.findAndUpdateUsersAcceptingNotifications = function(userIds, callback) {
  userIds = _.uniq(userIds);

  winston.info("findAndUpdateUsersAcceptingNotifications", { userIds: userIds });

  var multi = redisClient.multi();
  userIds.forEach(function(userId) {
    multi.msetnx("nb:" + userId, "1");
  });

  multi.exec(function(err, replies) {
    if(err) return callback(err);

    var m2 = redisClient.multi();
    var response = [];
    replies.forEach(function(reply, index) {
      var userId = userIds[index];
      if(reply === 1) {
        response.push(userId);
        m2.expire("nb:" + userId, minimumUserAlertIntervalS);
      }
    });

    if(response) {
      m2.exec(function(err/*, replies*/) {
        if(err) return callback(err);

        callback(null, response);
      });
    } else {
      callback(null, response);
    }

  });
};


