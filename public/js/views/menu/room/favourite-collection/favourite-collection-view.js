'use strict';

var Backbone              = require('backbone');
var Marionette            = require('backbone.marionette');
var PrimaryCollectionView = require('../primary-collection/primary-collection-view');
var BaseCollectionView    = require('../base-collection/base-collection-view');
var ItemView              = require('./favourite-collection-item-view');
var toggleClass           = require('utils/toggle-class');

var FavouriteCollection = PrimaryCollectionView.extend({

  childView: ItemView,

  events: {
    'mouseenter': 'onMouseEnter',
    'mouseout':   'onMouseLeave'
  },

  initialize: function() {
    PrimaryCollectionView.prototype.initialize.apply(this, arguments);
    this.uiModel = new Backbone.Model({ isDragging: false });
    this.listenTo(this.dndCtrl, 'room-menu:sort-favourite', this.onFavouritesSorted, this);
    this.listenTo(this.dndCtrl, 'room-menu:add-favourite', this.onFavouriteAdded, this);
  },

  getChildContainerToBeIndexed: function () {
    //For the favourite collection we use the first child because there
    //is no search header unlike the primary collection
    return this.el.children[0];
  },

  getEmptyView: function() {
    switch (this.roomMenuModel.get('state')) {
      default:
        return Marionette.ItemView.extend({ template: '<div></div>' });
    }
  },


  onFavouritesSorted: function(targetID, siblingID) {

    var target  = this.roomCollection.get(targetID);
    var sibling = this.roomCollection.get(siblingID);
    var index   = !!sibling ? sibling.get('favourite') : (this.getHighestFavourite() + 1);
    var max     = this.roomCollection.max('favourite');

    //If we have a sibling and that sibling has the highest favourite value
    //then we have dropped the item in the second to last position
    //so we need to account for that
    if (!!sibling && !!max && (sibling.get('id') === max.get('id'))) {
      index = max.get('favourite');
    }

    //Save the new favourite
    target.set('favourite', index);
    target.save();
    this.collection.sort();
  },

  //TODO TEST THIS YOU FOOL JP 10/2/16
  getHighestFavourite: function() {
    return (this.roomCollection.pluck('favourite')
      .filter(function(num) { return !!num; })
      .sort(function(a, b) { return a < b ? -1 : 1; })
      .slice(-1)[0] || 0);
  },

  //TODO The filter should be reused within the view filter method?
  onFavouriteAdded: function(id) {
    var newFavModel = this.roomCollection.get(id);
    var max         = this.roomCollection.max('favourite');
    var favIndex    = !!max.get ? (max.get('favourite') + 1) : true;
    newFavModel.save({ favourite: favIndex }, { patch: true });
  },

});

module.exports =  FavouriteCollection;
