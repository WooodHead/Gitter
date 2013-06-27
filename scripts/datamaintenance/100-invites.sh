#!/bin/bash

MONGO_URL=$1
if [ -z "$MONGO_URL" ]; then MONGO_URL=troupe; fi

# The password is 123456

# Add some test users
mongo --verbose $MONGO_URL <<"DELIM"

db.invites.remove({ email: /@troupetest.local$/ });

db.invites.find().forEach(function(d) {
  if(d.userId && !db.users.findOne({ _id: d.userId})) {
    print('Deleting ', d);
    db.invites.remove({ userId: d.userId });
  }

  if(d.troupeId && !db.troupes.findOne({ _id: d.troupeId})) {
     print('Deleting ', d);
     db.invites.remove({ troupeId: d.troupeId });
  }

  if(!d.troupeId && !d.fromUserId) {
    print('Deleting ', d);
    db.invites.remove({ _id: d._id });
    return;
  }

  if(!d.userId && !d.email) {
    print('Deleting ', d);
    db.invites.remove({ _id: d._id });
    return;
  }
});

DELIM
