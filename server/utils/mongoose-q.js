"use strict";

var mongoose = require('mongoose');
var Q = require('bluebird-q');

// Switch over to Bluebird soon!
// mongoose.Promise = require('bluebird'); //Q.Promise;

mongoose.Promise = Q.Promise;

module.exports = mongoose;
