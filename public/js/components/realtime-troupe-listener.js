"use strict";

var context = require('utils/context');
var realtime = require('./realtime');
var appEvents = require('utils/appevents');

var subscribeCount = 0;

var templateSubscription = realtime.getClient().subscribeTemplate({
  urlTemplate: '/v1/rooms/:troupeId',
  contextModel: context.contextModel(),
  onMessage: function(message) {
    if(message.notification === 'presence') {
      if(message.status === 'in') {
        appEvents.trigger('userLoggedIntoTroupe', message);
      } else if(message.status === 'out') {
        appEvents.trigger('userLoggedOutOfTroupe', message);
      }
    }
  },

  getSnapshotState: function() {
    // True will signal to the server to return the current troupe,
    // including admin permissions, etc
    return subscribeCount > 0;
  },

  handleSnapshot: function(snapshot) {
    // Make sure that snapshot.id == troupe.id as we may have quickly chenged
    // rooms multiple times
    if (context.getTroupeId() !== snapshot.id) return;
    context.setTroupe(snapshot);
  },

  getSubscribeOptions: function() {
    // No need to reassociate the connection on the first subscription
    if (subscribeCount <= 1) return;

    return {
      reassociate: {
        eyeballs: 1 /* TODO: use real eyeballs state */
      }
    };
  }
});

templateSubscription.on('resubscribe', function() {
  subscribeCount++;
});
