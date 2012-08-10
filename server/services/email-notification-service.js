/*jshint globalstrict:true, trailing:false */
/*global console:false, require: true, module: true */
"use strict";

var mailerService = require("./mailer-service");
var nconf = require("../utils/config").configure();


var emailDomain = nconf.get("email:domain");
var emailDomainWithAt = "@" + emailDomain;


module.exports = {
  sendConfirmationForExistingUser: function (user, troupe) {
    var troupeLink = nconf.get("web:basepath") + "/" + troupe.uri;

    mailerService.sendEmail({
      templateFile: "signupemail_existing",
      to: user.email,
      from: 'signup-robot' + emailDomainWithAt,
      subject: "You created a new Troupe",
      data: {
        troupeName: troupe.name,
        troupeLink: troupeLink
      }
    });
  },

  sendConfirmationForNewUser: function (user, troupe) {
    var confirmLink = nconf.get("web:basepath") + "/confirm/" + user.confirmationCode;
    mailerService.sendEmail({
      templateFile: "signupemail",
      to: user.email,
      from: 'signup-robot' + emailDomainWithAt,
      subject: "Welcome to Troupe",
      data: {
        troupeName: troupe.name,
        confirmLink: confirmLink
      }
    });
  }
};