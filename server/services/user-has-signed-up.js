/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var persistence = require('./persistence-service');

function userHasSignedUp(username) {
  // TODO: add case insensitve matching for usernames!
  return persistence.User.findOneQ({ username: new RegExp("^" + username + "$", "i") }, 'state', { lean: true })
    .then(function(user) {
      if(!user) return false;
      if(user.state === 'INVITED') return false;

      return true;
    });
}

module.exports = userHasSignedUp;