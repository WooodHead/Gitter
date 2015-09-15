/*jslint node:true, unused:true*/
/*global describe:true, it:true */
"use strict";

var assert = require('assert');
var testRequire = require('../../test-require');
var resolveRoomAvatarUrl = testRequire('../shared/avatars/resolve-room-avatar-url');

describe('avatar url generator', function() {

  it('should create an avatar url for a repo room', function() {

    var result = resolveRoomAvatarUrl('/gitterHQ/gitter');

    assert.equal(result, 'https://avatars1.githubusercontent.com/gitterHQ?s=48');
  });

  it('should create an avatar url for a one to one room', function() {

    var result = resolveRoomAvatarUrl('trevorah');

    assert.equal(result, 'https://avatars1.githubusercontent.com/trevorah?s=48');
  });

});
