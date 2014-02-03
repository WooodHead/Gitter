/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var Q             = require('q');
var lazy          = require('lazy.js');
var troupeService = require('./troupe-service');
var persistence   = require('./persistence-service');
var appEvents     = require('../app-events');
var winston       = require('../utils/winston');
var moment        = require('moment');
var _             = require('underscore');

/* const */
var LEGACY_FAV_POSITION = 1000;

function generateRoomListForUser(userId) {
  return Q.all([
      findFavouriteTroupesForUser(userId),
      getTroupeLastAccessTimesForUser(userId)
    ])
    .spread(function(favourites, lats) {
      var sortedRooms = lazy(favourites)
                              .pairs()
                              .sortBy(function(a) { return isNaN(a[1]) ? 1000 : a[1]; }) // XXX: ? operation no longer needed
                              .pluck(function(a) { return a[0]; });

      var recentTroupeIds = lazy(lats)
                              .pairs()
                              .sortBy(function(a) { return a[1]; }) // Sort on the date
                              .reverse()                            // Reverse the sort (desc)
                              .pluck(function(a) { return a[0]; })  // Pick the troupeId
                              .without(sortedRooms);                // Remove any favourites

      var troupeIds = sortedRooms
                              .concat(recentTroupeIds); // Add recents

      var positions = troupeIds
                              .map(function(v, i) {
                                return [v, i];
                              })
                              .toObject();

      return [troupeService.findByIds(troupeIds.toArray()), positions];
    })
    .spread(function(rooms, positions) {
      var sorted = lazy(rooms)
                .sortBy(function(room) { return positions[room.id]; })
                .toArray();

      return sorted;
    });

}

/**
 * Called when the user removes a room from the left hand menu
 */
function removeRecentRoomForUser(userId, troupe) {
  winston.verbose('recent-rooms: removeRecentRoomForUser');

  var troupeId = troupe.id;
  return Q.all([
      clearFavourite(userId, troupeId),
      clearLastVisitedTroupeforUserId(userId, troupeId)
    ])
    .then(function() {
      var troupeUser = troupe.findTroupeUser(userId);
      if(troupeUser.notify === 0) {
        return troupeService.removeUserFromTroupe(troupeId, userId);
      } else {
        // TODO: in future get rid of this but this collection is used by the native clients
        appEvents.dataChange2('/user/' + userId + '/troupes', 'patch', { id: troupeId, favourite: null, lastAccessTime: null });
      }

    });
  // TODO: stop double events
}


/**
 * Internal call
 */
function addTroupeAsFavouriteInLastPosition(userId, troupeId) {
  winston.verbose('recent-rooms: addTroupeAsFavouriteInLastPosition');

  return findFavouriteTroupesForUser(userId)
    .then(function(userTroupeFavourites) {
      var lastPosition = lazy(userTroupeFavourites)
        .values()
        .concat(0)
        .max() + 1;

      var setOp = {};
      setOp['favs.' + troupeId] = lastPosition;

      winston.verbose('recent-rooms: using position ' + lastPosition);

      return persistence.UserTroupeFavourites.updateQ(
        { userId: userId },
        { $set: setOp },
        { upsert: true })
        .thenResolve(lastPosition);
    });
}


function addTroupeAsFavouriteInPosition(userId, troupeId, position) {
  winston.verbose('recent-rooms: addTroupeAsFavouriteInPosition ' + position);

  return findFavouriteTroupesForUser(userId)
    .then(function(userTroupeFavourites) {
      winston.verbose('recent-rooms: user favourites before: ', userTroupeFavourites);

      var values = lazy(userTroupeFavourites)
        .pairs()
        .filter(function(a) {
          return a[1] >= position && a[0] != troupeId;
        })
        .sortBy(function(a) {
          return a[1];
        })
        .toArray();

      var next = position;
      // NB: used to be i = 1
      for(var i = 0; i < values.length; i++) {
        var item = values[i];

        if(item[1] > next) {
          /* Only increment those values before this one */
          values.splice(i, values.length);
          break;
        }
        /* This dude needs an increment */
        item[1]++;
        next = item[1];
      }

      var inc = lazy(values)
        .map(function(a) {
          return ['favs.' + a[0], 1];
        })
        .toObject();

      var set = {};
      set['favs.' + troupeId] = position;

      winston.verbose('recent-rooms: Issuing changes: ', { set: set, inc: inc });

      return persistence.UserTroupeFavourites.updateQ(
        { userId: userId },
        { $set: set, $inc: inc },
        { upsert: true })
        .thenResolve(position);
    });

}

function clearFavourite(userId, troupeId) {
  winston.verbose('recent-rooms: clearFavourite', { userId: userId, troupeId: troupeId });

  var setOp = {};
  setOp['favs.' + troupeId] = 1;

  return persistence.UserTroupeFavourites.updateQ(
    { userId: userId },
    { $unset: setOp },
    { })
    .thenResolve(null);
}

function updateFavourite(userId, troupeId, favouritePosition) {
  winston.verbose('recent-rooms: updateFavourite', { userId: userId, troupeId: troupeId, position: favouritePosition});
  var op;

  if(favouritePosition) {
    /* Deal with legacy, or when the star button is toggled */
    if(favouritePosition === true) {
      op = addTroupeAsFavouriteInLastPosition(userId, troupeId);
    } else {
      op = addTroupeAsFavouriteInPosition(userId, troupeId, favouritePosition);
    }
  } else {
    // Unset the favourite
    op = clearFavourite(userId, troupeId);
  }


  return op.then(function(position) {
    winston.verbose('recent-rooms: position is now: ' + position);

    // TODO: in future get rid of this but this collection is used by the native clients
    appEvents.dataChange2('/user/' + userId + '/troupes', 'patch', { id: troupeId, favourite: position });
  });

}

function findFavouriteTroupesForUser(userId, callback) {

  return persistence.UserTroupeFavourites.findOneQ({ userId: userId})
    .then(function(userTroupeFavourites) {
      if(!userTroupeFavourites || !userTroupeFavourites.favs) return {};

      return lazy(userTroupeFavourites.favs)
              .pairs()
              .map(function(a) {
                // Replace any legacy values with 1000
                if(a[1] === '1') a[1] = LEGACY_FAV_POSITION;
                return a;
              })
              .toObject();
    })
    .nodeify(callback);
}



/**
 * Internal call
 */
function clearLastVisitedTroupeforUserId(userId, troupeId) {
  winston.verbose("recent-rooms: Clearing last visited Troupe for user: " + userId+ " to troupe " + troupeId);

  var setOp = {};
  setOp['troupes.' + troupeId] = 1;

  return Q.all([
      // Update UserTroupeLastAccess
      persistence.UserTroupeLastAccess.updateQ(
         { userId: userId },
         { $unset: setOp },
         { upsert: true })
    ]);
}

/**
 * Internal function
 */
function saveUserTroupeLastAccessWithLimit(userId, troupeId) {
  var lastAccessTime = new Date();


  var setOp = {};
  setOp['troupes.' + troupeId] = lastAccessTime;

  return persistence.UserTroupeLastAccess.updateQ(
     { userId: userId },
     { $set: setOp },
     { upsert: true });
}

/**
 * Update the last visited troupe for the user, sending out appropriate events
 * Returns a promise of nothing
 */
function saveLastVisitedTroupeforUserId(userId, troupeId, callback) {
  winston.verbose("recent-rooms: Saving last visited Troupe for user: " + userId+ " to troupe " + troupeId);

  var lastAccessTime = new Date();

  var setOp = {};
  setOp['troupes.' + troupeId] = lastAccessTime;

  return Q.all([
      saveUserTroupeLastAccessWithLimit(userId, troupeId),
      // Update User
      persistence.User.updateQ({ _id: userId }, { $set: { lastTroupe: troupeId }})
    ])
    .then(function() {
      // XXX: lastAccessTime should be a date but for some bizarre reason it's not
      // serializing properly
      appEvents.dataChange2('/user/' + userId + '/troupes', 'patch', { id: troupeId, lastAccessTime: moment(lastAccessTime).toISOString() });
    })
    .nodeify(callback);
}

/**
 * Get the last access times for a user
 * @return promise of a hash of { troupeId1: accessDate, troupeId2: accessDate ... }
 */
function getTroupeLastAccessTimesForUser(userId, callback) {
  return persistence.UserTroupeLastAccess.findOneQ({ userId: userId }).then(function(userTroupeLastAccess) {
    if(!userTroupeLastAccess || !userTroupeLastAccess.troupes) return {};

    return userTroupeLastAccess.troupes;
  }).nodeify(callback);
}


/**
 * Find the last troupe that a user accessed that the user still has access to
 * that hasn't been deleted
 * @return promise of a troupe (or null)
 */
function findLastAccessedTroupeForUser(user, callback) {
  return persistence.Troupe.findQ({ 'users.userId': user.id, 'status': 'ACTIVE' }).then(function(activeTroupes) {
    if (!activeTroupes || activeTroupes.length === 0) return null;

    return getTroupeLastAccessTimesForUser(user.id)
      .then(function(troupeAccessTimes) {
        activeTroupes.forEach(function(troupe) {
          troupe.lastAccessTime = troupeAccessTimes[troupe._id];
        });

        var troupes = _.sortBy(activeTroupes, function(t) {
          return (t.lastAccessTime) ? t.lastAccessTime : 0;
        }).reverse();

        var troupe = _.find(troupes, function(troupe) {
          return troupeService.userHasAccessToTroupe(user, troupe);
        });

        return troupe;
      });

  }).nodeify(callback);

}


/**
 * Find the best troupe for a user to access
 * @return promise of a troupe or null
 */
function findBestTroupeForUser(user, callback) {
  //
  // This code is invoked when a user's lastAccessedTroupe is no longer valid (for the user)
  // or the user doesn't have a last accessed troupe. It looks for all the troupes that the user
  // DOES have access to (by querying the troupes.users collection in mongo)
  // If the user has a troupe, it takes them to the last one they accessed. If the user doesn't have
  // any valid troupes, it returns an error.
  //
  var op;
  if (user.lastTroupe) {
     op = troupeService.findById(user.lastTroupe)
      .then(function(troupe) {

        if(!troupe || troupe.status == 'DELETED' || !troupeService.userHasAccessToTroupe(user, troupe)) {
          return findLastAccessedTroupeForUser(user);
        }

        return troupe;
      });

  } else {
    op = findLastAccessedTroupeForUser(user);
  }

  return op.nodeify(callback);
}

/**
 * EXPORTS
 */
[
  generateRoomListForUser,
  removeRecentRoomForUser,
  findFavouriteTroupesForUser,
  updateFavourite,
  getTroupeLastAccessTimesForUser,
  saveLastVisitedTroupeforUserId,
  findBestTroupeForUser
].forEach(function(e) {
  exports[e.name] = e;
});