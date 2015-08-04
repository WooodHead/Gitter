/* jshint node:true  */
"use strict";

var Backbone = require('backbone');
var Marionette = require('backbone.marionette');

var ModalView = require('views/modal');
var TagInputView = require('./tags/tagInputView');
var TagListView = require('./tags/tagListView');
var TagErrorView = require('./tags/tagErrorView');

var TagCollection = require('../../collections/tag-collection').TagCollection;

var apiClient = require('components/apiClient');

var editTagsTemplate = require('./tmpl/editTagsTemplate.hbs');

require('views/behaviors/isomorphic');

var View = Marionette.LayoutView.extend({
  template: editTagsTemplate,

  behaviors: {
    Isomorphic: {
      tagList:  { el: '#tag-list',  init: 'initTagList' },
      tagInput: { el: '#tag-input', init: 'initTagListEdit' },
      tagError: { el: '#tag-error', init: 'initTagError'}
    }
  },

  initialize: function() {

    var tagCollection = new TagCollection();
    var errorModel = new Backbone.Model({
      message: 'Press backspace or delete to remove the last tag',
      class: 'message'
    });

    this.model = new Backbone.Model({
      tagCollection: tagCollection,
      errorModel: errorModel
    });

    //get existing tags
    ////TODO need to add error states to the below request
    apiClient.get('/v1/rooms/' + this.options.roomId)
    .then(function(data){
      this.model.set(data);
      this.model.get('tagCollection').add(data.tags);
    }.bind(this));

    //events
    this.listenTo(this, 'menuItemClicked', this.menuItemClicked);
    this.listenTo(tagCollection, 'tag:error:duplicate', this.onDuplicateTag);
    this.listenTo(tagCollection, 'tag:added', this.onTagEmpty);
  },

  save: function(e) {
    if(e) e.preventDefault();
    //TODO --> need to add error states here jp 3/9/15
    apiClient.put('/v1/rooms/' + this.options.roomId, { tags: this.model.get('tagCollection').toJSON() })
    .then(function() {
      this.dialog.hide();
    }.bind(this));

  },

  menuItemClicked: function (button) {
    switch (button) {
      case 'save':
        this.save();
        break;
    }
  },

  onDuplicateTag: function(tag){
    this.model.get('errorModel').set({
     message: tag + ' has already been entered',
     class: 'message'
    });
  },

  childEvents: {
    'tag:valid': 'onTagValid',
    'tag:error': 'onTagError',
    'tag:warning:empty': 'onTagEmpty',
    'tag:removed': 'onTagRemoved'
  },

  onTagEmpty: function(){
    this.model.get('errorModel').set({
     message: 'Press backspace or delete to remove the last tag',
     class: 'message'
    });
  },

  onTagValid: function(model, value){
    this.model.get('errorModel').set({
      message: 'Press enter to add ' + value,
      class: 'message'
    });
  },

  onTagError: function(){
    this.model.get('errorModel').set({
      message: 'Tags must be between 1 and 20 characters in length',
      class: 'error'
    });
  },

  onTagRemoved: function(){
    this.tagInput.currentView.focus();
  },

  initTagList: function(optionsForRegion){
    return new TagListView(optionsForRegion({ collection: this.model.get('tagCollection') }));
  },

  initTagListEdit: function(optionsForRegion){
    return new TagInputView(optionsForRegion({ collection: this.model.get('tagCollection') }));
  },

  initTagError: function(optionsForRegion){
    return new TagErrorView(optionsForRegion({ model: this.model.get('errorModel') }));
  }

});

var Modal = ModalView.extend({
  initialize: function(options) {
    options.title = "Edit tags";
    ModalView.prototype.initialize.apply(this, arguments);
    this.view = new View({roomId: options.roomId });
  },
  menuItems: [
    { action: "save", text: "Save", className: "trpBtnGreen"}
  ]
});

module.exports = Modal;
