'use strict';

var Backbone         = require('backbone');
var itemTemplate     = require('./primary-collection-view.hbs');
var apiClient        = require('components/apiClient');
var context          = require('utils/context');
var appEvents        = require('utils/appevents');
var parseForTemplate = require('gitter-web-shared/parse/left-menu-primary-item');

var BaseCollectionItemView = require('../base-collection/base-collection-item-view');

module.exports = BaseCollectionItemView.extend({

  template: itemTemplate,
  events: {
    'click #room-item-options-toggle': 'onOptionsClicked',
    'click #room-item-hide':           'onHideClicked',
    'click #room-item-leave':          'onLeaveClicked',
    'mouseleave':                      'onMouseOut',
  },

  className: null,
  attributes: function() {
    var id = this.model.get('id');
    return {
      class:     (this.model.get('githubType') === 'ONETOONE') ? 'room-item--one2one' : 'room-item',
      'data-id': id,
      id: id,
    };
  },

  initialize: function() {
    this.uiModel = new Backbone.Model({ menuIsOpen: false });
    this.listenTo(this.uiModel, 'change:menuIsOpen', this.onModelToggleMenu, this);
  },

  serializeData: function() {
    return parseForTemplate(this.model.toJSON(), this.roomMenuModel.get('state'));
  },

  onOptionsClicked: function(e) {
    e.stopPropagation();
    if (this.roomMenuModel.get('state') === 'search') { return; }

    this.uiModel.set('menuIsOpen', !this.uiModel.get('menuIsOpen'));
  },

  onModelToggleMenu: function(model, val) {// jshint unused: true
    this.el.classList.toggle('active', val);
  },

  onMouseOut: function() {
    this.uiModel.set('menuIsOpen', false);
  },

  onHideClicked: function(e) {
    e.stopPropagation();
    //TODO figure out why this throws an error.
    //implementation is exactly the same as on develop?
    //JP 13/1/16
    apiClient.user.delete('/rooms/' + this.model.id);
  },

  onLeaveClicked: function(e) {
    e.stopPropagation();
    if (this.model.get('id') === context.getTroupeId()) {
      appEvents.trigger('about.to.leave.current.room');
    }

    apiClient.delete('/v1/rooms/' + this.model.get('id') + '/users/' + context.getUserId())
      .then(function() {
        appEvents.trigger('navigation', '/home', 'home', '');
      });
  },

  render: function() {
    //TODO Figure out why there is soooo much rendering JP 5/2/16
    if (!Object.keys(this.model.changed)) { return; }

    BaseCollectionItemView.prototype.render.apply(this, arguments);
  },

  onDestroy: function() {
    this.stopListening(this.uiModel);
  },
});
