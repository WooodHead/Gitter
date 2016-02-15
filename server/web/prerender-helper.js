"use strict";

var compileTemplate = require('./compile-web-template');
var prerenderWrapper = require('./prerender-wrapper');

var PRERENDERED_VIEWS = [
  //NEW LEFT MENU
  "js/views/menu/room/layout/room-menu-layout",
  "js/views/menu/room/search-input/search-input-view",

  //OLD MENU
  "js/views/menu/old/tmpl/troupeMenu",
  "js/views/menu/old/tmpl/profile",
  "js/views/menu/old/tmpl/org-list-item",

  "js/views/archive/tmpl/archive-navigation-view",
  "js/views/app/tmpl/headerViewTemplate",
  "js/views/app/tmpl/headerViewTemplate",
  "js/views/chat/tmpl/chatInputView",
  "js/views/chat/tmpl/chat-input-box",
  "js/views/chat/tmpl/chat-input-buttons",
  "js/views/chat/tmpl/join-room-view",
  'js/views/people/tmpl/peopleCollectionView',
  /* new */
].reduce(function(memo, v) {
  memo[v] = compileTemplate(v + ".hbs");
  return memo;
}, {});

module.exports = exports = function (templateFile, options) {
  var hash = options.hash;

  var template = PRERENDERED_VIEWS[templateFile];
  if (!template) throw new Error('Template ' + templateFile + ' has not been precompiled.');

  //assign the desktop prop here so it can be passed
  //down to the child template
  //jp 15/12/15
  this.desktop = hash.desktop;

  var inner = template(this);
  var wrap = hash.wrap;
  if (!wrap) return inner;

  var className = hash.className;
  var id = hash.id;
  var dataId = hash.dataId && this.id;

  return prerenderWrapper({
    className: className,
    id: id,
    dataId: dataId,
    wrap: wrap,
    inner: inner
  });
};
