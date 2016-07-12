"use strict";

var _ = require('lodash');
var parseRoomsIntoLeftMenuRoomList = require('gitter-web-shared/rooms/left-menu-room-list');
var parseRoomsIntoLeftMenuFavouriteRoomList = require('gitter-web-shared/rooms/left-menu-room-favourite-list');
var getOrgNameFromUri = require('gitter-web-shared/get-org-name-from-uri');
var resolveRoomAvatarSrcSet = require('gitter-web-shared/avatars/resolve-room-avatar-srcset');

module.exports = function getMainFrameSnapshots(req, troupeContext, rooms, groups, extras) {
  var currentRoom = (req.troupe || {});
  var groupName = getOrgNameFromUri(currentRoom.uri);
  var lastLeftMenuSnapshot = (troupeContext.leftRoomMenuState || {});
  req.uriContext = (req.uriContext || {});
  var selectedOrgName = lastLeftMenuSnapshot.selectedOrgName;
  var tempOrg = [];

  //Left menu state
  //------------------------------------------------------
  //Default new state is "All Conversations"
  var menuState = lastLeftMenuSnapshot.state || 'all';
  // Try the suggested
  // ex. If you are loading a home view then activate the search state
  if(extras.suggestedMenuState) {
    menuState = extras.suggestedMenuState;
  }

  var hasJoinedRoom = _.findWhere(rooms, { uri: currentRoom.uri});
  //The old group generation adds the tep-org with a prop of temp so we account for that here
  var hasJoinedGroup = _.findWhere(groups, { name: groupName }) && !_.findWhere(groups, { temp: true });

  // But if we find something later, let's use it instead
  if(groupName && !hasJoinedRoom && !hasJoinedGroup) {
    menuState = 'org';
    selectedOrgName = groupName;
    tempOrg = {
      name: selectedOrgName,
      avatarSrcset: resolveRoomAvatarSrcSet({ uri: selectedOrgName}, 22),
      type: 'org',
      active: true,
      hidden: false
    };
  }

  var roomMenuIsPinned = true;
  if(lastLeftMenuSnapshot.roomMenuIsPinned !== undefined) {
    roomMenuIsPinned = lastLeftMenuSnapshot.roomMenuIsPinned;
  }

  return {
    leftMenu: _.extend({}, lastLeftMenuSnapshot, {
      roomMenuIsPinned: roomMenuIsPinned,
      state: menuState,
      tempOrg: tempOrg,
      selectedOrgName: selectedOrgName,
    }),
    allRooms: rooms,
    rooms: parseRoomsIntoLeftMenuRoomList(menuState, rooms, selectedOrgName),
    favourites: parseRoomsIntoLeftMenuFavouriteRoomList(menuState, rooms, selectedOrgName),
    groups: groups,
  };
};
