#!/usr/bin/env node

/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var _ = require('underscore');
var persistence = require('../server/services/persistence-service');
var moment = require('moment');
var nconf = require('../server/utils/config');
var fs = require('fs');
var BatchStream = require('batch-stream');
var through2 = require('through2');
var basePath = nconf.get('web:basepath');
var sitemapLocation = nconf.get('sitemap:location');



var opts = require("nomnom")
  .option('tempdir', {
    abbr: 't',
    required: true,
    help: 'Where to write the sitemap files to'
  })
  .option('name', {
    abbr: 'n',
    required: true,
    help: 'What to call the sitemap (ie. the prefix)'
  })
  .parse();

function die(error) {
  console.error(error);
  console.error(error.stack);
  process.exit(1);
}

function roomToURL(room) {
  return basePath + '/' + room.uri + '/archives';
}

function createSitemap(urls) {
  var xml = [];
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  urls.forEach(function(url) {
    xml.push('<url>');
    xml.push('<loc>'+url+'</loc>');
    xml.push('<changefreq>daily</changefreq>');
    xml.push('</url>');
  });
  xml.push('</urlset>');
  return xml.join('\n')
}

function createSitemapIndex(urls) {
  var xml = [];

  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" ' +
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');

  urls.forEach(function(url, index) {
    xml.push('<sitemap>');
    xml.push('<loc>' + url + '</loc>');
    xml.push('</sitemap>');
  });

  xml.push('</sitemapindex>');
  return xml.join('\n')
};

var pageNum = 0;
var sitemapURLs = [];
var query = {
  security: 'PUBLIC',
  '$or': [
    {'noindex': {'$exists': false}},
    {'noindex': false}
  ]
};
var projection = { _id: 1, uri: 1 };
var stream = persistence.Troupe
  .find(query, projection)
  .sort({_id: 1})
  .slaveOk()
  .stream()
  .pipe(new BatchStream({size: 50000}))
  .pipe(through2.obj(function(rooms, enc, callback) {
    pageNum++;
    var data = {
      url: sitemapLocation.replace('.xml', '-'+pageNum+'.xml'),
      sitemap: createSitemap(rooms.map(roomToURL)),
      pageNum: pageNum
    };
    this.push(data);
    fs.writeFile(opts.tempdir+'/'+opts.name+'-'+data.pageNum+'.xml', data.sitemap, callback);
  }))
  .on('data', function(data) {
    sitemapURLs.push(data.url);
  })
  .on('end', function() {
    var indexData = createSitemapIndex(sitemapURLs);
    fs.writeFile(opts.tempdir+'/'+opts.name+'.xml', indexData, function() {
      process.exit(0);
    });
  })
  .on('error', die);
