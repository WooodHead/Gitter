/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var winston = require("winston");
var userService = require("../services/user-service");
var troupeService = require("../services/troupe-service");
var nconf = require('../utils/config');
var middleware = require('../web/middleware');
var middleware = require('../web/middleware');
var appVersion = require("../web/appVersion");
var loginUtils = require('../web/login-utils');
var uriService = require('../services/uri-service');
var Q = require('q');
var isPhone = require('../web/is-phone');
var contextGenerator = require('../web/context-generator');

function renderHomePage(req, res, next) {
  contextGenerator.generateMiniContext(req, function(err, troupeContext) {
    if(err) {
      next(err);
    } else {
      res.render('app-template', {
        useAppCache: !!nconf.get('web:useAppCache'),
        bootScriptName: 'router-homepage',
        troupeName: req.user.displayName,
        troupeContext: JSON.stringify(troupeContext),
        troupeContextData: troupeContext,
        agent: req.headers['user-agent']
      });
    }
  });
}

function getAppCache(req) {
  if(!nconf.get('web:useAppCache')) return;
  return req.url + '.appcache';
}

function renderAppPageWithTroupe(req, res, next, page) {
  var user = req.user;
  var accessDenied = !req.uriContext.access;

  contextGenerator.generateTroupeContext(req, function(err, troupeContext) {
    if(err) {
      next(err);
    } else {
      var login = !user || troupeContext.profileNotCompleted || accessDenied;

      res.render(page, {
        appCache: getAppCache(req),
        login: login,
        isWebApp: !req.params.mobilePage,
        bootScriptName: login ? "router-login" : "router-app",
        troupeName: troupeContext.troupe.name,
        troupeContext: JSON.stringify(troupeContext),
        troupeContextData: troupeContext,
        agent: req.headers['user-agent']
      });
    }
  });
}

function uriContextResolverMiddleware(req, res, next) {
  var appUri = req.params.appUri;

  uriService.findUriForUser(appUri, req.user && req.user.id)
    .then(function(result) {
      if(result.notFound) return next(404);

      req.troupe = result.troupe;
      req.uriContext = result;

      next();
    })
    .fail(next);
}

// TODO preload invites?

function preloadOneToOneTroupeMiddleware(req, res, next) {
  uriService.findUriForUser("one-one/" + req.params.userId, req.user && req.user.id)
    .then(function(result) {
      if(result.notFound) return next(404);

      req.troupe = result.troupe;
      req.uriContext = result;

      next();
    })
    .fail(next);

}

function isPhoneMiddleware(req, res, next) {
  req.isPhone = isPhone(req.headers['user-agent']);
  next();
}

function unauthenticatedPhoneRedirectMiddleware(req, res, next) {
  if(req.isPhone && !req.user) {
    res.redirect('/login');
  } else {
    next();
  }
}

function saveLastTroupeMiddleware(req, res, next) {
  if(req.user && req.troupe) {
    userService.saveLastVisitedTroupeforUser(req.user, req.troupe, function(err) {
      if (err) winston.info("Something went wrong saving the user last troupe visited: ", { exception: err });
      next();

    });
    return;
  }

  next();
}

function renderMiddleware(template, mobilePage) {
  return function(req, res, next) {
    if(mobilePage) req.params.mobilePage = mobilePage;
    renderAppPageWithTroupe(req, res, next, template);
  };
}

module.exports = {
    install: function(app) {
      // This really doesn't seem like the right place for this?
      app.get('/s/cdn/*', function(req, res) {
        res.redirect(req.path.replace('/s/cdn', ''));
      });

      app.get('/version', function(req, res/*, next*/) {
        res.json({ appVersion: appVersion.getCurrentVersion() });
      });


      app.get('/last',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        function(req, res, next) {
          loginUtils.redirectUserToDefaultTroupe(req, res, next);
        });

      app.get('/last/:page',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        function(req, res, next) {

          return troupeService.findBestTroupeForUser(req.user)
            .then(function(troupe) {
              if(troupe) {
                return troupeService.getUrlForTroupeForUserId(troupe, req.user.id)
                  .then(function(url) {
                    return url + "/" + req.params.page;
                  });
              }

              if(req.user.hasUsername()) {
                return req.user.getHomeUrl();
              } else {
                return "/home";
              }

            })
            .then(function(url) {
              res.relativeRedirect(url);
            })
            .fail(next);

        });

      app.get('/one-one/:userId',
        middleware.grantAccessForRememberMeTokenMiddleware,
        preloadOneToOneTroupeMiddleware,
        saveLastTroupeMiddleware,
        function(req, res, next) {
          var uriContext = req.uriContext;

          if (req.user && req.params.userId === req.user.id) {
            res.relativeRedirect(req.user.username ? "/" + req.user.username : nconf.get('web:homeurl'));
            return;
          }

          // If the user has a username, use that instead
          if(uriContext && uriContext.otherUser && uriContext.otherUser.username) {
            res.relativeRedirect('/' + uriContext.otherUser.username);
            return;
          }

          next();
        },
        renderMiddleware('app-template')
      );

      /* Special homepage for users without usernames */
      app.get('/home',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        function(req, res, next) {
          if(req.user && req.user.username) {
            res.relativeRedirect(req.user.getHomeUrl());
            return;
          }

          return renderHomePage(req, res, next);
        });

      // Chat -----------------------

      app.get('/one-one/:userId/chat',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        preloadOneToOneTroupeMiddleware,
        saveLastTroupeMiddleware,
        renderMiddleware('mobile/chat-app', 'chat'));

      app.get('/:appUri/chat',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        saveLastTroupeMiddleware,
        renderMiddleware('mobile/chat-app', 'chat'));

      // Files -----------------------
      app.get('/one-one/:userId/files',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        preloadOneToOneTroupeMiddleware,
        saveLastTroupeMiddleware,
        renderMiddleware('mobile/file-app', 'files'));

      app.get('/:appUri/files',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        saveLastTroupeMiddleware,
        renderMiddleware('mobile/file-app', 'files'));


      app.get('/:appUri/mails',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        saveLastTroupeMiddleware,
        renderMiddleware('mobile/conversation-app', 'mails'));

      app.get('/:appUri/people',
        middleware.grantAccessForRememberMeTokenMiddleware,
        middleware.ensureLoggedIn(),
        uriContextResolverMiddleware,
        saveLastTroupeMiddleware,
        renderMiddleware('mobile/people-app', 'people'));

      app.get('/:appUri',
        middleware.grantAccessForRememberMeTokenMiddleware,
        uriContextResolverMiddleware,
        isPhoneMiddleware,
        unauthenticatedPhoneRedirectMiddleware,
        saveLastTroupeMiddleware,
        function(req, res, next) {
          if (req.uriContext.ownUrl) {
            return renderHomePage(req, res, next);
          }

          if(req.isPhone) {
            // TODO: this should change from chat-app to a seperate mobile app
            renderAppPageWithTroupe(req, res, next, 'mobile/mobile-app');
          } else {
            renderAppPageWithTroupe(req, res, next, 'app-template');
          }
        });

      function acceptInviteWithoutConfirmation(req, res, next) {
        var appUri = req.params.appUri || 'one-one/' + req.params.userId;

        if(!req.user) {
          req.loginToAccept = true;
          return renderAppPageWithTroupe(req, res, next, 'app-template');
        }

        var uriContext = req.uriContext;

        // If theres a troupe, theres nothing to accept
        if(uriContext.troupe) {
          return troupeService.getUrlForTroupeForUserId(uriContext.troupe, req.user.id)
            .then(function(url) {
              if(!url) throw 404;
              res.relativeRedirect(url);
            })
            .fail(next);
        }

        // If there's an invite, accept it
        if(uriContext.invite) {
          return troupeService.acceptInviteForAuthenticatedUser(req.user, uriContext.invite)
            .then(function() {
              res.relativeRedirect("/" + appUri);
            })
            .fail(next);
        }

        // Otherwise just go there
        res.relativeRedirect("/" + appUri);
      }

      app.get('/:appUri/accept/',
        middleware.ensureValidBrowser,
        middleware.grantAccessForRememberMeTokenMiddleware,
        uriContextResolverMiddleware,
        acceptInviteWithoutConfirmation);

      app.get('/one-one/:userId/accept/',
        middleware.ensureValidBrowser,
        middleware.grantAccessForRememberMeTokenMiddleware,
        preloadOneToOneTroupeMiddleware,
        acceptInviteWithoutConfirmation);

      function acceptInviteWithConfirmation(req, res) {

        var appUri = req.params.appUri || 'one-one/' + req.params.userId;
        var confirmationCode = req.params.confirmationCode;
        var login = Q.nbind(req.login, req);

        troupeService.findInviteByConfirmationCode(confirmationCode)
          .then(function(invite) {
            if(!invite) throw 404;


            if(req.user) {
              if(invite.userId == req.user.id) {
                return troupeService.acceptInviteForAuthenticatedUser(req.user, invite);
              }
              // This invite is for somebody else, log the current user out
              req.logout();
            }


            return troupeService.acceptInvite(confirmationCode, appUri)
              .then(function(result) {
                var user = result.user;

                // Now that we've accept the invite, log the new user in
                if(user) return login(user);
              });

          })
          .fail(function(err) {
            winston.error('acceptInvite failed', { exception: err });
            return null;
          })
          .then(function() {
            res.relativeRedirect("/" + appUri);
          });
      }

      app.get('/:appUri/accept/:confirmationCode',
        middleware.ensureValidBrowser,
        middleware.grantAccessForRememberMeTokenMiddleware,
        acceptInviteWithConfirmation);

      app.get('/one-one/:userId/accept/:confirmationCode',
        middleware.ensureValidBrowser,
        middleware.grantAccessForRememberMeTokenMiddleware,
        acceptInviteWithConfirmation);
    }
};
