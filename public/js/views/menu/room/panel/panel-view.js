'use strict';

var _ = require('underscore');
var Marionette = require('backbone.marionette');
var fastdom = require('fastdom');
var toggleClass = require('../../../../utils/toggle-class');
var PanelHeaderView = require('../header/header-view');
var PanelFooterView = require('../footer/footer-view');
var FavouriteCollectionView = require('../favourite-collection/favourite-collection-view');
var PrimaryCollectionView = require('../primary-collection/primary-collection-view');
var SecondaryCollectionView = require('../secondary-collection/secondary-collection-view');
var TertiaryCollectionView = require('../tertiary-collection/tertiary-collection-view');
var ProfileMenuView = require('../../../profile-menu/profile-menu-view');
var SearchInputView = require('../../../menu/room/search-input/search-input-view');
var NeverEndingStory = require('../../../../utils/never-ending-story');
var GroupBackControl = require('../group-back-control/group-back-control-view');
var GroupHomeView = require('../group-home-control/group-home-control-view');

require('../../../behaviors/isomorphic');

var PanelView = Marionette.LayoutView.extend({

  behaviors: {
    Isomorphic: {
      header:              { el: '#panel-header', init: 'initHeader' },
      groupBackControl:    { el: '#group-back-button', init: 'initGroupBackArea' },
      searchInput:         { el: '#search-input', init: 'initSearchInput' },
      favouriteCollection: { el: '#favourite-collection', init: 'initFavouriteCollection' },
      primaryCollection:   { el: '#primary-collection', init: 'initPrimaryCollection' },
      groupHomeControl:    { el: '#group-home-button', init: 'initGroupHomeControl' },
      secondaryCollection: { el: '#secondary-collection', init: 'initSecondaryCollection' },
      teritaryCollection:  { el: '#tertiary-collection', init: 'initTertiaryCollection' },
      footer:              { el: '#panel-footer', init: 'initFooter' },
    },
  },


  initHeader: function(optionsForRegion) {
    return new PanelHeaderView(optionsForRegion({
      model: this.model,
      groupsCollection: this.model.groupsCollection,
    }));
  },

  initProfileMenu: function(optionsForRegion) {
    return new ProfileMenuView(optionsForRegion({ model: this.model }));
  },

  initGroupBackArea: function(optionsForRegion){
    return new GroupBackControl(optionsForRegion({ model: this.model }));
  },

  initSearchInput: function(optionsForRegion) {
    return new SearchInputView(optionsForRegion({
      model: this.model,
      bus: this.bus ,
      searchFocusModel: this.model.searchFocusModel,
    }));
  },

  initFavouriteCollection: function (optionsForRegion) {
    return new FavouriteCollectionView(optionsForRegion({
      collection:     this.model.favouriteCollection,
      model:          this.model.favouriteCollectionModel,
      roomMenuModel:  this.model,
      bus:            this.bus,
      dndCtrl:        this.dndCtrl,
      roomCollection: this.model._roomCollection,
      groupsCollection: this.model.groupsCollection,
    }));

  },

  initPrimaryCollection: function(optionsForRegion) {
    return new PrimaryCollectionView(optionsForRegion({
      collection:     this.model.primaryCollection,
      model:          this.model.primaryCollectionModel,
      roomMenuModel:  this.model,
      bus:            this.bus,
      dndCtrl:        this.dndCtrl,
      roomCollection: this.model._roomCollection,
      groupsCollection: this.model.groupsCollection,
    }));
  },

  initGroupHomeControl: function(optionsForRegion){
    return new GroupHomeView(optionsForRegion({
      groupsCollection: this.model.groupsCollection,
      model: this.model
    }));
  },

  initSecondaryCollection: function(optionsForRegion) {
    return new SecondaryCollectionView(optionsForRegion({
      collection:        this.model.secondaryCollection,
      model:             this.model.secondaryCollectionModel,
      roomMenuModel:     this.model,
      bus:               this.bus,
      roomCollection:    this.model._roomCollection,
      primaryCollection: this.model.primaryCollection,
      userModel:         this.model.userModel,
      troupeModel:       this.model._troupeModel,
      groupsCollection: this.model.groupsCollection,
    }));
  },

  initTertiaryCollection: function(optionsForRegion) {
    return new TertiaryCollectionView(optionsForRegion({
      model:               this.model.tertiaryCollectionModel,
      collection:          this.model.tertiaryCollection,
      roomMenuModel:       this.model,
      bus:                 this.bus,
      primaryCollection:   this.model.primaryCollection,
      secondaryCollection: this.model.secondaryCollection,
      roomCollection:      this.model._roomCollection,
      groupsCollection: this.model.groupsCollection,
    }));
  },

  initFooter: function(optionsForRegion) {
    return new PanelFooterView(optionsForRegion({
      model: this.model,
      bus:   this.bus,
    }));
  },

  ui: {
    profileMenu: '#profile-menu',
  },

  events: {
    mouseenter: 'onMouseenter'
  },

  modelEvents: {
    'change:panelOpenState':       'onPanelOpenStateChange',
    'primary-collection:snapshot': 'onPrimaryCollectionSnapshot',
  },

  childEvents: {
    render: 'onChildViewRender',
  },

  initialize: function(attrs) {
    this.bus = attrs.bus;
    this.dndCtrl = attrs.dndCtrl;
    this.keyboardControllerView = attrs.keyboardControllerView;
    this.queryModel = this.model.searchMessageQueryModel;
    this.listenTo(this.bus, 'ui:swipeleft', this.onSwipeLeft);
    this.listenTo(this.bus, 'focus.request.chat', this.onSearchItemSelected);
    this.listenTo(this.model, 'change:state', this.onModelChangeState);
    this.$el.find('#search-results').show();
  },

  onChildViewRender: _.debounce(function() {
    this._initNano({ iOSNativeScrolling: true, sliderMaxHeight: 200 });
  }, 50),

  _initNano: function(params) {
    fastdom.mutate(function() {
      this.$el.find('.nano').nanoScroller(params);
    }.bind(this));
  },

  onPanelOpenStateChange: function(model, val) { /*jshint unused: true */
    fastdom.mutate(function() {
      toggleClass(this.el, 'active', val);
    }.bind(this));
  },

  onMouseenter: function() {
    // If they are able to touch the main room-list panel, then we always stay open
    this.model.set('panelOpenState', true);
  },

  onSwipeLeft: function(e) {
    if (e.target === this.el) { this.model.set('panelOpenState', false); }
  },

  onSearchItemSelected: function() {
    if (!this.model.get('roomMenuIsPinned')) {
      this.model.set('panelOpenState', false);
    }
  },

  onPrimaryCollectionSnapshot: function() {
    this.el.classList.add('loading');
  },

  onChildRender: _.debounce(function (){
    this.bus.trigger('panel:render');
  }, 10),

  onProfileToggle: function(model, val) {
    this.ui.profileMenu[0].setAttribute('aria-hidden', !val);
  },

  onModelChangeState: function (){
    var state = this.model.get('state');
    toggleClass(this.el, 'all', state === 'all');
    toggleClass(this.el, 'search', state === 'search');
    toggleClass(this.el, 'people', state === 'people');
    toggleClass(this.el, 'group', state === 'group');
    toggleClass(this.el, 'org', state === 'org');

    this.$el.find('.nano').nanoScroller({ scrollTop: 0 });

    if(!this.neverendingstory) { return; }
    if(state !== 'search') { return this.neverendingstory.disable(); }
    return this.neverendingstory.enable();
  },

  scrollBottom: _.debounce(function (){
    this.queryModel.set('isFetchingMoreSearchMessageResults', true);
  }, 100),

  onRender: function() {
    if(!this.neverendingstory) {
      this.neverendingstory = new NeverEndingStory(this.$el.find('.nano-content')[0]);
      this.listenTo(this.neverendingstory, 'approaching.bottom', this.scrollBottom, this);
      this.neverendingstory.disable();
      this.onModelChangeState();
    }
  },

  onDestroy: function() {
    this.stopListening(this.bus);
  },

});


module.exports = PanelView;
