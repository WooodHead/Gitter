/* jshint unused:true, browser:true,  strict:true */
/* global define:false */
define([], function() {

  "use strict";

  function showAvatar(chatItemView, meta) {
  }

  var decorator = {

    decorate: function(chatItemView) {
      var meta = chatItemView.model.get('meta');
      if (meta) {
        switch (meta.type) {
          case 'user':
            showAvatar(chatItemView, meta);
            break;
        }
      }
    }

  };

  return decorator;

});