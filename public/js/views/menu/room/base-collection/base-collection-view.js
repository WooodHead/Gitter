'use strict';

var Marionette  = require('backbone.marionette');
var fastdom     = require('fastdom');
var template    = require('./base-collection-view.hbs');
var context     = require('utils/context');
var toggleClass = require('utils/toggle-class');

module.exports = Marionette.CompositeView.extend({

  template:           template,
  className:          'collection',
  childViewContainer: '#collection-list',

  childViewOptions: function(model) {
    var index = this.collection.indexOf(model);
    return {
      model:     model,
      index:     index,
      menuState: this.roomMenuModel.get('state'),
      roomMenuModel: this.roomMenuModel,
    };
  },

  modelEvents: {
    'change:header': 'render',
  },

  collectionEvents: {
    'change:mentions change:unreadMessages change:lastAccessTime add remove': 'render',
    'add remove reset': 'onFilterComplete',
  },

  childEvents: {
    'item:clicked': 'onItemClicked',
    'hide:complete': 'onHideComplete'
  },

  constructor: function(attrs) {
    this.bus           = attrs.bus;
    this.collection    = attrs.collection;
    this.roomMenuModel = attrs.roomMenuModel;
    this.listenTo(context.troupe(), 'change:id', this.updateSelectedModel, this);
    this.listenTo(this.roomMenuModel, 'change:state:post change:selectedOrgName', this.render, this);
    Marionette.CompositeView.prototype.constructor.apply(this, arguments);
  },

  initialize: function() {
    if(this.model.get('active')){
      this.render();
    }
  },

  updateSelectedModel: function() {
    var selectedModel      = this.collection.findWhere({ selected: true });
    var newlySelectedModel = this.collection.findWhere({ id: context.troupe().get('id') });

    if (selectedModel) selectedModel.set('selected', false);
    if (newlySelectedModel) newlySelectedModel.set('selected', true);
  },

  onItemClicked: function(view) {
    var model = view.model;
    var name = (model.get('uri') || model.get('url') || model.get('name') || model.get('fromUser').username);
    var url  = (name[0] !== '/') ?  '/' + name : name;
    this._triggerNavigation(url, 'chat', name);
  },

  _triggerNavigation: function (url, type, name){
    this.bus.trigger('navigation', url, type, name);
  },

  onFilterComplete: function() {
    this.setActive();
  },

  onBeforeRender: function() {
    this.setLoaded(false);
  },

  onRender: function() {
    fastdom.mutate(function() {
      this.setActive();
      this.setLoaded();
    }.bind(this));
  },

  setActive: function (){
    toggleClass(this.el, 'active', this.model.get('active'));
  },

  setLoaded: function (val){
    val = (val || true);
    toggleClass(this.el, 'loaded', val);
  },

  onHideComplete: function (view){
    //If we are hiding the current room, navigate to /home JP 11/3/16
    if(view.model.get('id') === context.troupe().get('id')) {
      this._triggerNavigation('/home', 'home', 'Home');
    }
  },

  onDestroy: function() {
    this.stopListening(context.troupe());
  },

});
