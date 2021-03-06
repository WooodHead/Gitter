#!/usr/bin/env node
'use strict';

process.env.NO_AUTO_INDEX = 1;

var shutdown = require('shutdown');
var persistence = require('gitter-web-persistence');
var indexManager = require('gitter-web-persistence/lib/index-manager');

function getModels() {
  return Object.keys(persistence)
    .filter(function(key) {
      return key !== 'schemas';
    })
    .map(function(key) {
      return persistence[key];
    });
}

indexManager.ensureIndices(getModels())
  .then(function() {
    console.log('Complete');
    shutdown.shutdownGracefully();
  })
  .catch(function(err) {
    console.log(err.stack || err);
    shutdown.shutdownGracefully(1);
  })
