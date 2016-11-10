"use strict";

var env = require('gitter-web-env');
var winston = env.logger;
var nconf = env.config;
var statsd = env.createStatsClient({ prefix: nconf.get('stats:statsd:prefix')});
var Promise = require('bluebird');
var contextGenerator = require('../../../web/context-generator');
var restful = require('../../../services/restful');
var forumCategoryService = require('gitter-web-topics').forumCategoryService;
var groupService = require('gitter-web-groups');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
/* 👇 Don't use the default export will bring in tons of client-side libraries that we don't need 👇 */
var roomSort = require('gitter-realtime-client/lib/sorts-filters').pojo;
var getSubResources = require('../sub-resources');
var getMainFrameSnapshots = require('./snapshots');
var fonts = require('../../../web/fonts');
var generateLeftMenuStateForUriContext = require('./generate-left-menu-state-for-uri-context');

function getLeftMenuForumGroupInfo(leftMenuGroupId) {
  return groupService.findById(leftMenuGroupId)
    .then(function(group) {
      var forumId = group && group.forumId;

      return Promise.props({
        group: group,
        forumCategories: forumId && forumCategoryService.findByForumId(forumId)
      });
    });
}

function getTroupeContextAndDerivedInfo(req, leftMenu, socialMetadataGenerator) {
  return contextGenerator.generateMainMenuContext(req, leftMenu)
    .bind({
      troupeContext: null,
      socialMetadata: null,
      leftMenuGroup: null,
      leftMenuGroupForumCategories: null
    })
    .then(function(troupeContext) {
      this.troupeContext = troupeContext;

      var leftMenuGroupId = leftMenu.groupId;

      return [
        socialMetadataGenerator && socialMetadataGenerator(troupeContext),
        leftMenuGroupId && getLeftMenuForumGroupInfo(leftMenuGroupId),
      ];
    })
    .spread(function(socialMetadata, leftMenuGroupInfo) {
      this.socialMetadata = socialMetadata;
      this.leftMenuGroup = leftMenuGroupInfo && leftMenuGroupInfo.group;
      this.leftMenuGroupForumCategories = leftMenuGroupInfo && leftMenuGroupInfo.forumCategories;

      return this;
    });
}

function renderMainFrame(req, res, next, options) {
  var user = req.user;
  var userId = user && user.id;
  var socialMetadataGenerator = options.socialMetadataGenerator;
  var selectedRoomId = req.troupe && req.troupe.id;
  var suggestedMenuState = options.suggestedMenuState;
  var uriContext = req.uriContext;

  // First thing: figure out the state we're planning on rendering...
  return generateLeftMenuStateForUriContext(userId, uriContext, suggestedMenuState)
    .bind({
      leftMenu: null
    })
    .then(function(leftMenu) {
      this.leftMenu = leftMenu;

      return [
        getTroupeContextAndDerivedInfo(req, leftMenu, socialMetadataGenerator),
        restful.serializeTroupesForUser(userId),
        restful.serializeOrgsForUserId(userId).catch(function(err) {
          // Workaround for GitHub outage
          winston.error('Failed to serialize orgs:' + err, { exception: err });
          return [];
        }),
        restful.serializeGroupsForUserId(userId),
      ];
    })
    .spread(function(troupeContextAndDerivedInfo, rooms, orgs, groups) {
      var troupeContext = troupeContextAndDerivedInfo.troupeContext;
      var socialMetadata = troupeContextAndDerivedInfo.socialMetadata;
      var leftMenuForumGroup = troupeContextAndDerivedInfo.leftMenuGroup;
      var leftMenuForumGroupCategories = troupeContextAndDerivedInfo.leftMenuGroupForumCategories;
      var chatAppLocation = options.subFrameLocation;

      var template, bootScriptName;

      if (req.user) {
        template = 'app-template';
        bootScriptName = 'router-app';
      } else {
        template = 'app-nli-template';
        bootScriptName = 'router-nli-app';
      }

      var leftMenu = this.leftMenu;
      var snapshots = troupeContext.snapshots = getMainFrameSnapshots(leftMenu, rooms, groups, {
        leftMenuForumGroup: leftMenuForumGroup,
        leftMenuForumGroupCategories: leftMenuForumGroupCategories
      });

      if(leftMenu.state) {
        // Generate `gitter.web.prerender-left-menu` events
        statsd.increment('prerender-left-menu', 1, 0.25, [
          'state:' + leftMenu.state,
          'pinned:' + (leftMenu.roomMenuIsPinned ? '1' : '0')
        ]);
      }

      // pre-processing rooms
      // Bad mutation ... BAD MUTATION
      rooms = rooms
        .filter(function(f) {
          /* For some reason there can be null rooms. TODO: fix this upstream */
          return !!f;
        })
        .map(function(room) {
          room.selected = mongoUtils.objectIDsEqual(room.id, selectedRoomId);
          return room;
        });

      res.render(template, {
        //left menu
        leftMenuOrgs:           troupeContext.snapshots.orgs,
        roomMenuIsPinned:       snapshots.leftMenu.roomMenuIsPinned,

        //fonts
        hasCachedFonts:         fonts.hasCachedFonts(req.cookies),
        fonts:                  fonts.getFonts(),
        socialMetadata:         socialMetadata,
        bootScriptName:         bootScriptName,
        cssFileName:            "styles/" + bootScriptName + ".css",
        troupeName:             options.title,
        troupeContext:          troupeContext,
        forum:                  snapshots.forum,
        chatAppLocation:        chatAppLocation,
        agent:                  req.headers['user-agent'],
        subresources:           getSubResources(bootScriptName),
        showFooterButtons:      true,
        showUnreadTab:          true,
        menuHeaderExpanded:     false,
        user:                   user,
        orgs:                   orgs,
        isPhone:                req.isPhone,
        //TODO Remove this when left-menu switch goes away JP 23/2/16
        rooms: {
          favourites: rooms
            .filter(roomSort.favourites.filter)
            .sort(roomSort.favourites.sort),
          recents: rooms
            .filter(roomSort.recents.filter)
            .sort(roomSort.recents.sort)
        },
        userHasNoOrgs: !orgs || !orgs.length

      });

      return null;
    })
    .catch(next);
}


function renderMobileMainFrame(req, res, next, options) {
  var socialMetadataGenerator = options.socialMetadataGenerator;

  contextGenerator.generateMainMenuContext(req)
    .then(function(troupeContext) {
      return Promise.all([
        Promise.resolve(troupeContext),
        socialMetadataGenerator && socialMetadataGenerator(troupeContext)
      ]);
    })
    .spread(function(troupeContext, socialMetadata) {
      var bootScriptName = 'router-mobile-app';

      res.render('mobile/mobile-app', {
        troupeContext: troupeContext,
        fonts: fonts.getFonts(),
        hasCachedFonts: fonts.hasCachedFonts(req.cookies),
        socialMetadata: socialMetadata,
        subresources: getSubResources(bootScriptName),
        bootScriptName: bootScriptName,
        title: options.title,
        subFrameLocation: options.subFrameLocation
      });
    })
    .catch(next);
}

module.exports = exports = {
  renderMainFrame: renderMainFrame,
  renderMobileMainFrame: renderMobileMainFrame
};
