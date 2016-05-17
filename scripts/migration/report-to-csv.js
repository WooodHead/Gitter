#!/usr/bin/env node

'use strict';

var JSONStream = require('JSONStream');
var es = require('event-stream');
var fs = require('fs');
var csv = require('fast-csv')
var csvStream = csv.createWriteStream({headers: true})
var writableStream = fs.createWriteStream("owner-report.csv");

var t = es.through(function write(data) {
  data.rooms.forEach(function(room) {
    this.emit('data', { id: data._id, uri: room.uri, githubType: room.githubType, security: room.security, userCount: room.userCount, probably: room.probably});
  }, this)
});

fs.createReadStream('/Users/leroux/owner-report.json')
  .pipe(JSONStream.parse('unknown.*'))
  .pipe(t)
  .pipe(csvStream)
  .pipe(writableStream);
