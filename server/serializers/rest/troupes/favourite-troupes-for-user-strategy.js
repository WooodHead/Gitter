"use strict";

var recentRoomCore = require('gitter-web-rooms/lib/recent-room-core');

function FavouriteTroupesForUserStrategy(options) {
  this.userId = options.userId || options.currentUserId;
  this.favs = null;
}

FavouriteTroupesForUserStrategy.prototype = {
  preload: function() {
    return recentRoomCore.findFavouriteTroupesForUser(this.userId)
      .bind(this)
      .then(function(favs) {
        this.favs = favs;
      });
  },

  map: function(id) {
    var favs = this.favs[id];
    if (!favs) return undefined;
    if (favs === '1') return 1000;
    return favs;
  },

  name: 'FavouriteTroupesForUserStrategy'
};

module.exports = FavouriteTroupesForUserStrategy;
