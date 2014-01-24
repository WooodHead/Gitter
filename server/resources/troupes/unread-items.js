/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var unreadItemService = require("../../services/unread-item-service");

module.exports = {
    index: function(req, res, next) {
      var userId = req.user.id;

      unreadItemService.getUnreadItemsForUser(userId, req.troupe.id, function(err, data) {
        if(err) return next(err);

        res.send(data);
      });
    },

    create: function(req, res, next) {
      var unreadItems = req.body;
      unreadItemService.markItemsRead(req.user.id, req.troupe.id, unreadItems, function(err) {
        if(err) return next(err);

        res.send(200);

      });
    },

    destroy: function(req, res, next) {
      if(req.params.unreadItem.toLowerCase() !== 'all') next(404);

      unreadItemService.markAllChatsRead(req.user.id, req.troupe.id, function(err) {
        if(err) return next(err);

        res.send(200);

      });
    }

};
