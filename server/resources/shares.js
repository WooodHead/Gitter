
module.exports = {
    index: function(req, res){
      res.send('share index');
    },

    new: function(req, res){
      res.send('new share');
    },

    create: function(req, res) {
      res.send(req.share);
    },

    show: function(req, res){
      res.send(req.share);
    },

    edit: function(req, res){
      res.send('edit forum ' + req.share.title);
    },

    update:  function(req, res){
      res.send('update forum ' + req.share.title);
    },

    destroy: function(req, res){
      res.send('destroy forum ' + req.share.title);
    },

    load: function(id, fn){
      process.nextTick(function(){
        fn(null, { id: id, title: 'SHARE' });
      });
    }

};
