/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'views/base',
  'marionette',
  'hbs!./tmpl/requestView',
  'hbs!./tmpl/requestItemView',
  'views/unread-item-view-mixin',
  'cocktail'
], function(TroupeViews, Marionette, requestViewTemplate, requestItemViewTemplate, UnreadItemViewMixin, cocktail) {
  "use strict";

  var RequestItemView = TroupeViews.Base.extend({
    tagName: 'span',
    unreadItemType: 'request',
    template: requestItemViewTemplate,

    initialize: function(/*options*/) {
      this.setRerenderOnChange();
    }
  });
  cocktail.mixin(RequestItemView, UnreadItemViewMixin);

  return TroupeViews.Base.extend({
    template: requestViewTemplate,

    initialize: function(/*options*/) {
      this.collectionView = new Marionette.CollectionView({
        collection: this.collection,
        itemView: RequestItemView
      });
    },

    afterRender: function() {
      this.$el.find('.frame-request').append(this.collectionView.render().el);
    }

  });

});