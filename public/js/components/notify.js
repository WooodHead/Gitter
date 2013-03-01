/*jshint unused:true, browser:true*/
define([
  'jquery'
], function($){
  "use strict";

  $.prototype.notify = function(options) {
    var container = this;
    var content = options.content;
    var timeout = options.timeout ? options.timeout : 6000;
    var className = options.className ? options.className : '';
    var n, isNew = false;

    // lookup or create the notification element
    if (options.id) {
      n = this.find('#'+options.id);
    }

    if (!options.id || n.length <= 0) {
      isNew = true;
      n = $('<div class="notification"'+((options.id) ? ' id="'+options.id+'"':'')+'></div>').hide();
    }

    // ensure the requested class is on the element
    n.addClass('notification-container');
    if (className) {
      n.addClass(className);
    }

    // attach handlers on the notification-center container
    this.on('mouseenter', /* '.notification',*/ function(e) {

      if (container.data('notification-hide-running') === true && e.currentTarget === container[0]) {
        // console.log('cancelling timeouts', e);
        // cancel all hide timeouts
        container.data('notification-hide-running', false);
        container.find('.notification').each(function(n) {
          n.data('notification-hide-timeout').pause();
        });
      }
    });
    this.on('mouseleave', /* '.notification',*/ function(e) {
      if (container.data('notification-hide-running') === false && e.currentTarget === container[0]) {
        // console.log('resuming timeouts', e);
        // restart all the hide timeouts
        container.data('notification-hide-running', true);
        container.find('.notification').each(function(n) {
          n.data('notification-hide-timeout').resume(1000);
        });
      }
    });

    // replace the content
    n.html(content);

    // add & animate the element if it is new
    if (isNew) {
      n.prependTo(container);
      // add the hide timeout for this notification
      n.data('notification-hide-timeout', new Timeout(function() {
        n.animate({ left: -1 * n.outerWidth()   }, function() {
          n.hide('slow');
        });
      }, timeout));
    }
    else {
      // restart the hide timeout for this existing notification.
      // console.log('restarting timeout for existing notification');
      n.data('notification-hide-timeout').restart();
    }

    if (n.is(':hidden')) {
      n.show();
      n.css({ position: 'relative', left: -1 * n.outerWidth() });
      n.animate({ left: 0 });
    }

  };

  // Timeout util
  function Timeout(callback, delay) {
    var timerId, start, remaining = delay;

    this.pause = function() {
      window.clearTimeout(timerId);
      remaining -= new Date() - start;
    };

    this.resume = function(add) {
      start = new Date();
      remaining += (add) ? add : 0;
      timerId = window.setTimeout(callback, remaining);
    };

    this.restart = function() {
      start = new Date();
      remaining = delay;
      window.clearTimeout(timerId);
      timerId = window.setTimeout(callback, remaining);
    };

    this.resume();
  }


});
