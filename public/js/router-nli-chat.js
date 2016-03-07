"use strict";

var appEvents = require('utils/appevents');
var context = require('utils/context');
var Backbone = require('backbone');
var itemCollections = require('collections/instances/integrated-items');
var chatCollection  = require('collections/instances/chats');
var PeopleModal = require('views/modals/people-modal');
var onready = require('./utils/onready');
var frameUtils = require('./utils/frame-utils');
var ChatToolbarLayout = require('views/layouts/chat-toolbar');

/* Set the timezone cookie */
require('components/timezone-cookie');

require('views/widgets/preload');
require('components/dozy');
require('template/helpers/all');
require('components/bug-reporting');

// Preload widgets
require('views/widgets/avatar');
require('components/ping');

onready(function() {

  require('components/link-handler').installLinkHandler();

  appEvents.on('navigation', function(url) {
    // No pushState here. Open links within the parent...
    window.parent.location.href = url;
  });

  appEvents.on('permalink.requested', function(type, chat) {
    if (context.inOneToOneTroupeContext()) return; // No permalinks to one-to-one chats
    var url = context.troupe().get('url');
    var id = chat.id;

    frameUtils.postMessage({ type: 'permalink.requested', url: url, permalinkType: type, id: id });
  });

  var appView = new ChatToolbarLayout({ template: false, el: 'body', chatCollection: chatCollection });
  appView.render();

  var Router = Backbone.Router.extend({
    routes: {
      "": "hideModal",
      "people": "people",
    },

    hideModal: function() {
      appView.dialogRegion.destroy();
    },

    people: function() {
      appView.dialogRegion.show(new PeopleModal({
        rosterCollection: itemCollections.roster
      }));
    },

  });

  new Router();

  // // Listen for changes to the room
  // liveContext.syncRoom();

  Backbone.history.start();

});
