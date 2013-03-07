/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var redis = require('../utils/redis');
var winston = require("winston");
var redisClient = redis.createClient();

// Default strategy for matching a clientId to a userId
// Note that if the redis faye engine is used, this should match
function RedisClientUserLookupStrategy() {
}

RedisClientUserLookupStrategy.prototype.associate = function(clientId, userId, callback) {
  var multi = redisClient.multi();
  multi.set("pr:socket:" + clientId, userId);
  multi.sadd("pr:user:" + userId, clientId);
  multi.exec(function(err) {
    callback(err);
  });
};

RedisClientUserLookupStrategy.prototype.disassociate = function(clientId, callback) {
  redisClient.get("pr:socket:" + clientId, function(err, userId) {
    if(err) return callback(err);

    if(!userId) {
      winston.warn("userLookup: Client " + clientId + " not found. Cannot disassociate.");
      return callback(null, null);
    }

    redisClient.srem("pr:user:" + userId, clientId, function(err) {
      callback(err, userId);
    });

  });
};

RedisClientUserLookupStrategy.prototype.lookupUserIdForClientId = function(clientId, callback) {
  redisClient.get("pr:socket:" + clientId, callback);
};


RedisClientUserLookupStrategy.prototype.lookupClientIdsForUserId = function(userId, callback) {
  redisClient.smembers("pr:user:" + userId, callback);
};


// Default strategy for matching a clientId to a userId
// Note that if the redis faye engine is used, this should match
// TODO: implement redis version
function InMemoryClientUserLookupStrategy() {
  this.clientHash = {};
  this.userHash = {};
}

InMemoryClientUserLookupStrategy.prototype.associate = function(clientId, userId, callback) {
  this.clientHash[clientId] = userId;
  var clientIds = this.userHash[userId];
  if(clientIds) {
    clientIds.push(clientId);
  } else {
    clientIds = [clientId];
    this.userHash[userId] = clientIds;
  }

  return callback();
};

InMemoryClientUserLookupStrategy.prototype.disassociate = function(clientId, callback) {
  var userId = this.clientHash[clientId];
  delete this.clientHash[clientId];

  if(userId) {
    var clientIds = this.userHash[userId];
    if(clientIds) {
      if(clientIds.length > 0) {
        clientIds = clientIds.filter(function(f) { return f !== clientId; });
      }

      // Anything left in the array?
      if(clientIds.length > 0) {
        this.userHash[userId] = clientIds;
      } else {
        delete this.userHash[userId];
      }
    }

  } else {
    winston.warn("userLookup: Client " + clientId + " not found.");
  }

  return callback(null, userId);
};

InMemoryClientUserLookupStrategy.prototype.lookupUserIdForClientId = function(clientId, callback) {
  var userId = this.clientHash[clientId];
  return callback(null, userId);
};


InMemoryClientUserLookupStrategy.prototype.lookupClientIdsForUserId = function(userId, callback) {
  var clientIds = this.userHash[userId];
  return callback(null, clientIds);
};


module.exports = {
  InMemoryClientUserLookupStrategy: InMemoryClientUserLookupStrategy,
  RedisClientUserLookupStrategy: RedisClientUserLookupStrategy
};
