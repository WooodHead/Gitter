/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

module.exports = {
    install: function(app) {
      // This really doesn't seem like the right place for this?
      app.get('/s/cdn/*', function(req, res) {
        res.redirect(req.path.replace('/s/cdn', ''));
      });
    }
};