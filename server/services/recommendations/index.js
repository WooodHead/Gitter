'use strict';

var Q = require('bluebird-q');
var _ = require('underscore');
var highlightedRoomCache = require('./highlighted-room-cache');
var collections = require('../../utils/collections');
var debug = require('debug')('gitter:legacy-recommendations');

var recommenders = [
  require('./highlighted-rooms'),
  require('./owned-repos'),
  require('./starred-repos'),
  require('./watched-repos'),
  require('./sibling-rooms')
];

module.exports = function (user, currentRoomUri) {
  return Q.all(recommenders.map(function(recommender) {
    return recommender(user, currentRoomUri);
  })).then(function(recommendationResults) {

    /* Merge the recommendations into a single list */
    var unique = {};

    recommendationResults.forEach(function(recommendations) {
      if (recommendations) {
        recommendations.forEach(function(recommendation) {
          var existing = unique[recommendation.uri] || {};
          unique[recommendation.uri] = _.extend(existing, recommendation);
        });
      }
    });
    return _.values(unique);
  })
  .then(function(recommendations) {
    debug('Seeded recommendations with %s unique items', recommendations.length);

    // Lookup repos
    var requiresLookup = recommendations
      .filter(function(recommendation) {
        return (recommendation.githubType === 'REPO' && !recommendation.githubRepo);
      });

    if (!requiresLookup.length) {
      return recommendations;
    }

    debug('Fetching %s suggested rooms from github or cache', requiresLookup.length);

    return Q.all(requiresLookup.map(function(recommendation) {
        return highlightedRoomCache(null, recommendation.uri)
          .catch(function() {
            debug('Failed to fetch %s', recommendation.uri);
          });
      }))
      .then(function(lookups) {
        var lookupsHashed = collections.indexByProperty(lookups, 'full_name');

        requiresLookup.forEach(function(recommendation) {
          recommendation.githubRepo = lookupsHashed[recommendation.uri];
        });

        return recommendations;
      });

  });
};
