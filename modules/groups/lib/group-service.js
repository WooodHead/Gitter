'use strict';

var env = require('gitter-web-env');
var stats = env.stats;
var config = env.config;
var Promise = require('bluebird');
var _ = require('lodash');
var Group = require('gitter-web-persistence').Group;
var Troupe = require('gitter-web-persistence').Troupe;
var TroupeUser = require('gitter-web-persistence').TroupeUser;
var assert = require('assert');
var validateGroupName = require('gitter-web-validators/lib/validate-group-name');
var validateGroupUri = require('gitter-web-validators/lib/validate-group-uri');
var StatusError = require('statuserror');
var policyFactory = require('gitter-web-permissions/lib/policy-factory');
var debug = require('debug')('gitter:app:groups:group-service');
var mongooseUtils = require('gitter-web-persistence-utils/lib/mongoose-utils');
var ensureAccessAndFetchDescriptor = require('gitter-web-permissions/lib/ensure-access-and-fetch-descriptor');
var lazy = require('lazy.js');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');


/**
 * Find a group given an id
 */
function findById(groupId) {
  return Group.findById(groupId)
    .lean()
    .exec();
}

function findByIds(ids) {
  return mongooseUtils.findByIds(Group, ids);
}

/**
 * Find a group given a URI
 */
function findByUri(uri) {
  assert(uri, 'uri required');
  return Group.findOne({ lcUri: uri.toLowerCase() })
    .lean()
    .exec();
}

/**
 *
 */
function upsertGroup(user, groupInfo, securityDescriptor) {
  var uri = groupInfo.uri;
  var name = groupInfo.name || uri;
  var lcUri = uri.toLowerCase();

  return mongooseUtils.upsert(Group, { lcUri: lcUri }, {
      $setOnInsert: {
        name: name,
        uri: uri,
        lcUri: lcUri,
        sd: securityDescriptor
      }
    })
    .spread(function(group, updateExisting) {
      if (!updateExisting) {
        /* Send a stat for a new group */
        stats.event('new_group', {
          uri: uri,
          groupId: group._id,
          userId: user._id
        });
      }

      return group;
    });
}

/**
 * @private
 */
function ensureAccessAndFetchGroupInfo(user, options) {
  options = options || {};

  var name = options.name;
  var uri = options.uri;
  var security = options.security || 'PUBLIC';
  assert(user, 'user required');
  assert(name, 'name required');
  assert(uri, 'uri required');

  if (!validateGroupName(name)) {
    throw new StatusError(400, 'Invalid group name');
  }

  if (!validateGroupUri(uri)) {
    throw new StatusError(400, 'Invalid group uri: ' + uri);
  }

  // we only support public groups for now
  if (security !== 'PUBLIC') {
    throw new StatusError(400, 'Invalid group security: ' + security);
  }

  return findByUri(uri)
    .then(function(group) {
      if (group) {
        throw new StatusError(400, 'Group uri already taken: ' + uri);
      }

      return ensureAccessAndFetchDescriptor(user, options)
        .then(function(securityDescriptor) {
          return [{
            name: name,
            uri: uri
          }, securityDescriptor];
        });
    })
}

/**
 * Create a new group
 */
function createGroup(user, options) {
  if (!config.get("project-splitsville:enabled")) {
    if (!options.type && options.uri && options.uri[0] !== '_') {
      throw new StatusError(400, 'Non-GitHub community URIs MUST be prefixed by an underscore for now.');
    }
  }

  return ensureAccessAndFetchGroupInfo(user, options)
    .spread(function(groupInfo, securityDescriptor) {
      debug("Upserting %j", groupInfo);
      return upsertGroup(user, groupInfo, securityDescriptor);
    });
}



/**
 * @private
 */
function canUserAdminGroup(user, group, obtainAccessFromGitHubRepo) {
  return policyFactory.createPolicyForGroupIdWithRepoFallback(user, group._id, obtainAccessFromGitHubRepo)
    .then(function(policy) {
      return policy.canAdmin();
    });
}

/**
 * During the migration only
 *
 * Ensures that a group exists
 */
function ensureGroupForGitHubRoomCreation(user, options) {
  var uri = options.uri;
  var name = options.name || uri;
  var obtainAccessFromGitHubRepo = options.obtainAccessFromGitHubRepo;

  debug('ensureGroupForGitHubRoomCreation: name=%s uri=%s', name, uri)
  assert(user, 'user required');
  assert(uri, 'name required');

  return findByUri(uri)
    .then(function(existingGroup) {

      if (existingGroup) {
        debug('Existing group found');
        return canUserAdminGroup(user, existingGroup, obtainAccessFromGitHubRepo)
          .then(function(adminAccess) {
            debug('Has admin access? %s', adminAccess);

            if (!adminAccess) throw new StatusError(403, 'Cannot create a room under ' + uri);
            return existingGroup;
          });
      }

      debug('No existing group. Will create. obtainAccessFromGitHubRepo=%s', obtainAccessFromGitHubRepo);
      return createGroup(user, {
        type: 'GH_GUESS', // how do we know if it is a GH_ORG or GH_USER? or GH_REPO?
        name: name,
        uri: uri,
        linkPath: uri.split('/')[0], // does this make sense? or rather uri?
        obtainAccessFromGitHubRepo: obtainAccessFromGitHubRepo
      });
    });
}

function filterPrivateRoomsForUser(groupId, userId, troupeIds) {
  return TroupeUser.distinct('troupeId', { userId: userId, troupeId: { $in: troupeIds } })
    .exec()
    .then(function(troupeIds) {
      // TODO: add extraMember and extraAdmin rooms
      return troupeIds;
    })
}

/**
 * Returns true if a userId can be found in an array of objectIds

 * @private
 */
function isInExtraArray(userId, arrayOfUserIds) {
  if (!arrayOfUserIds || !arrayOfUserIds.length) return false;

  return _.some(arrayOfUserIds, function(item) {
    return mongoUtils.objectIDsEqual(item, userId);
  });
}

function findRoomsIdForGroup(groupId, userId) {
  assert(groupId, 'groupId is required');

  var query, select;
  if (userId) {
    query = { groupId: groupId };
    select = {
      _id: 1,
      'sd.public': 1,
      'sd.extraMembers': 1,
      'sd.extraAdmins': 1,
    };
  } else {
    query = { groupId: groupId, 'sd.public': true };
    select = {
      _id: 1,
      'sd.public': 1,
    };
  }

  return Troupe.find(query, select)
    .then(function(troupes) {
      if (!troupes.length) return [];

      var troupeSeq = lazy(troupes);

      var publicRooms = troupeSeq.filter(function(troupe) {
          return troupe.sd && troupe.sd.public;
        })
        .map(function(f) {
          return f._id;
        });

      if (!userId) {
        return publicRooms.toArray();
      }

      var privateRoomSeq = troupeSeq.filter(function(troupe) {
        return troupe.sd && !troupe.sd.public;
      });

      if (privateRoomSeq.isEmpty()) {
        return publicRooms.toArray();
      }

      var explicitAccessPrivateRooms = privateRoomSeq.filter(function(troupe) {
          if (isInExtraArray(userId, troupe.extraMembers)) return true;
          if (isInExtraArray(userId, troupe.extraAdmins)) return true;

          return false;
        })
        .map(function(f) {
          return f._id;
        });

      var memberAccessPrivateRooms = privateRoomSeq.filter(function(troupe) {
          if (isInExtraArray(userId, troupe.extraMembers)) return false;
          if (isInExtraArray(userId, troupe.extraAdmins)) return false;

          return true;
        })
        .map(function(f) {
          return f._id;
        });

      var privatePlusExplicit = publicRooms.concat(explicitAccessPrivateRooms);

      if (memberAccessPrivateRooms.isEmpty()) {
        return privatePlusExplicit.toArray();
      }

      return filterPrivateRoomsForUser(groupId, userId, memberAccessPrivateRooms.toArray())
        .then(function(accessiblePrivateRooms) {
          return privatePlusExplicit.concat(lazy(accessiblePrivateRooms)).toArray();
        });

      // Resolve membership in private rooms

    });
}

/**
 * Given an existing room, ensures that the room has a room
 */
function ensureGroupForRoom(room, user) {
  if (room.groupId) {
    return findById(room.groupId);
  }
  var githubType = room.githubType;

  // One-to-one rooms will never have a group
  if (room.oneToOne || githubType === 'ONETOONE') {
    return null;
  }

  var splitUri = room.uri.split('/');

  var groupUri = splitUri[0];
  var obtainAccessFromGitHubRepo;

  switch(githubType) {
    case 'REPO':
      assert.strictEqual(splitUri.length, 2);
      obtainAccessFromGitHubRepo = room.uri;
      break;

    case 'REPO_CHANNEL':
      assert.strictEqual(splitUri.length, 3);
      obtainAccessFromGitHubRepo = splitUri.slice(0, 2);
      break;

    case 'ORG':
      assert.strictEqual(splitUri.length, 1);
      break;

    case 'USER_CHANNEL':
    case 'ORG_CHANNEL':
      assert.strictEqual(splitUri.length, 3);
      break;

    default:
      throw new StatusError(500, 'Unknown room type: ' + room.githubType);
  }

  return findByUri(groupUri)
    .then(function(group) {
      if (group) return group;

      return createGroup(user, {
        type: 'GH_GUESS', // could be a GH_ORG or GH_USER
        name: groupUri,
        uri: groupUri,
        linkPath: groupUri,
        obtainAccessFromGitHubRepo: obtainAccessFromGitHubRepo
      });
    })
    .tap(function(group) {
      if (!group) return;
      var groupId = group._id;
      room.groupId = groupId;

      return Troupe.update({ _id: room._id }, { $set: { groupId: groupId } })
        .exec();

      // The room is now part of the group.
      // TODO: Technically we should issue a live collection update to all the rooms users
      // but we're going to skip this for now.
    });
}

/**
 * A user is creating a channel. They need a group
 */
function ensureGroupForUser(user) {
  var groupUri = user.username;
  return findByUri(groupUri)
    .then(function(group) {
      if (group) return group;

      return createGroup(user, {
        type: 'GH_USER',
        name: groupUri,
        uri: groupUri,
        linkPath: groupUri
      });
    });
  }

module.exports = {
  findByUri: Promise.method(findByUri),
  findById: Promise.method(findById),
  findByIds: findByIds,
  createGroup: Promise.method(createGroup),
  findRoomsIdForGroup: Promise.method(findRoomsIdForGroup),
  migration: {
    upsertGroup: upsertGroup,
    ensureGroupForGitHubRoomCreation: ensureGroupForGitHubRoomCreation,
    ensureGroupForRoom: Promise.method(ensureGroupForRoom),
    ensureGroupForUser: Promise.method(ensureGroupForUser)
  }
};