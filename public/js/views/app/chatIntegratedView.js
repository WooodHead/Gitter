/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'utils/context',
  'marionette',
  'utils/appevents',
  'views/app/uiVars',
  'views/widgets/avatar',
  'components/modal-region',
  'utils/scrollbar-detect',
  'transloadit'
], function($, context, Marionette, appEvents, uiVars, AvatarView, modalRegion, hasScrollBars) {
  "use strict";

  /** @const */
  var BACKSPACE = 8;

  var touchEvents = {
    // "click #menu-toggle-button":        "onMenuToggle",
    "keypress":                         "onKeyPress"
  };

  var mouseEvents = {
    // "keypress":                         "onKeyPress",
    "keydown": "onKeyDown",
    "keyup": "onKeyUp",
    "click #favourite-button":          "toggleFavourite"
  };

  $('.trpDisplayPicture').tooltip('destroy');

  var ChatLayout = Marionette.Layout.extend({
    el: 'body',
    leftmenu: false,
    rightpanel: false,
    profilemenu: false,
    shifted: false,
    alertpanel: false,
    files: false,
    originalRightMargin: "",
    regions: {
      rightPanelRegion: "#right-panel",
      rightToolbarRegion: "#toolbar-frame"
    },

    events: uiVars.isMobile ? touchEvents : mouseEvents,

    initialize: function() {
      var self = this;

      new AvatarView({
        el: $('#profile-icon'),
        user: context.getUser(),
        showTooltip: false
      }).render();

      // tooltips for the app-template
      $('#profile-icon, #home-icon').tooltip();

      this.dialogRegion = modalRegion;

      this.rightPanelRegion.on('show', function() {
        self.showPanel("#right-panel");
      });

      if (hasScrollBars()) {
        $(".trpChatContainer").addClass("scroller");
        $(".trpChatInputArea").addClass("scrollpush");
        $("#room-content").addClass("scroller");
      }

      this.enableDragAndDrop();
    },

    toggleFavourite: function() {
      var favHeader = $('.trpTroupeFavourite');
      favHeader.toggleClass('favourited');
      var isFavourite = favHeader.hasClass('favourited');

      $.ajax({
        url: '/api/v1/user/' + context.getUserId() + '/troupes/' + context.getTroupeId(),
        contentType: "application/json",
        dataType: "json",
        type: "PUT",
        data: JSON.stringify({ favourite: isFavourite })
      });
    },


    onKeyDown: function(e) {
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Avoid backspace from navigating back
      if (e.keyCode === BACKSPACE) {
        e.stopPropagation();
        e.preventDefault();
      }
    },

    onKeyUp: function(e) {
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if((e.keyCode === 82) || (e.keyCode ===81) && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        this.quoteText();
      }
    },

    getSelectionText: function() {
      var text = "";
      if (window.getSelection) {
        text = window.getSelection().toString();
      } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
      }
      return text;
    },

    quoteText: function() {
      var selectedText = this.getSelectionText();
      if (selectedText.length > 0) {
        appEvents.trigger('input.append', "> " + selectedText, { newLine: true });
      }
    },

    enableDragAndDrop: function() {
      var progressBar = $('#file-progress-bar');

      function ignoreEvent(e) {
        e.stopPropagation();
        e.preventDefault();
      }

      function start() {
        setTimeout(function(){ progressBar.css('width', '10%'); }, 50);
        setTimeout(function(){ progressBar.css('width', '20%'); }, 150);
      }

      function progress(bytesReceived, bytesExpected) {
        var percentage = (bytesReceived / bytesExpected * 100 + 20).toFixed(2) + '%';
        setTimeout(function(){ progressBar.css('width', percentage); }, 200);
      }

      function reset() {
        progressBar.hide(function() {
          progressBar.css('width', '0%');
        });
      }

      function dropEvent(e) {
        e.stopPropagation();
        e.preventDefault();

        progressBar.show();

        // Prepare formdata
        e = e.originalEvent;
        var files = e.dataTransfer.files;
        if (files.length === 0) { return; }
  
        var formdata = new FormData();
        for (var i in files) {
          if (typeof files[i] === 'object') {
            formdata.append("file", files[i]);
          }
        }

        // Generate signature and upload
        $.ajax({
          type: 'GET', 
          url: '/api/private/generate-signature',
          data: 'room_uri=' + context().troupe.uri + '&room_id=' + context().troupe.id, 
          success: function(data) { 
            formdata.append("signature", data.sig);

            var options = {
              wait: true,
              modal: false,
              autoSubmit: false,
              onStart: start,
              onProgress: progress,
              onSuccess: reset,
              onError: reset,
              formData: formdata
            };

            var form = $('#upload-form'); 
            form.find('input[name="params"]').attr('value', data.params);
            form.unbind('submit.transloadit');
            form.transloadit(options);
            form.submit();
          }
        });
      }

      var el = $('body');
      el.on('dragenter', ignoreEvent);
      el.on('dragover',  ignoreEvent);
      el.on('drop',      dropEvent);
    }
  });
    
  return ChatLayout;
});
