/*jshint strict:true, undef:true, unused:strict, browser:true *//* global require:false */
require([
  'jquery',
  'utils/context',
  'backbone',
  'log!router-login',
  './base-router',
  'views/base',
  'views/invite/inviteModal',
  'views/login/loginModalView',
  'views/profile/profileView',
  'views/login/loginRequestModalView',
  'views/signup/signupModalConfirmView',
  'views/connect/connectUserView',
  'collections/troupes'
], function($, context, Backbone, log, BaseRouter, TroupeViews, InviteModal, LoginModalView, profileView, RequestModalView, SignupModalConfirmView, ConnectUserModalView, troupeModels) {
  "use strict";

  var AppRouter = BaseRouter.extend({
    routes: {
      '*actions': 'defaultAction'
    },

    defaultAction: function(/*actions*/) {
      $('#primary-view').html('');

      var view, modal, loginModal, requestModal, inviteId;

      function getLoginModal(options) {
        var email = options.email;
        var userExists = options.userExists;

        var loginView = new LoginModalView( { email: email, userExists: userExists });
        loginModal = new TroupeViews.Modal({ view: loginView, disableClose: true });
        loginView.once('login.complete', function() {
          window.location.reload();
        });
        loginModal.view.on('request.access', function() {
          getRequestModal(loginModal.view.getEmail());
          loginModal.transitionTo(requestModal);
        });

        return loginModal;
      }

      function getRequestModal(email) {
        requestModal = new TroupeViews.Modal({ view: new RequestModalView({ email: email }), disableClose: true });
        requestModal.view.on('request.login', function(options) {
          getLoginModal({ email: requestModal.view.getEmail(), userExists: options && options.userExists });
          requestModal.transitionTo(loginModal);
        });

        requestModal.view.on('confirm.request', function(options) {
          var data = {};
          data.email = options.userEmail;
          requestModal.transitionTo(new TroupeViews.Modal({ disableClose: true, view: new SignupModalConfirmView({ data: data }) }));
        });

        return requestModal;
      }

      if(window.troupeContext.profileNotCompleted) {
        view = new profileView.Modal({ disableClose: true  });

        view.once('close', function() {
          //modal.close();
          window.location.reload(true);
        });
        view.show();

        return;
      }


      // If the user is accessing another user's home url (trou.pe/user)
      if(window.troupeContext.homeUser) {

        // If the user doesn't have permission to talk to this user, show the Connect modal
        if(window.troupeContext.accessDenied) {

          // We might need to show the login modal, if the user is an existing user.
          if (window.troupeContext.loginToAccept) {
            getLoginModal({ email: window.localStorage.defaultTroupeEmail });
            loginModal.show();
            return;
          }

          // if the user is signed in, listen for an accept
          if (window.troupeContext.user) {
            var troupeCollection = new troupeModels.TroupeCollection();
            troupeCollection.listen();

            troupeCollection.on("add", function(model) {
              if(window.location.pathname === model.get('url')) {
                // TODO: tell the person that they've been kicked out of the troupe
                window.location.reload();
              }
            });
          }

          inviteId = window.troupeContext.inviteId;
          if (inviteId) {
            // if the user has an invite from this user show the invite accept / reject modal
            new InviteModal({ inviteId: inviteId }).show();
          } else {
              view = new ConnectUserModalView({ authenticated: !!window.troupeContext.user });
              var connectUserModal = new TroupeViews.Modal({ view: view, disableClose: true });
              connectUserModal.show();

              connectUserModal.view.on('signup.complete', function(options) {
                var data = {};
                data.email = options.email;
                connectUserModal.transitionTo(new TroupeViews.Modal({ disableClose: true, view: new SignupModalConfirmView({ data: data }) }));
              });

              connectUserModal.view.on('request.login', function(options) {
                var defaultEmail;
                if (options.email) {
                  defaultEmail = options.email;
                } else
                {
                  defaultEmail = window.localStorage.defaultTroupeEmail;
                }
                var loginModal = getLoginModal({email: defaultEmail});
                connectUserModal.transitionTo(loginModal);
              });
            }
        } else {
          // we shouldn't get here I don't think...
          return;
        }
      // The user must be accessing a Troupe
      } else {
        // If the user isn't signed in, show the login modal
        if (!window.troupeContext.user) {
          getLoginModal({ email: window.localStorage.defaultTroupeEmail } );
          loginModal.show();
          return;
        }
        else {
          /* This user is NOT logged in and is visiting a Troupe */
          if(window.troupeContext.accessDenied) {
            var troupeCollection = new troupeModels.TroupeCollection();
            troupeCollection.listen();

            // Listen out for acceptance
            troupeCollection.on("add", function(model) {

              if(model.get('url') === window.location.pathname) {
                // TODO: tell the person that they've been kicked out of the troupe
                window.location.reload();
              }
            });

            inviteId = context().inviteId;
            if (inviteId) {
              // if the user has an invite to this troupe show the invite accept / reject modal
              modal = new InviteModal({ inviteId: inviteId });
              modal.show();
              modal.on('hide', function() {
                window.location = '/last';
              });

            } else {
              // if the user is trying to access another use profile (e.g. trou.pe/user) and is not connected
              // show the user connect modal
              view = new RequestModalView({ authenticated: true });
              modal = new TroupeViews.Modal({ view: view, disableClose: true });
              modal.show();
            }
            return;
          }
        }
      }
    }

  });

  var troupeApp = new AppRouter();
  window.troupeApp = troupeApp;
  Backbone.history.start();

});
