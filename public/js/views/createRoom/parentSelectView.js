/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'underscore',
  'marionette',
  'utils/context',
  'hbs!./tmpl/parentSelectView',
  'hbs!./tmpl/parentItemView',
  'views/controls/dropdown',
  'views/controls/typeahead',
  'backbone'
], function(_, Marionette, context, template, itemTemplate, Dropdown, Typeahead, Backbone) {
  "use strict";

  var ItemModel = Backbone.Model.extend({
    idAttribute: "uri",
  });

  function modelFromRepoTroupe(m) {
    return new ItemModel({
      id: m.get('id'),
      uri: m.get('uri'),
      name: m.get('name'),
      type: 'repo',
      repoType: true
    });
  }

  function modelFromUser() {
    var user = context.user();

    return new ItemModel({
      uri: user.get('username'),
      name: user.get('username'),
      avatarUrl: user.get('avatarUrlSmall'),
      type: 'user',
      userType: true
    });
  }


  function modelFromOrg(a) {
    return new ItemModel({
      id: a.get('room').id,
      uri: a.get('room').uri,
      name: a.get('name'),
      avatarUrl: a.get('avatar_url'),
      type: 'org',
      orgType: true
    });
  }

  return Marionette.ItemView.extend({
    events: {
      'focus @ui.input':    'show',
      'click @ui.input':    'show'
    },
    ui: {
      input: "input#input-parent",
      avatar: "#avatar"
    },

    template: template,
    initialize: function(options) {
      this.orgsCollection = options.orgsCollection;
      this.troupesCollection = options.troupesCollection;

      this.dropdownItems = new Backbone.Collection({ });
      this.dropdownItems.comparator = function(a, b) {
        function compare(a, b) {
          if(a === b) return 0;
          return a < b ? -1 : +1;
        }

        if(a.get('type') === 'org') {
          if(b.get('type') === 'org') {
            return compare(a.get('name').toLowerCase(), b.get('name').toLowerCase());
          } else {
            return -1;
          }
        } else {
          if(b.get('type') === 'org') {
            return 1;
          }
        }

        return compare(a.get('name').toLowerCase(), b.get('name').toLowerCase());
      };

      this.listenTo(this.orgsCollection, 'add remove change reset sync', this.reset);
      this.listenTo(this.troupesCollection, 'add remove change reset sync', this.reset);
    },

    selected: function(m) {
      this.ui.input.val(m.get('uri'));

      if(this.typeahead) {
        this.typeahead.hide();
      }

      if  (m.get('type') === 'repo') {
        this.ui.avatar.css("background-image", "url(../../images/2/gitter/icon-repo.png)");
      } else {
        this.ui.avatar.css("background-image", "url(" + m.get('avatarUrl') + ")");
      }

      this.trigger('selected', m);
    },

    onRender: function() {
      if(!this.typeahead) {
        this.typeahead = new Typeahead({
          fetch: this.refilter.bind(this),
          collection: this.dropdownItems,
          itemTemplate: itemTemplate,
          el: this.ui.input[0],
          autoSelect: true
        });
        this.listenTo(this.typeahead, 'selected', this.selected);
      }
    },

    onClose: function() {
      this.typeahead.close();
    },

    show: function() {
      this.typeahead.show();
    },

    hide: function() {
      this.dropdown.hide();
    },

    selectUri: function(uri) {
      var collection, predicate, mapper;

      function repoPredicate(troupe) {
        return troupe.get('githubType') === 'REPO' && troupe.get('uri') === uri;
      }

      function orgPredicate(o) {
        return o.get('room') && o.get('room').uri === uri;
      }

      if(uri.indexOf('/') >= 0) {
        collection = this.troupesCollection;
        predicate = repoPredicate;
        mapper = modelFromRepoTroupe;
      } else {
        if(uri === context.user().get('username')) {
          var userModel = modelFromUser();
          this.selected(userModel);
          return userModel;
        }

        collection = this.orgsCollection;
        predicate = orgPredicate;
        mapper = modelFromOrg;
      }

      var item = collection.find(predicate);

      if(item) {
        var model = mapper(item);
        this.selected(model);
        return model;
      }

    },

    refilter: function(query, collection) {
      var self = this;
      var results;

      if(!query) {
        results = defaultResults();
      } else {
        query = query.toLowerCase();

        if(query.indexOf('/') >= 0) {
          results = this.troupesCollection.filter(function(troupe) {
              return troupe.get('githubType') === 'REPO' && troupe.get('uri').toLowerCase().indexOf(query) === 0;
            }).map(modelFromRepoTroupe);
        } else {
          results = defaultResults();
        }
      }

      collection.set(results, { add: true, remove: true, merge: true });

      function defaultResults() {

        return self.orgsCollection.filter(function(m) {
          return !!m.get('room');
        }).map(modelFromOrg).concat(modelFromUser());
      }
    }

  });

});
