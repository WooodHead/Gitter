'use strict';

var _          = require('underscore');
var Backbone   = require('backbone');
var Marionette = require('backbone.marionette');
var RAF        = require('utils/raf');

var MENU_REACTION_DEBOUNCE = 200;

module.exports = Marionette.ItemView.extend({

  events: {
    'click': 'onItemClicked',
  },

  modelEvents: {
    'change:active': 'onActiveStateChange',
  },

  initialize: function(attrs) {

    this.debounceTime = MENU_REACTION_DEBOUNCE;

    this.model = (this.model || new Backbone.Model());
    this.model.set({
      type:          this.$el.data('stateChange'),
      orgName:       this.$el.data('org-name'),
      isCloseButton: !!this.$el.find('#menu-close-button').length,
    });

    //Events
    if (!attrs || !attrs.bus) {
      throw new Error('A valid event bus must be passed to a new instance of MiniBarItemView');
    }

    this.bus = attrs.bus;
    this.listenTo(this.bus, 'ui:swiperight', this.onSwipeRight, this);

    //Drag & Drop Controller
    if (!attrs || !attrs.dndCtrl) {
      throw new Error('A valid drag & drop controller must be passed to a new instance of MiniBarItemView');
    }

    this.dndCtrl   = attrs.dndCtrl;

    //Menu Model
    if (!attrs || !attrs.menuModel) {
      throw new Error('A valid roomMenuModel must be passed to a new instance of MiniBarItemView');
    }

    this.menuModel = attrs.menuModel;
    if (this.model.get('isCloseButton')) {
      this.listenTo(this.menuModel, 'change:roomMenuIsPinned change:panelOpenState', this.onPanelOpen, this);
    }

    //TODO This component should be extended here instead of the check JP 12/1/16
    if (this.model.get('type') === 'favourite') {
      this.dndCtrl.pushContainer(this.el);
      this.listenTo(this.dndCtrl, 'dnd:start-drag', this.onDragStart, this);
      this.listenTo(this.dndCtrl, 'dnd:end-drag', this.onDragStop, this);
      this.listenTo(this.dndCtrl, 'room-menu:add-favourite', this.onFavourite, this);
    }
  },

  //TODO TEST THIS
  onPanelOpen: _.debounce(function(model) {
    var pinState  = model.get('roomMenuIsPinned');
    var openState = model.get('panelOpenState');

    //if the menu is open && pinned
    if (!!openState && !!pinState) {
      this.$el.addClass('left');
      this.$el.removeClass('right');
    }

    if (!!openState && !pinState) {
      this.$el.addClass('right');
      this.$el.removeClass('left');
    }

    if (!openState) {
      this.$el.removeClass('left');
      this.$el.removeClass('right');
    }
  }, 200),

  onDragStart: function() {
    this.$el.addClass('drag-start');
  },

  onDragStop: function() {
    this.$el.removeClass('drag-start');
  },

  //Test this
  onFavourite: function() {
    this.$el.addClass('dropped');
    setTimeout(function() {
      this.$el.removeClass('dropped');

      //Dragula places dropped items into the drop container
      //This needs to be fixed upstream
      //util that date just remove the dropped container manually
      //https://github.com/bevacqua/dragula/issues/188
      this.$el.find('.room-item').remove();
    }.bind(this), 200);
  },

  onSwipeRight: function(e) {
    if (e.target === this.el) {
      this._triggerRoomChange();
    }
  },

  onItemClicked: function(e) {
    e.preventDefault();
    this._triggerRoomChange();
  },

  _triggerRoomChange: function() {
    this.trigger('room-item-view:clicked',
                 this.model.get('type'),
                 this.model.get('orgName'),
                 this.model.get('isCloseButton')
                );
  },

  onActiveStateChange: function(model, val) {/*jshint unused:true */
    if (this.model.get('isCloseButton')) return;
    RAF(function() {
      this.$el.toggleClass('active', val);
    }.bind(this));
  },


  onDestroy: function (){
    this.stopListening(this.dndCtrl);
    this.stopListening(this.menuModel);
    this.stopListening(this.bus);
  },
});
