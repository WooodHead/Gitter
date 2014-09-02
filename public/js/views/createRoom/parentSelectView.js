define([
  'marionette',
  'utils/context',
  'hbs!./tmpl/parentSelectView',
  'hbs!./tmpl/parentItemView',
  'views/controls/typeahead',
  'backbone'
], function(Marionette, context, template, itemTemplate, Typeahead, Backbone) {
  "use strict";

  var ItemModel = Backbone.Model.extend({
    idAttribute: "uri",
    constructor: function(underlyingModel, mappingFunction) {
      // XXX: TODO: deal with minor memory leak here
      this.mappingFunction = mappingFunction;
      var attributes = mappingFunction(underlyingModel);
      Backbone.Model.call(this, attributes);
      this.listenTo(underlyingModel, 'change', this.underlyingChanged);
    },
    underlyingChanged: function(model) {
      var attributes = this.mappingFunction(model);
      this.set(attributes);
    }
  });

  function comparator(a, b) {
    function compare(a, b) {
      if(a === b) return 0;
      return a < b ? -1 : +1;
    }

    if(a.get('type') === 'repo') {
      if(b.get('type') === 'repo') {
        return compare(a.get('name').toLowerCase(), b.get('name').toLowerCase());
      } else {
        return -1;
      }
    } else {
      if(b.get('type') === 'repo') {
        return 1;
      }
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
  }

  function modelFromRepoTroupe(m) {
    return new ItemModel(m, function(m) {
      return {
        id: m.get('id'),
        uri: m.get('uri'),
        name: m.get('name'),
        premium: m.get('premium'),
        type: 'repo',
        repoType: true
      };
    });
  }

  function modelFromUser(m) {
    return new ItemModel(m, function(m) {
      return {
        uri: m.get('username'),
        name: m.get('username'),
        avatarUrl: m.get('avatarUrlSmall'),
        premium: m.get('premium'),
        type: 'user',
        userType: true
      };
    });
  }


  function modelFromOrg(m) {
    return new ItemModel(m, function(m) {
      return {
        id: m.get('room').id,
        uri: m.get('room').uri,
        premium: m.get('premium'),
        name: m.get('name'),
        avatarUrl: m.get('avatar_url'),
        type: 'org',
        orgType: true
      };
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
      // this.dropdownItems.comparator =

      this.listenTo(this.orgsCollection, 'add remove change reset sync', this.reset);
      this.listenTo(this.troupesCollection, 'add remove change reset sync', this.reset);
    },

    selected: function(m) {
      this.ui.input.val(m.get('uri'));

      if(this.typeahead) {
        this.typeahead.hide();
      }

      if  (m.get('type') === 'repo') {
        this.ui.avatar.css("background-image", "url(../../images/icon-repo.png)");
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
          autoSelector: function(input) {
            return function(m) {
              return m.get('name') && m.get('name').indexOf(input) >= 0;
            };
          }
        });
        this.listenTo(this.typeahead, 'selected', this.selected);
      }
    },

    onClose: function() {
      this.typeahead.close();
    },

    focus: function() {
      this.ui.input.focus();
    },

    show: function() {
      this.typeahead.show();
    },

    hide: function() {
      this.typeahead.hide();
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
          var userModel = modelFromUser(context.user());
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

    refilter: function(query, collection, success) {
      var self = this;
      var results;

      if(!query) {
        results = defaultResults();
      } else {
        query = query.toLowerCase();

        if(query.indexOf('/') >= 0) {
          results = this.troupesCollection.filter(function(troupe) {
              return troupe.get('githubType') === 'REPO' && troupe.get('uri').toLowerCase().indexOf(query) === 0;
            })
            .map(modelFromRepoTroupe)
            .concat(defaultResults());
        } else {
          results = defaultResults();
        }
      }

      results.sort(comparator);

      for(var type, i = results.length - 1; i >= 0; i--) {
        if(!type) {
          type = results[i].get('type');
        } else {
          if(type !== results[i].get('type')) {
            type = results[i].get('type');
            results.splice(i + 1, 0, new Backbone.Model({ divider: true }));
          }
        }
      }

      collection.set(results, { add: true, remove: true, merge: true });
      if(success) success();

      function defaultResults() {

        return self.orgsCollection.filter(function(m) {
          return !!m.get('room');
        }).map(modelFromOrg).concat(modelFromUser(context.user()));
      }
    }

  });

});
