define([
  'jquery',
  'underscore',
  'backbone',
  './base'
], function($, _, Backbone, TroupeCollections) {
  "use strict";

  var exports = {};

  exports.FileVersionModel = Backbone.Model.extend({});
  exports.FileVersionCollection  = Backbone.Collection.extend({
    model: exports.FileVersionModel
  });

  exports.FileModel = TroupeCollections.Model.extend({
      idAttribute: "id",

      defaults: {
      },

      initialize: function() {
        var versions = this.get('versions');
        if(_.isArray(versions)) {
          this.set('versions', new exports.FileVersionCollection());
        }
      }

      /*
      parse: function(response) {
        response.versions;
        return response;
      }
      */

    });

  exports.FileCollection = TroupeCollections.LiveCollection.extend({
    model: exports.FileModel,
    modelName: 'file',
    nestedUrl: "files"
  });

  return exports;
});
