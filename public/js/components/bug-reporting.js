/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'require',
  'utils/context'
], function(require, context) {
  "use strict";

  var ravenUrl = context.env('ravenUrl');
  if(ravenUrl) {
    require(['raven'], function(Raven) {
      Raven.config(ravenUrl, {
          // # we highly recommend restricting exceptions to a domain in order to filter out clutter
          // whitelistUrls: ['example.com/scripts/']
      }).install();

      var user = context.user();
      Raven.setUser({
        username: user && user.get('username')
      });
    });

  }



});