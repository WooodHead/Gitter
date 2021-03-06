"use strict";

var userService = require("gitter-web-users");
var UserStrategy = require('./user-strategy');

var idStrategyGenerator = require('gitter-web-serialization/lib/id-strategy-generator');

var UserIdStrategy = idStrategyGenerator('UserIdStrategy', UserStrategy, userService.findByIds);

UserIdStrategy.slim = function(options) {
  var strategy = UserStrategy.slim(options);
  return UserIdStrategy.withStrategy(strategy);
}

module.exports = UserIdStrategy;
