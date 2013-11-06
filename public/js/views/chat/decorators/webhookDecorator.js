/* jshint unused:true, browser:true,  strict:true */
/* global define:false */
define([], function() {

  "use strict";

  function showNotificationIcon(chatItemView, meta) {
    var favicon;
    switch (meta.service) {
      case 'github':
        favicon = 'https://github.com/favicon.ico';
        console.debug(meta.commits);
        break;
      case 'bitbucket':
        favicon = 'https://bitbucket.org/favicon.ico';
        break;
      case 'jenkins':
        favicon = 'https://jenkins-ci.org/sites/default/files/jenkins_favicon.ico';
        break;
      case 'sprintly':
        favicon = 'https://sprint.ly/favicon.ico';
        break;
    }

    var iconHtml = '<div class="notification-icon"><a href="'+ meta.url +'"><img src="' + favicon  + '"></a></div>';
    chatItemView.$el.find('.trpChatText').prepend(iconHtml);

    // Only for Github hooks? maybe Bitbucket?
    // if (meta.commits) {
    //   var commitsHtml = '<ul>';
    //   meta.commits.forEach(function(commit) {
    //     commitsHtml += '<li>' + commit.author + ': <a href="' + commit.url + '" target="_blank">' + commit.message + '</a></li>';
    //   });
    //   commitsHtml += '</ul>';
    //   chatItemView.$el.find('.trpChatText').append(commitsHtml);
    // }

    // This could be moved to the template render, is here temporarily.
    chatItemView.$el.find('.trpChatBox').addClass('transparent');
  }

  var decorator = {

    decorate: function(chatItemView) {
      var meta = chatItemView.model.get('meta');
      if (meta) {
        switch (meta.type) {
          case 'webhook':
            showNotificationIcon(chatItemView, meta);
            break;
        }
      }
    }

  };

  return decorator;

});
