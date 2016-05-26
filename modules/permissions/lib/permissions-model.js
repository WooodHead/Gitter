"use strict";

var env = require('gitter-web-env');
var winston = env.logger;
var Promise = require('bluebird');
var userIsBannedFromRoom = require('./user-banned-from-room');

var repoPermissionsModel = require('./models/repo-permissions-model');
var orgPermissionsModel = require('./models/org-permissions-model');
var oneToOnePermissionsModel = require('./models/one-to-one-permissions-model');
var orgChannelPermissionsModel = require('./models/org-channel-permissions-model');
var repoChannelPermissionsModel = require('./models/repo-channel-permissions-model');
var userChannelPermissionsModel = require('./models/user-channel-permissions-model');
var debug = require('debug')('gitter:app:permissions-model');
var appEvents = require('gitter-web-appevents');

function checkBan(user, uri) {
  if(!user) return Promise.resolve(false);
  if(!uri) return Promise.resolve(false);

  return userIsBannedFromRoom(uri, user);
}

var ALL_RIGHTS = {
  create: 1,
  join: 1,
  admin: 1,
  adduser: 1,
  view: 1
};

/**
 * Main entry point
 */
function permissionsModel(user, right, uri, roomType, security) {
  function log(x) {
    debug("Permission: user=%s, uri=%s, roomType=%s, granted=%s, right=%s", user && user.username, uri, roomType, x, right);
    return x;
  }

  if(!right) return Promise.reject(new Error('right required'));

  if(!ALL_RIGHTS.hasOwnProperty(right)) {
    return Promise.reject(new Error('Invalid right:' + right));
  }

  if(!roomType) return Promise.reject(new Error('roomType required'));

  var submodel = {
    'REPO': repoPermissionsModel,
    'ORG': orgPermissionsModel,
    'ONETOONE': oneToOnePermissionsModel,
    'ORG_CHANNEL': orgChannelPermissionsModel,
    'REPO_CHANNEL': repoChannelPermissionsModel,
    'USER_CHANNEL': userChannelPermissionsModel
  }[roomType];

  if(!submodel) {
    return Promise.reject(new Error('Invalid roomType ' + roomType));
  }

  if(roomType !== 'ONETOONE' && !uri) {
    // For now uri can be null for one to one
    // This will need to be fixed before we handle
    // more fine grained permissions
    return Promise.reject(new Error('uri required'));
  }

  return checkBan(user, uri)
    .then(function(banned) {
      if(banned) return false;

      return submodel(user, right, uri, security)
        .then(log)
        .catch(function(err) {
          if(err && err.gitterAction === 'logout_destroy_user_tokens') {
            if (user) {
              winston.warn('User tokens have been revoked. Destroying tokens');
              appEvents.destroyUserTokens(user._id);
            }
          }

          throw err;
        });

    });
}

module.exports = permissionsModel;
