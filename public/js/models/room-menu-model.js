'use strict';

//TODO This has basically turned into a controller, refactor it JP 2/2/16

var Backbone = require('backbone');
var _ = require('underscore');
var ProxyCollection = require('backbone-proxy-collection');
var RecentSearchesCollection = require('../collections/recent-searches');
var SuggestedOrgCollection = require('../collections/org-suggested-rooms');
var apiClient = require('../components/apiClient');
var context = require('../utils/context');
var autoModelSave = require('../utils/auto-model-save');

var FilteredMinibarGroupCollection = require('../collections/filtered-minibar-group-collection');
var FilteredRoomCollection = require('../collections/filtered-room-collection');
var FilteredFavouriteRoomCollection = require('../collections/filtered-favourite-room-collection');
var SuggestedRoomsByRoomCollection = require('../collections/left-menu-suggested-by-room');
var SuggestedRoomsByGroupName = require('../collections/org-suggested-rooms-by-name');
var UserSuggestions = require('../collections/user-suggested-rooms');
var SearchRoomPeopleCollection = require('../collections/left-menu-search-rooms-and-people');
var SearchChatMessages = require('../collections/search-chat-messages');

var FavouriteCollectionModel = require('../views/menu/room/favourite-collection/favourite-collection-model');
var PrimaryCollectionModel = require('../views/menu/room/primary-collection/primary-collection-model');
var SecondaryCollectionModel = require('../views/menu/room/secondary-collection/secondary-collection-model');
var TertiaryCollectionModel = require('../views/menu/room/tertiary-collection/tertiary-collection-model');
var favouriteCollectionFilter = require('gitter-web-shared/filters/left-menu-primary-favourite');
var MinibarItemModel = require('../views/menu/room/minibar/minibar-item-model');
var MinibarPeopleModel = require('../views/menu/room/minibar/people-view/people-model');
var MinibarTempOrgModel = require('../views/menu/room/minibar/temp-org-view/temp-org-model');

var states = [
  'all',
  'search',
  'people',
  'org',
  'temp-org'
];

var SEARCH_DEBOUNCE_INTERVAL = 1000;

module.exports = Backbone.Model.extend({

  defaults: {
    state: '',
    searchTerm: '',
    roomMenuIsPinned: true,
    groupId: '',
    hasDismissedSuggestions: false,
  },

  constructor: function (attrs, options){
    //It is the case that some users will have `selectedOrgName` saved in the DB
    //Now we use groupId this will result in a totally broken app
    //In this case we want to redirect the user to the all state to prevent broken stuff
    if(attrs.state === 'org' && !attrs.groupId) { attrs.state = 'all'; }
    Backbone.Model.prototype.constructor.call(this, attrs, options);
  },

  initialize: function(attrs) {
    this.set('panelOpenState', this.get('roomMenuIsPinned'));

    if (!attrs || !attrs.bus) {
      throw new Error('A valid message bus must be passed when creating a new RoomMenuModel');
    }

    if (!attrs || !attrs.roomCollection) {
      throw new Error('A valid room collection must be passed to a new RoomMenuModel');
    }

    if (!attrs || !attrs.userModel) {
      throw new Error('A valid user model must be passed to a new RoomMenuModel');
    }

    this.searchInterval = SEARCH_DEBOUNCE_INTERVAL;

    //assign internal collections
    this._roomCollection = attrs.roomCollection;
    delete attrs.roomCollection;

    this._troupeModel = attrs.troupeModel;
    delete attrs.troupeModel;

    this.dndCtrl = attrs.dndCtrl;
    delete attrs.dndCtrl;

    this._orgCollection = attrs.orgCollection;

    this._detailCollection = (attrs.detailCollection || new Backbone.Collection());
    delete attrs.detailCollection;

    this.userModel = attrs.userModel;
    delete attrs.userModel;

    this.groupsCollection = attrs.groupsCollection;
    delete attrs.groupsCollection;

    //expose the public collection
    this.searchTerms = new RecentSearchesCollection(null);
    this.searchTerms.getUnderlying().fetch();

    this.searchRoomAndPeople = new SearchRoomPeopleCollection(null, {
      roomMenuModel: this,
      roomCollection: this._roomCollection
    });

    this.searchMessageQueryModel = new Backbone.Model({ skip: 0 });
    this.searchChatMessages = new SearchChatMessages(null, { roomMenuModel: this, roomModel: this._troupeModel, queryModel: this.searchMessageQueryModel });
    this.suggestedOrgs = new SuggestedOrgCollection({
      contextModel: this,
      roomCollection: this._roomCollection
    });
    this.userSuggestions = new UserSuggestions(null, { contextModel: context.user() });
    this._suggestedRoomCollection = new SuggestedRoomsByRoomCollection({
      roomMenuModel:           this,
      troupeModel:             this._troupeModel,
      roomCollection:          this._roomCollection,
      suggestedOrgsCollection: this.suggestedOrgs,
    });

    this.suggestedRoomsByOrgName = new SuggestedRoomsByGroupName(null, { roomMenuModel: this });

    var state = this.get('state');
    this.minibarHomeModel = new MinibarItemModel({ name: 'all', type: 'all', active: (state === 'all') });
    this.minibarSearchModel = new MinibarItemModel({ name: 'search', type: 'search', active: (state === 'search') });
    this.minibarPeopleModel = new MinibarPeopleModel({ active: (state === 'people')}, { roomCollection: this._roomCollection });
    this.minibarCommunityCreateModel = new MinibarItemModel({ name: 'Create Community', type: 'community-create' });
    this.minibarCloseModel = new MinibarItemModel({ name: 'close', type: 'close' });
    this.minibarTempOrgModel = new MinibarTempOrgModel(attrs.tempOrg, { troupe: context.troupe(), });

    //Setup an inital active group model
    this.groupsCollection.forEach(function(model){
      if(state === 'org' && model.id === this.get('groupId')) {
        model.set('active', true);
      }
    }.bind(this));

    this.minibarCollection = new FilteredMinibarGroupCollection(null, {
      collection: this.groupsCollection
    });


    this.activeRoomCollection = new FilteredRoomCollection(null, {
      autoResort: true,
      roomModel:  this,
      collection: this._roomCollection,
    });

    var favModels = this._roomCollection.filter(favouriteCollectionFilter);
    this.favouriteCollection = new FilteredFavouriteRoomCollection(favModels, {
      collection: this._roomCollection,
      roomModel:  this,
      dndCtrl:    this.dndCtrl,
    });

    this.favouriteCollectionModel = new FavouriteCollectionModel(null, {
      collection: this.favouriteCollection,
      roomMenuModel: this
    });

    this.primaryCollection = new ProxyCollection({ collection: this.activeRoomCollection });
    this.primaryCollectionModel = new PrimaryCollectionModel(null, {
      collection: this.primaryCollection,
      roomMenuModel: this
    });

    this.secondaryCollection = new ProxyCollection({ collection: this.searchTerms });
    this.secondaryCollectionModel = new SecondaryCollectionModel({}, {
      collection: this.secondaryCollection,
      roomMenuModel: this
    });

    this.tertiaryCollection = new ProxyCollection({ collection: this._orgCollection });
    this.tertiaryCollectionModel = new TertiaryCollectionModel({}, {
      collection: this.tertiaryCollection,
      roomMenuModel: this
    });

    this.searchFocusModel = new Backbone.Model({ focus: false });

    this.listenTo(this.primaryCollection, 'snapshot', this.onPrimaryCollectionSnapshot, this);
    this.snapshotTimeout = setTimeout(function(){
      this.onPrimaryCollectionSnapshot();
    }.bind(this), 1000);

    //TODO have added setState so this can be removed
    //tests must be migrated
    this.bus = attrs.bus;
    delete attrs.bus;

    this.listenTo(this, 'change:searchTerm', this.onSearchTermChange, this);
    this.listenTo(this, 'change:state', this.onSwitchState, this);
    this.listenTo(context.troupe(), 'change:id', this.onRoomChange, this);
    this.listenTo(this.bus, 'left-menu-menu-bar:activate', this.onMenuBarActivateRequest, this);
    this.onSwitchState(this, this.get('state'));

    autoModelSave(this, ['state', 'roomMenuIsPinned', 'groupId', 'hasDismissedSuggestions'], this.autoPersist);
  },

  //custom set to limit states that can be assigned
  set: function (key, val){
    var isChangingState = (key === 'state') || (_.isObject(key) && !!key.state);
    if(!isChangingState) { return Backbone.Model.prototype.set.apply(this, arguments); }
    var newState = _.isObject(key) ? key.state : val;
    //If we are changing the models state value
    if(states.indexOf(newState) === -1) { return; }
    return Backbone.Model.prototype.set.apply(this, arguments);
  },

  onSwitchState: function(model, val) {
    var searchFocus = false;
    switch (val) {
      case 'all':
        this.primaryCollection.switchCollection(this.activeRoomCollection);
        this.secondaryCollection.switchCollection(this.userSuggestions);
        this.tertiaryCollection.switchCollection(this._orgCollection);
        break;

      case 'search':
        this.primaryCollection.switchCollection(this.searchRoomAndPeople);
        this.secondaryCollection.switchCollection(this.searchChatMessages);
        this.tertiaryCollection.switchCollection(this.searchTerms);
        searchFocus = true;
        break;

      case 'org':
        this.primaryCollection.switchCollection(this.activeRoomCollection);
        this.secondaryCollection.switchCollection(this.suggestedOrgs);
        this.tertiaryCollection.switchCollection(this._suggestedRoomCollection);
        break;

      case 'temp-org':
        this.set('groupId', null);
        this.primaryCollection.switchCollection(this.activeRoomCollection);
        this.secondaryCollection.switchCollection(this.suggestedRoomsByOrgName);
        this.tertiaryCollection.switchCollection(this._suggestedRoomCollection);
        break;


      default:
        this.primaryCollection.switchCollection(this.activeRoomCollection);
        this.secondaryCollection.switchCollection(new Backbone.Collection(null));
        this.tertiaryCollection.switchCollection(new Backbone.Collection(null));
        break;
    }

    this.trigger('change:state:post');
    this.searchFocusModel.set('focus', searchFocus);
  },

  onSearchTermChange: _.debounce(function() {
    this.searchTerms.getUnderlying().add({ name: this.get('searchTerm') });
  }, SEARCH_DEBOUNCE_INTERVAL),

  onPrimaryCollectionSnapshot: function() {
    clearTimeout(this.snapshotTimeout);
    this.trigger('primary-collection:snapshot');
  },

  toJSON: function() {
    var attrs = this.attributes;

    //only ever store the defaults everything else is determined at run-time
    return Object.keys(this.defaults).reduce(function(memo, key) {
      if (key === 'searchTerm') return memo;
      memo[key] = attrs[key];
      return memo;
    }, {});
  },

  /**
   * Used by autoModelSave
   */
  autoPersist: function() {
    return apiClient.user.put('/settings/leftRoomMenu', this.toJSON(), {
      // No need to get the JSON back from the server...
      dataType: 'text'
    });
  },

  onRoomChange: function (){
    var activeModel = this._getModel('active', true);
    var newlyActiveModel = this._getModel('id', context.troupe().get('id'));

    if(activeModel) { activeModel.set('active', false); }
    if(newlyActiveModel) { newlyActiveModel.set('active', true); }
    if(!this.get('roomMenuIsPinned')) { this.set('panelOpenState', false); }
  },

  onMenuBarActivateRequest: function(data) {
    data = data || {};
    this.set({
      panelOpenState: true,
      profileMenuOpenState: false,
      state: data.state,
      groupId: data.groupId,
    });
  },

  getCurrentGroup: function (){
    if(this.get('state') !== 'org') { return false; }
    return this.groupsCollection.get(this.get('groupId'));
  },

  _getModel: function (prop, val){
    var query = {}; query[prop] = val;
    return this.primaryCollection.findWhere(query) ||
      this.secondaryCollection.findWhere(query) ||
        this.tertiaryCollection.findWhere(query) ||
          this._roomCollection.findWhere(query);
  },

});
