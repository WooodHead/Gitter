'use strict';
var ensurePojo = require('./ensure-pojo');

var rankAttributes = function (fold, attr) {
  var rank = Object.keys(fold).length;
  fold[attr] = rank;
  return fold;
};

var RANK = [
  'lastMentionTime', // most important
  'lastUnreadItemTime',
  'lastAccessTimeNoSync',
  'lastAccessTime' // least important
].reduce(rankAttributes, {});

function natural(a, b) {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function getRank(room) {
  if (room.lastMentionTime) return RANK.lastMentionTime;
  if (room.lastUnreadItemTime) return RANK.lastUnreadItemTime;

  if (room.lastAccessTimeNoSync) {
    return RANK.lastAccessTimeNoSync;
  } else if (room.lastAccessTime) {
    return RANK.lastAccessTime;
  }

  return Object.keys(RANK).length + 1;
}

function timeDifference(a, b, rank) {
  var property = Object.keys(RANK)[rank];
  if (!property) return 0;
  return new Date(b[property]).valueOf() - new Date(a[property]).valueOf();
}

// it is worth noticing that we want to sort in a descindencing order, thus the negative results
module.exports = {
  favourites: {
    sort: function (a, b) {
      a = ensurePojo(a);
      b = ensurePojo(b);
      var isDifferent = natural(a.favourite, b.favourite);

      // one of them isn't a favourite
      if (isDifferent) return isDifferent; // -1 or 1

      // both favourites, order by name
      return natural(a.name, b.name);
    },
    filter: function (room) {
      room = ensurePojo(room);
      return room.favourite;
    }
  },

  recents: {
    sort: function (a, b) {
      a = ensurePojo(a);
      b = ensurePojo(b);

      var aRank = getRank(a);
      var bRank = getRank(b);

      if (aRank === bRank) {
        return timeDifference(a, b, aRank);
      } else {
        return aRank - bRank;
      }
    },
    filter: function (room) {
      room = ensurePojo(room);
      /* Not a favourite, but has a lastAccessTime */
      return !room.favourite && room.lastAccessTime || room.getunreadItems || room.mentions;
    }
  }
};