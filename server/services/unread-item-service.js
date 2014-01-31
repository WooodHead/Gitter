/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService = require("./troupe-service");
var readByService = require("./readby-service");
var appEvents     = require("../app-events");
var _             = require("underscore");
var redis         = require("../utils/redis");
var winston       = require("winston");
var mongoUtils    = require('../utils/mongo-utils');
var RedisBatcher  = require('../utils/redis-batcher').RedisBatcher;
var Scripto       = require('redis-scripto');
var Q             = require('q');
var assert        = require('assert');
var redisClient   = redis.createClient();
var badgeBatcher  = new RedisBatcher('badge', 300);
var scriptManager = new Scripto(redisClient);

scriptManager.loadFromDir(__dirname + '/../../redis-lua/unread');

var EMAIL_NOTIFICATION_HASH_KEY = "unread:email_notify";

function sinceFilter(since) {
  return function(id) {
    var date = mongoUtils.getDateFromObjectId(id);
    return date.getTime() >= since;
  };

}

badgeBatcher.listen(function(key, userIds, done) {
  // Remove duplicates
  userIds = _.uniq(userIds);

  // Get responders to respond
  appEvents.batchUserBadgeCountUpdate({
    userIds: userIds
  });

  done();
});

function republishBadgeForUser(userId) {
  badgeBatcher.add('queue', userId);
}

/**
 * Returns the key array used by the redis scripts
 */
function getScriptKeysForUserIds(userIds, itemType, troupeId) {
  var unreadKeys = userIds.map(function(userId) {
    return "unread:" + itemType + ":" + userId + ":" + troupeId;
  });

  var badgeKeys = userIds.map(function(userId) {
    return "ub:" + userId;
  });

  return unreadKeys.concat(badgeKeys);
}

/**
 * Returns the key array used by the redis scripts
 */
function getMentionScriptKeysForUserIds(userIds, troupeId) {
  var unreadKeys = userIds.map(function(userId) {
    return "m:" + userId + ":" + troupeId;
  });

  var badgeKeys = userIds.map(function(userId) {
    return "ub:" + userId;
  });

  return unreadKeys.concat(badgeKeys);
}

var runScript = Q.nbind(scriptManager.run, scriptManager);

function upgradeKeyToSortedSet(key, userBadgeKey, troupeId, callback) {
  winston.verbose('unread-item-key-upgrade: attempting to upgrade ' + key);

  // Use a new client due to the WATCH semantics
  var redisClient = redis.createClient();

  function done(err) {
    if(err) {
      winston.verbose('unread-item-key-upgrade: upgrade failed' + err, { exception: err });
    } else {
      winston.verbose('unread-item-key-upgrade: upgrade completed successfully');
    }

    redisClient.quit();
    return callback(err);
  }

  /**
   * Fairly certain that we don't need the userBadgeKey in the lock.
   * If we did so, changes to other userTroupes could starve this
   * transaction. Also all changes to the specific key on the userBadge
   * that we are changing will always affect the `key` too so we'll
   * be safe from inconsistencies that way.
   *
   * IF WE'RE GETTING INCONSISTENCIES, review this later!
   */
  redisClient.watch(key, function(err) {
    if(err) return done(err);

    redisClient.type(key, function(err, keyType) {
      if(err) return done(err);

      /* Go home redis, you're drunk */
      keyType = ("" + keyType).trim();

      /* If the key isn't a set our job is done */
      if(keyType != 'set') {
        winston.verbose('unread-item-key-upgrade: upgrade already happened: type=' + keyType);
        return done();
      }

      redisClient.smembers(key, function(err, itemIds) {
        if(err) return done(err);

        var multi = redisClient.multi();

        var zaddArgs = [key];

        var itemIdsWithScores = itemIds.map(function(itemId) {
          var timestamp = mongoUtils.getTimestampFromObjectId(itemId);

          /* ZADD score member */
          return [timestamp, itemId];
        });


        /* Sort by timestamp */
        itemIdsWithScores.sort(function(a, b) {
          return a[0] - b[0];
        });

        /* Truncate down to 100 */
        itemIdsWithScores = itemIdsWithScores.slice(-100);

        itemIdsWithScores.forEach(function(itemWithScore) {
          /* ZADD score member */
          zaddArgs.push(itemWithScore[0], itemWithScore[1]);
        });

        multi.del(key);
        multi.zadd.apply(multi, zaddArgs);
        multi.zrem(userBadgeKey, troupeId);
        multi.zadd(userBadgeKey, itemIdsWithScores.length, troupeId);

        multi.exec(function(err) {
          if(err) return done(err);
        });

      });


    });
  });


}

/**
 * New item added
 * @return {promise} promise of nothing
 */
function newItem(troupeId, creatorUserId, itemType, itemId) {
  if(!troupeId) { winston.error("newitem failed. Troupe cannot be null"); return; }
  if(!itemType) { winston.error("newitem failed. itemType cannot be null"); return; }
  if(!itemId) { winston.error("newitem failed. itemId cannot be null"); return; }

  return troupeService.findUserIdsForTroupeWithLurk(troupeId)
    .then(function(userIdsWithLurk) {
      var userIds = Object.keys(userIdsWithLurk);

      if(creatorUserId) {
        userIds = userIds.filter(function(userId) {
          return ("" + userId) != ("" + creatorUserId);
        });
      }

      // Publish out an new item event
      var data = {};
      data[itemType] = [itemId];
      userIds.forEach(function(userId) {
        appEvents.newUnreadItem(userId, troupeId, data);
      });

      var userIdsForNotify = userIds.filter(function(u) {
        return !userIdsWithLurk[u];
      });

      if(!userIdsForNotify.length) return;

      return newItemForUsers(troupeId, itemType, itemId, userIdsForNotify);
    });
}

function newItemForUsers(troupeId, itemType, itemId, userIds) {
  // Now talk to redis and do the update
  var keys = getScriptKeysForUserIds(userIds, itemType, troupeId);

  var timestamp = mongoUtils.getTimestampFromObjectId(itemId);

  return runScript('unread-add-item', keys, [troupeId, itemId, timestamp])
    .then(function(result) {
      // Results come back as two items per key in sequence
      // * 2*n value is the new badge count (or -1 for don't update)
      // * 2*n+1 value is a bitwise collection, 1 = badge update, 2 = upgrade key
      for(var i = 0; i < result.length; i = i + 2) {
        var troupeUnreadCount   = result[i];
        var flag                = result[i + 1];
        var badgeUpdate         = flag & 1;
        var upgradeKey          = flag & 2;
        var userId              = userIds[i >> 2];

        if(troupeUnreadCount >= 0) {
          // Notify the user
          appEvents.troupeUnreadCountsChange({
            userId: userId,
            troupeId: troupeId,
            total: troupeUnreadCount
          });
        }

        if(badgeUpdate) {
          republishBadgeForUser(userId);
        }

        if(upgradeKey) {
          var key = "unread:" + itemType + ":" + userId + ":" + troupeId;
          var userBadgeKey = "ub:" + userId;

          // Upgrades can happen asynchoronously
          upgradeKeyToSortedSet(key, userBadgeKey, troupeId, function(err) {
            if(err) {
              winston.info('unread-item-key-upgrade: failed. This is not as serious as it sounds, optimistically locked. ' + err, { exception: err });
            }
          });
        }
      }


      /**
       * Put these users on a list of people who may need a reminder email
       * at a later stage
       */
      var timestamp = mongoUtils.getTimestampFromObjectId(itemId);
      markUsersForEmailNotification(troupeId, userIds, timestamp);
    });


}

/**
 * Item removed
 * @return {promise} promise of nothing
 */
function removeItem(troupeId, itemType, itemId) {
  if(!troupeId) { winston.error("newitem failed. Troupe cannot be null"); return; }
  if(!itemType) { winston.error("newitem failed. itemType cannot be null"); return; }
  if(!itemId) { winston.error("newitem failed. itemId cannot be null"); return; }

  return troupeService.findUserIdsForTroupeWithLurk(troupeId)
    .then(function(userIdsWithLurk) {

      var userIds = Object.keys(userIdsWithLurk);

      // Publish out an unread item removed event
      // TODO: we could actually check whether this user thinks this item is UNREAD
      var data = {};
      data[itemType] = [itemId];
      userIds.forEach(function(userId) {
        appEvents.unreadItemsRemoved(userId, troupeId, data);
      });

      var userIdsForNotify = userIds.filter(function(u) {
        return !userIdsWithLurk[u];
      });

      if(!userIdsForNotify.length) return;

      var keys = userIdsForNotify.reduce(function(memo, userId) {
          memo.push(
            "unread:" + itemType + ":" + userId + ":" + troupeId,
            "ub:" + userId,
            "m:" + userId + ":" + troupeId);

          return memo;
        }, []);

      return runScript('unread-remove-item', keys, [troupeId, itemId])
        .then(function(result) {
          // Results come back as two items per key in sequence
          // * 2*n value is the new user troupe count (or -1 for don't update)
          // * 2*n+1 value is a flag. 0 = nothing, 1 = update badge
          for(var i = 0; i < result.length; i = i + 2) {
            var troupeUnreadCount   = result[i];
            var flag                = result[i + 1];
            var badgeUpdate         = flag & 1;
            var userId              = userIdsForNotify[i >> 2];

            if(troupeUnreadCount >= 0) {
              // Notify the user. If the unread count is zero,
              // the client should zero out it's
              appEvents.troupeUnreadCountsChange({
                userId: userId,
                troupeId: troupeId,
                total: troupeUnreadCount
              });
            }

            if(badgeUpdate) {
              republishBadgeForUser(userId);
            }
          }

        });

  });
}

/**
 * Mark an item in a troupe as having been read by a user
 * @return {promise} promise of nothing
 */
function markItemsOfTypeRead(userId, troupeId, itemType, ids) {
  assert(userId, 'Expected userId');
  assert(troupeId, 'Expected troupeId');
  assert(itemType, 'Expected itemType');

  if(!ids.length) return; // Nothing to do

  var keys = [
      "ub:" + userId,
      "unread:" + itemType + ":" + userId + ":" + troupeId,
      EMAIL_NOTIFICATION_HASH_KEY,
      "m:" + userId + ":" + troupeId
    ];

  var values = [troupeId, userId].concat(ids);

  return runScript('unread-mark-items-read', keys, values)
    .then(function(result) {
      var troupeUnreadCount   = result[0];
      var flag                = result[1];
      var badgeUpdate         = flag & 1;

      if(troupeUnreadCount >= 0) {
        // Notify the user
        appEvents.troupeUnreadCountsChange({
          userId: userId,
          troupeId: troupeId,
          total: troupeUnreadCount
        });
      }

      if(badgeUpdate) {
        republishBadgeForUser(userId);
      }
    });
}

function markUsersForEmailNotification(troupeId, userIds, dateNow) {
  var values = [dateNow];
  values.push.apply(values, userIds.map(function(f) { return troupeId + ':' + f; }));

  return runScript('unread-mark-users-for-email', [EMAIL_NOTIFICATION_HASH_KEY], values)
    .fail(function(err) {
      winston.error('unread-mark-users-for-email failed:' + err, { exception: err });
    });

}

/**
 * Mark an item in a troupe as having been read by a user
 * @return {promise} promise of nothing
 */
function setLastReadTimeForUser(userId, troupeId, lastReadTimestamp) {
  assert(userId, 'Expected userId');
  assert(lastReadTimestamp, 'Expected lastReadTimestamp');

  return Q.ninvoke(redisClient, "mset",
    "lrt:" + userId, lastReadTimestamp,
    "lrtt:" + userId + ":" + troupeId, lastReadTimestamp);
}

/**
 * Returns a hash of hash {user:troupe:ids} of users who have
 * outstanding notifications since before the specified time
 * @return a promise of hash
 */
exports.listTroupeUsersForEmailNotifications = function(sinceTime) {
  return Q.ninvoke(redisClient, "hgetall", EMAIL_NOTIFICATION_HASH_KEY)
    .then(function(troupeUserHash) {
      var result = {};

      if (!troupeUserHash) return result;

      var promises = Object.keys(troupeUserHash)
        .map(function(key) {
          var troupeUserId = key.split(':');
          var time = parseInt(troupeUserHash[key], 10);

          var troupeId = troupeUserId[0];
          var userId = troupeUserId[1];

          /* Its got to be older that the start time */
          if(time <= sinceTime) {

            return getUnreadItemsForUserTroupeSince(userId, troupeId, time)
              .then(function(items) {

                if(items && items.chat && items.chat.length) {
                  var v = result[userId];
                  if(!v) {
                    v = { };
                    result[userId] = v;
                  }

                  v[troupeId] = items && items.chat;
                }
              });
          }
        });

      return Q.all(promises)
        .then(function() {
          return result;
        });
    });
};

exports.markUserAsEmailNotified = function(userId) {
  // NB: this function is not atomic, but it doesn't need to be
  return Q.ninvoke(redisClient, "hgetall", EMAIL_NOTIFICATION_HASH_KEY)
    .then(function(troupeUserHash) {
      return Object.keys(troupeUserHash)
        .filter(function(hashKey) {
          var troupeUserId = hashKey.split(':');
          var hashUserId = troupeUserId[1];
          return hashUserId == userId;
        });
    })
    .then(function(userTroupeKeys) {
      var args =[EMAIL_NOTIFICATION_HASH_KEY];
      args.push.apply(args, userTroupeKeys);

      return Q.npost(redisClient, "hdel", args);

    });
};

/**
 * Mark many items as read, for a single user and troupe
 */
exports.markItemsRead = function(userId, troupeId, itemIds, mentionIds, options) {
  var now = Date.now();

  var allIds = [];
  if(itemIds) allIds = allIds.concat(itemIds);
  if(mentionIds) allIds = allIds.concat(mentionIds);

  appEvents.unreadItemsRemoved(userId, troupeId, { chat: itemIds }); // TODO: update

  return Q.all([
    markItemsOfTypeRead(userId, troupeId, 'chat', allIds),
    setLastReadTimeForUser(userId, troupeId, now),
    mentionIds && mentionIds.length && removeMentionForUser(userId, troupeId, mentionIds)
    ])
    .then(function() {
      if(options && options.recordAsRead === false) return;

      // For the moment, we're only bothering with chats for this
      return readByService.recordItemsAsRead(userId, troupeId, { chat: allIds }); // TODO: drop the hash
    });

};

exports.markAllChatsRead = function(userId, troupeId, callback) {
  // TODO: add in mentions!!
  exports.getUnreadItems(userId, troupeId, 'chat')
    .then(function(chatIds) {
      if(!chatIds.length) return;
      /* Don't mark the items as read */
      return exports.markItemsRead(userId, troupeId, chatIds, null, { recordAsRead: false });
    })
    .nodeify(callback);
};

exports.getUserUnreadCounts = function(userId, troupeId, callback) {
  var key = "unread:chat:" + userId + ":" + troupeId;
  return runScript('unread-item-count', [key])
    .then(function(result) {
      return result || 0;
    })
    .nodeify(callback);
};

exports.getUserUnreadCountsForTroupeIds = function(userId, troupeIds, callback) {

  var keys = troupeIds.map(function(troupeId) {
    return "unread:chat:" + userId + ":" + troupeId;
  });

  return runScript('unread-item-count', keys)
    .then(function(replies) {
      return troupeIds.reduce(function(memo, troupeId, index) {
        memo[troupeId] = replies[index];
        return memo;
      }, {});

    })
    .nodeify(callback);
};

exports.getUserMentionCountsForTroupeIds = function(userId, troupeIds, callback) {
  var multi = redisClient.multi();

  troupeIds.forEach(function(troupeId) {
    multi.scard("m:" + userId + ":" + troupeId);
  });

  var d = Q.defer();

  multi.exec(function(err, replies) {
    if(err) return d.reject(err);

    var result = troupeIds.reduce(function(memo, troupeId, index) {
      memo[troupeId] = replies[index];
      return memo;
    }, {});

    d.resolve(result);
  });

  return d.promise.nodeify(callback);
};

/** Returns hash[userId] = unixTime for each of the queried users */
exports.findLastReadTimesForUsers = function(userIds, callback) {
  var keysToQuery = userIds.map(function(userId) { return "lrt:" + userId;});
  redisClient.mget(keysToQuery, function(err, times) {
    if(err) return callback(err);
    var result = {};
    times.forEach(function(time, index) {
      if(time) {
        var userId = userIds[index];
        result[userId] = time;
      }
    });

    callback(null, result);
  });
};

/** Returns hash[userId] = unixTime for each of the queried users */
exports.findLastReadTimesForUsersForTroupe = function(userIds, troupeId, callback) {
  var keysToQuery = userIds.map(function(userId) { return "lrtt:" + userId + ":" + troupeId;});
  redisClient.mget(keysToQuery, function(err, times) {
    if(err) return callback(err);
    var result = {};
    times.forEach(function(time, index) {
      if(time) {
        var userId = userIds[index];
        result[userId] = time;
      }
    });

    callback(null, result);
  });
};


exports.getUnreadItems = function(userId, troupeId, itemType, callback) {
  var keys = ["unread:" + itemType + ":" + userId + ":" + troupeId];
  return runScript('unread-item-list', keys)
    .fail(function(err) {
      winston.warn("unreadItemService.getUnreadItems failed:" + err, { exception: err });
      // Mask error
      return [];
    })
    .nodeify(callback);
};

function getUnreadItemsForUserTroupeSince(userId, troupeId, since, callback) {
  return exports.getUnreadItems(userId, troupeId, 'chat')
    .then(function(chatItems) {
      chatItems = chatItems.filter(sinceFilter(since));

      var response = {};
      if(chatItems.length) {
        response.chat = chatItems;
      }

      return response;
    })
    .nodeify(callback);
}

exports.getUnreadItemsForUserTroupeSince = getUnreadItemsForUserTroupeSince;

exports.getFirstUnreadItem = function(userId, troupeId, itemType, callback) {
    exports.getUnreadItems(userId, troupeId, itemType, function(err, members) {
      if(err) {
        winston.warn("unreadItemService.getUnreadItems failed: " + err, { exception: err });

        // Mask error
        return callback(null, null);
      }

      var totalUnreadItems = members.length;
      var minId = getOldestId(members);

      return callback(null, minId, totalUnreadItems);

    });
};

exports.getUnreadItemsForUser = function(userId, troupeId, callback) {
  return exports.getUnreadItems(userId, troupeId, 'chat')
    .then(function(results) {
      return {
        chat: results
      };
    })
    .nodeify(callback);
};

/**
 * Get the badge counts for userIds
 * @return promise of a hash { userId1: 1, userId: 2, etc }
 */
exports.getBadgeCountsForUserIds = function(userIds, callback) {
  var multi = redisClient.multi();

  userIds.forEach(function(userId) {
    multi.zcard("ub:" + userId);
  });

  var d = Q.defer();

  multi.exec(function(err, replies) {
    if(err) return d.reject(err);

    var result = {};

    userIds.forEach(function(userId, index) {
      var reply = replies[index];
      result[userId] = reply;
    });

    d.resolve(result);
  });

  return d.promise.nodeify(callback);
};

function getOldestId(ids) {
  if(!ids.length) return null;

  return _.min(ids, function(id) {
    // Create a new ObjectID with a specific timestamp
    return mongoUtils.getTimestampFromObjectId(id);
  });
}


/**
 * New item added
 * @return {promise} promise of nothing
 */
function newMention(troupeId, chatId, userIds) {
  if(!troupeId) { winston.error("newMention failed. Troupe cannot be null"); return; }
  if(!chatId) { winston.error("newMention failed. itemId cannot be null"); return; }

  // Publish out an new item event
  // var data = {};
  // data[itemType] = [itemId];
  // userIds.forEach(function(userId) {
  //   appEvents.newUnreadItem(userId, troupeId, data);
  // });

  if(!userIds.length) return;

  // Now talk to redis and do the update
  var keys = getMentionScriptKeysForUserIds(userIds, troupeId);

  return runScript('unread-add-mentions', keys, [chatId])
    .then(function(result) {

      // Results come back as two items per key in sequence
      // * 2*n value is the new user troupe count (or -1 for don't update)
      // * 2*n+1 value is a flag. 0 = nothing, 1 = update badge
      for(var i = 0; i < result.length; i++) {
        var mentionCount        = result[i];
        var userId              = userIds[i];

        if(mentionCount >= 0) {
          // Notify the user
          appEvents.troupeMentionCountsChange({
            userId: userId,
            troupeId: troupeId,
            total: mentionCount
          });
        }
      }

      // TODO: email users about their mentions.. Look at newItem
    });
}

/**
 * Remove the mentions and decrement counters
 */
function removeMentionForUser(userId, troupeId, itemIds) {
  if(!itemIds.length) return;

  var key = "m:" + userId + ":" + troupeId;

  return runScript('unread-remove-user-mentions', [key], itemIds)
    .then(function(mentionCount) {

      if(mentionCount >= 0) {
        // Notify the user
        appEvents.troupeMentionCountsChange({
          userId: userId,
          troupeId: troupeId,
          total: mentionCount
        });
      }
    });


}

function detectAndCreateMentions(troupeId, creatingUserId, chat) {
  if(!chat.mentions || !chat.mentions.length) return;

  /* Figure out what type of room this is */
  return troupeService.findById(troupeId)
    .then(function(troupe) {
      if(!troupe) return;

      // XXX: fix this!!
      var publicRoom = true;
      var userIds = chat.mentions
            .map(function(mention) {
              return mention.userId;
            });

      var mentionLurkerAndNonMemberUserIds = [];
      var userIdsForMention = [];

      userIds.forEach(function(userId) {
        if(!userId) return;

        if(userId == creatingUserId) return;

        var troupeUser = troupe.findTroupeUser(userId);
        if(troupeUser) {
          /* User is in the room? Always mention */
          if(troupeUser.lurk) {
            mentionLurkerAndNonMemberUserIds.push(userId);
          } else {
            userIdsForMention.push(userId);
          }
          return;
        }

        /** User isn't in the room, still allow them to
          * receive the mention if it's a public room
          */
        if(publicRoom) {
          mentionLurkerAndNonMemberUserIds.push(userId);
        }

      });

      /**
       * Lurkers and non members wont have an unread item, so the first thing
       * we'll need to do is create an unread item for them. Only then can we push the
       * mention
       */
      if(mentionLurkerAndNonMemberUserIds.length) {
        return newItemForUsers(troupeId, 'chat', chat.id, mentionLurkerAndNonMemberUserIds)
          .then(function() {
            var allUserIds = mentionLurkerAndNonMemberUserIds.concat(userIdsForMention);

            return newMention(troupeId, chat.id, allUserIds);
          });
      } else {
        return newMention(troupeId, chat.id, userIdsForMention);
      }

    });

}

function detectAndRemoveMentions(troupeId, creatingUserId, chat) {
  if(!chat.mentions) return;
  // XXX: remove the mention
}


exports.install = function() {

  appEvents.localOnly.onChat(function(data) {
    var operation = data.operation;
    var troupeId = data.troupeId;
    var model = data.model;

    if(!model) {
      winston.warn('No data model in onDataChangeEvent', { data: data});
      return;
    }

    var modelId = model.id;
    var creatingUserId = model.fromUser && model.fromUser.id;
    var promise;

    if(operation === 'create') {
      promise = newItem(troupeId, creatingUserId, 'chat', modelId);

      promise = promise.then(function() {
        detectAndCreateMentions(troupeId, creatingUserId, model);
      });

    } else if(operation === 'remove') {
      promise = removeItem(troupeId, 'chat', modelId);

      promise = promise.then(function() {
        detectAndRemoveMentions(troupeId, creatingUserId, model);
      });
    }

    if(promise) {
      promise.fail(function(err) {
        winston.error('unreadItemService failure: ' + err, { exception: err });
        throw err;
      });
    }

  });
};

exports.testOnly = {
  getOldestId: getOldestId,
  sinceFilter: sinceFilter,
  newItem: newItem,
  removeItem: removeItem
};
