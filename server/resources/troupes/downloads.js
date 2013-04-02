/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var fileService = require('../../services/file-service'),
    winston = require('winston'),
    restSerializer = require("../../serializers/rest-serializer");

module.exports = {
    index: function(req, res, next) {
      res.relativeRedirect("/troupes/" + req.troupe.id + "/files/");
    },

    create: function(req, res, next) {
      winston.info("New file upload started..... ");
      /* File was uploaded through HTTP Form Upload */
      var files = req.files;
      for(var k in files) {
        if(files.hasOwnProperty(k)) {
          var file = files[k];
          fileService.storeFile({
            troupeId: req.troupe.id,
            creatorUserId: req.user.id,
            fileName: unescape(file.name),
            mimeType: file.type,
            file: file.path
          }, function(err, fileAndVersion) {

            // we could (should?) delete the req.files.path here, unless express does that once the req is complete. currently the upload folder is cleared out every hour anyway.

            if(err) return next(err);

            var strategy = new restSerializer.FileStrategy();

            restSerializer.serialize(fileAndVersion.file, strategy, function(err, serialized) {
              if(err) return next(err);

              /* The AJAX file upload component we use requires an object shaped like this (below) */
              res.setHeader("Content-Type","text/plain");
              res.send({ success: true, file: serialized });
            });

          });
        }
      }
    },

    show: function(req, res, next) {
      var fileName = '' + req.params.download + (req.params.format ? '.' + req.params.format : '');

      var presentedEtag = req.get('If-None-Match');

      fileService.getFileStream(req.troupe.id, fileName, 0, presentedEtag, function(err, mimeType, etagMatches, etag, stream) {
        if(err) return next(err);

        if(!stream && !etagMatches) {
          return res.send(404);
        }

        res.setHeader("Cache-Control","private");
        res.setHeader('ETag', etag);
        res.setHeader('Vary', 'Accept');
        res.setHeader('Expires', new Date(Date.now() + 365 * 86400 * 1000));
        res.contentType(mimeType);

        if(etagMatches) {
          return res.send(304);
        }

        if(!req.query["embedded"]) {
          res.header("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
        }
        stream.pipe(res);
      });

    }

};
