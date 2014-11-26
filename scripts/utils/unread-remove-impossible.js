var redis = require('../../server/utils/redis');
var userService = require('../../server/services/user-service');
var roomService = require('../../server/services/room-service');
var troupeService = require('../../server/services/troupe-service');
var unreadService = require('../../server/services/unread-item-service');
var Q = require('q');
var shutdown = require('shutdown');
var _ = require('underscore');

function getKeys() {
  var redisClient = redis.getClient();
  return Q.ninvoke(redisClient, 'keys', 'unread:chat:*');
}

function convertToHash(unreadKeys) {
  var hash = {};
  unreadKeys.forEach(function(unreadKey) {
    var parts = unreadKey.split(':');
    var userId = parts[2];
    var roomId = parts[3];

    var roomIds = hash[userId] || [];

    roomIds.push(roomId);
    hash[userId] = roomIds;
  });

  return hash;
}

function markAllWeirdRoomsAsReadForUser(userId, roomIds) {
  var promises = roomIds.map(function(roomId) {
    return unreadService.markAllChatsRead(userId, roomId, { member: false, recordAsRead: false });
  });

  return Q.all(promises);
}

function findAllWeirdRoomIdsForUser(userId, userUnreadRoomIds) {
  return roomService.findAllRoomsIdsForUserIncludingMentions(userId)
    .then(function(userRoomIds) {
      return _.difference(userUnreadRoomIds, userRoomIds);
    });
}

function logResult(userId, weirdRoomIds) {
  return Q.all([
    userService.findById(userId),
    troupeService.findByIds(weirdRoomIds)
  ]).spread(function(user, weirdRooms) {
    var weirdRoomNames = weirdRooms.map(function(room) { return room.uri; });
    var dbMisses = weirdRoomIds.length - weirdRooms.length;

    var log = [user && user.username || '('+userId+')', ':'].concat(weirdRoomNames).concat('with '+dbMisses+' missing rooms').concat(weirdRoomIds).join(' ');

    console.log('cleared', log);
  });
}

function markAllWeirdRoomsAsRead(hash) {
  var promises = Object.keys(hash).map(function(userId) {
    return findAllWeirdRoomIdsForUser(userId, hash[userId])
      .then(function(weirdRoomIds) {
        if (weirdRoomIds.length) {
          return markAllWeirdRoomsAsReadForUser(userId, weirdRoomIds)
            .then(function() {
              return logResult(userId, weirdRoomIds);
            });
        }
      });
  });

  return Q.all(promises);
}

getKeys()
  .then(convertToHash)
  .then(markAllWeirdRoomsAsRead)
  .delay(1000)
  .fail(function(err) {
    console.error(err.stack);
  })
  .delay(10000)
  .fin(function() {
    shutdown.shutdownGracefully();
  });