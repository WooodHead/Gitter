// troupe service to deliver mails to mongo database

var mailService = require("./../../server/services/mail-service.js");
var troupeService = require("./../../server/services/troupe-service.js");
var fileService = require("./../../server/services/file-service.js");
var MailParser = require("mailparser").MailParser;
var temp = require('temp');
var fs   = require('fs');

function saveFile(troupeId, creatorUserId, fileName, mimeType, content) {
  temp.open('attachment', function(err, tempFileInfo) {
  //console.log("Temporary file created:  *********************" + tempFileInfo.path);

    var tempFileName = tempFileInfo.path;

    var ws = fs.createWriteStream(tempFileName);

    ws.on("close", function() {
      fileService.storeFile({
        troupeId: troupeId,
        creatorUserId: creatorUserId,
        fileName: fileName,
        mimeType: mimeType,
        file: tempFileName
      }, function(err, savedFile){
        if (err) return; // for now we're not going to fail if the attachment didn't fail
        //connection.logdebug("File: " + JSON.stringify(savedFile));
        //savedAttachments.push(savedFile.id);  <--- WHAT IS THAT SUPPOSED TO DO???????????
        //connection.logdebug("Saved a file.");

        // Delete the temporary file */
        fs.unlink(tempFileInfo.path);
      });
    });
    ws.write(content);
    ws.end();

    return;
  });

};

exports.hook_data = function (next, connection) {
    // enable mail body parsing
    connection.transaction.parse_body = 1;
    next();
};

exports.hook_queue = function(next, connection) {
	// Get some stuff from the header to store later
	var subject = connection.transaction.header.get("Subject");
	var date = connection.transaction.header.get("Date");
	var fromName = connection.transaction.header.get("From");
	var toName = connection.transaction.header.get("To");
	var preview;
	var fromEmail;
	
	var lines = connection.transaction.data_lines;
    if (!lines) return next(DENY);
  
	toName = toName.replace(/\n/g,"");
	fromName = fromName.replace(/\n/g,"");
	subject = subject.replace(/\n/g,"");
	
	// do some string parsing for email formats such as Name <email>
	
	if (fromName.indexOf("<") > 0)  {
    fromEmail = fromName.substring(fromName.indexOf("<") + 1, fromName.indexOf(">"));
    fromName = fromName.substring(0, fromName.indexOf("<")-1);
  }
  else {
    fromEmail = fromName;
  }
	
	//connection.logdebug("Body: " + JSON.stringify(connection.transaction.body.bodytext));
    //connection.logdebug("Children: " + JSON.stringify(connection.transaction.body.children.length));
	//connection.logdebug("Child: " + connection.transaction.body.children[0].bodytext);
	//connection.logdebug("To: " + JSON.stringify(toName));
	//connection.logdebug("From: " + fromName);
	//connection.logdebug("Email: " + fromEmail);
	//connection.logdebug("Preview: " + preview);
	//connection.logdebug("Mail Body : "+ lines.join(''));
 	//connection.logdebug("Date: " + date);

  
	troupeService.validateTroupeEmail({ to: toName, from: fromEmail}, function(err, troupe, user) {
    if (err) return next(DENY, "Sorry, either we don't know you, or we don't know the recipient. You'll never know which.");
    if (!troupe) return next (DENY, "Sorry, either we don't know you, or we don't know the recipient. You'll never know which.");

    var savedAttachments = [];

    var mailparser = new MailParser({
    });


    mailparser.on("end", function(mail_object){
      connection.logdebug("Text body:", mail_object.text);
      connection.logdebug("Rich text:", mail_object.html);

      if (mail_object.text) {
        preview = mail_object.text;
        if (preview.length>255) preview=preview.substring(0,252) + "...";
        preview = preview.replace(/\n/g,"");
      }

      var storedMailBody;

      if (mail_object.html) {
        connection.logdebug("Storing HTML body.");
        storedMailBody = mail_object.html;
      }
      else {
        connection.logdebug("Storing bording old text body.");
        storedMailBody = mail_object.text;
      }

      if (mail_object.attachments) {
        for(var i = 0; i < mail_object.attachments.length; i++) {
          var attachment = mail_object.attachments[i];
          connection.logdebug("Working with file: " + attachment.fileName);
          connection.logdebug("Working with generated file: " + attachment.generatedFileName);
          saveFile(troupe.id, user.id, attachment.generatedFileName,attachment.contentType,attachment.content);
        }
      }

      //connection.logdebug("TroupeID: "+ troupe.id);
      mailService.storeEmail({ fromEmail: fromEmail, troupeId: troupe.id, subject: subject, date: date, fromName: fromName, preview: preview, mailBody: storedMailBody, plainText: mail_object.text, richText: mail_object.html}, function(err) {
        if (err) return next(DENY, "Failed to store the email");
        connection.logdebug("Stored the email.");

        //return next(OK);
        return next (DENY, "Debug mode bounce.");
      });

    });

    mailparser.write(lines.join(''));
    mailparser.end();

  });

};


