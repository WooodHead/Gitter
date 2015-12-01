"use strict";

var testRequire = require('../test-require');
var assert = require('assert');
var Q = require('q');
var testGenerator = require('../test-generator');

// All of our fixtures
var FIXTURES = [{
  name: 'user-is-in-room-public-room',
  meta: {
    banned: false,
    anonymous: false,
    inRoom: true,
    roomSecurity: 'PUBLIC',
    roomGithubType: 'ORG_CHANNEL',
  },
  tests: [
    { requestedPerm: 'read', expectedResult: true },
    { requestedPerm: 'write', recentCheck: false, expectedResult: true },
    { requestedPerm: 'write', recentCheck: true, expectedResult: true },
  ]
}, {
  name: 'banned-users-never-get-access',
  meta: {
    banned: true,
    anonymous: false,
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PUBLIC', inRoom: true, expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PUBLIC', inRoom: false, expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PUBLIC', inRoom: true, expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PUBLIC', inRoom: false, expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO', roomSecurity: 'PUBLIC', inRoom: true, expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO', roomSecurity: 'PUBLIC', inRoom: false, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PUBLIC', inRoom: true, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PUBLIC', inRoom: false, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PUBLIC', inRoom: true, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PUBLIC', inRoom: false, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO', roomSecurity: 'PUBLIC', inRoom: true, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO', roomSecurity: 'PUBLIC', inRoom: false, expectedResult: false },
  ]
}, {
  name: 'anonymous-users-can-only-view-public-rooms',
  meta: {
    banned: false,
    anonymous: true,
    recentCheck: false
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'REPO', roomSecurity: 'PUBLIC', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PUBLIC', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'INHERITED', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PUBLIC', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'INHERITED', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'USER_CHANNEL', roomSecurity: 'PUBLIC', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'USER_CHANNEL', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'ORG', roomSecurity: null, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO', roomSecurity: 'PUBLIC', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PUBLIC', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'INHERITED', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PUBLIC', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'INHERITED', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'USER_CHANNEL', roomSecurity: 'PUBLIC', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'USER_CHANNEL', roomSecurity: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG', roomSecurity: null, expectedResult: false }
  ]
}, {
  name: 'non-members-can-never-access-private-channels',
  meta: {
    banned: false,
    anonymous: false,
    roomSecurity: 'PRIVATE',
    inRoom: false,
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'USER_CHANNEL', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'USER_CHANNEL', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', expectedResult: false }
  ]
}, {
  name: 'non-members-can-access-public-rooms',
  meta: {
    banned: false,
    anonymous: false,
    roomSecurity: 'PUBLIC',
    inRoom: false,
    recentCheck: false,
    roomPermissionsGrantsAccess: false
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'REPO', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'USER_CHANNEL', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'USER_CHANNEL', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', expectedResult: false }
  ]
}, {
  name: 'members-can-access-private-channels',
  meta: {
    banned: false,
    anonymous: false,
    roomSecurity: 'PRIVATE',
    inRoom: true,
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'USER_CHANNEL', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'USER_CHANNEL', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', expectedResult: true }
  ]
},{
  name: 'one-to-ones',
  meta: {
    banned: false,
    anonymous: false,
    roomSecurity: null, // One-to-one rooms have security of `null`
    roomGithubType: 'ONETOONE',
  },
  tests: [
    { requestedPerm: 'read', inRoom: true, expectedResult: true },
    { requestedPerm: 'read', inRoom: false, expectedResult: false },
        { requestedPerm: 'write', inRoom: true, expectedResult: true },
    { requestedPerm: 'write', inRoom: false, expectedResult: false },
  ]
},{
  name: 'user-is-member-of-github-backed-room-with-recent-check',
  meta: {
    banned: false,
    anonymous: false,
    inRoom: true,
    recentCheck: true,
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'ORG', security: null, expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG', security: null, expectedResult: true },
  ]
},{
  name: 'user-is-member-of-github-backed-room-without-recent-check-with-check-success',
  meta: {
    banned: false,
    anonymous: false,
    inRoom: true,
    recentCheck: false,
    roomPermissionsGrantsAccess: true
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'ORG', security: null, expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG', security: null, expectedResult: true },
  ]
},{
  name: 'user-is-member-of-github-backed-room-without-recent-check-with-check-throw',
  meta: {
    banned: false,
    anonymous: false,
    inRoom: true,
    recentCheck: false,
    roomPermissionsGrantsAccess: 'throw'
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: true },
    { requestedPerm: 'read', roomGithubType: 'ORG', security: null, expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: true },
    { requestedPerm: 'write', roomGithubType: 'ORG', security: null, expectedResult: true },
  ]
},{
  name: 'user-is-member-of-github-backed-room-without-recent-check-with-check-failure',
  meta: {
    banned: false,
    anonymous: false,
    inRoom: true,
    recentCheck: false,
    roomPermissionsGrantsAccess: false,
    expectRemoveRoomMember: true
  },
  tests: [
    { requestedPerm: 'read', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'read', roomGithubType: 'ORG', security: null, expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG_CHANNEL', security: 'INHERITED', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO_CHANNEL', security: 'INHERITED', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'REPO', security: 'PRIVATE', expectedResult: false },
    { requestedPerm: 'write', roomGithubType: 'ORG', security: null, expectedResult: false },
  ]
}];

var count = 0;

describe('user-can-access-room', function() {
  testGenerator(FIXTURES, function(name, meta) {
    var banned = meta.banned;
    var anonymous = meta.anonymous;
    var inRoom = meta.inRoom;
    var roomSecurity = meta.roomSecurity;
    var roomGithubType = meta.roomGithubType;
    var recentCheck = meta.recentCheck;
    var roomPermissionsGrantsAccess = meta.roomPermissionsGrantsAccess;
    var expectedResult = meta.expectedResult;
    var expectRemoveRoomMember = meta.expectRemoveRoomMember;
    var removeRoomMemberCount = 0;
    var requestedPerm = meta.requestedPerm;

    var userId = anonymous ? null : "56587d431f74b2c84cecb8db";
    var troupeId = "56587cfb6628d29f4e8d150d";

    var testName = '#' + (++count) + ' ' +
      Object.keys(meta)
        .filter(function(f) { return !!meta[f]; })
        .map(function(k) { return k + '=' + meta[k]; }).join(', ');

    it(testName, function(done) {

      var persistence = {
        Troupe: {
          findById: function() {
            return {
              exec: function() {
                return Q.resolve({
                  _id: troupeId,
                  security: roomSecurity,
                  githubType: roomGithubType,
                  bans: banned ? [userId] : undefined
                });
              }
            };
          }
        }
      };

      var dolph = {
        rateLimiter: function() {
          return function(key, rate, callback) {
            if (recentCheck !== true && recentCheck !== false) {
              assert.ok(false, 'Unexpected call to rateLimiter');
            }

            return callback(null, recentCheck ? 2 : 1);
          };
        }
      };

      var userService = {
        findById: function() {
          assert(!anonymous);
          return Q.resolve({ _id: userId });
        }
      };

      var troupeService = {
        findById: function() {
          return Q.resolve({ _id: troupeId });
        }
      };

      var roomPermissionsModel = function() {
        assert(!anonymous);
        if (roomPermissionsGrantsAccess !== true && roomPermissionsGrantsAccess !== false && roomPermissionsGrantsAccess !== "throw" ) {
          assert.ok(false, 'Unexpected call to roomPermissionsModel');
        }

        if (roomPermissionsGrantsAccess === "throw") {
          return Q.reject(new Error('Backend is down'));
        }

        return Q.resolve(roomPermissionsGrantsAccess);
      };

      var roomMembershipService = {
        checkRoomMembership: function() {
          assert(!anonymous);
          return Q.resolve(inRoom);
        },
        removeRoomMember: function() {
          assert(expectRemoveRoomMember);
          removeRoomMemberCount++;
          return Q.resolve();
        }
      };

      var userCanAccessRoom = testRequire.withProxies("./services/user-can-access-room", {
        './persistence-service': persistence,
        'dolph': dolph,
        './user-service': userService,
        './troupe-service': troupeService,
        './room-permissions-model': roomPermissionsModel,
        './room-membership-service': roomMembershipService
      });

      var func;
      if (requestedPerm === 'read') {
        func = userCanAccessRoom.permissionToRead;
      } else if (requestedPerm === 'write') {
        func = userCanAccessRoom.permissionToWrite;
      } else {
        return done(new Error('requestedPerm not set'));
      }

      func(userId, troupeId)
        .then(function(result) {
          if(expectedResult !== 'throw') {
            assert.strictEqual(result, expectedResult);
            if (expectRemoveRoomMember) {
              assert.strictEqual(removeRoomMemberCount, 1);
            }
          } else {
            assert(false, 'Expected the permission model to throw an exception');
          }
        }, function(err) {
          if(expectedResult !== 'throw') throw err;

          if (expectRemoveRoomMember) {
            assert.strictEqual(removeRoomMemberCount, 1);
          }
        })
        .nodeify(done);
    });

  });
});
