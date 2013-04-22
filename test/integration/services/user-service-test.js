var testRequire = require('./../test-require');
var userService = testRequire('./services/user-service');
var signupService = testRequire('./services/signup-service');
var persistence = testRequire("./services/persistence-service");
var assert = testRequire("./utils/awesome-assert");

describe("User Service", function() {

  describe("#updateProfile", function() {
    it("should update the name, email, password and status of a user", function(done) {

      var userParams = {
        email: "user-service@troupetest.local",
        displayName: "Tester",
        status: "ACTIVE"
      };

      userService.newUser(userParams, function(e, user) {
        assert.strictEqual(e, null);
        assert.notStrictEqual(user, null);
        assert.notStrictEqual(typeof user, 'undefined');

        var oldUserStatus = user.status;
        var params = {
          userId: user.id,
          // displayName: user.displayName,
          // password: "newPass",
          // oldPassword: "oldPass",
          email: "hopefully-unregistered-user-service-test@troupetest.local"
        };

        userService.updateProfile(params, function(e, user) {
          assert.strictEqual(e, null);
          assert.notStrictEqual(user, null);

          // assert.strictEqual(user.displayName, params.displayName);
          assert.strictEqual(user.newEmail, params.email);
          assert.notStrictEqual(user.confirmationCode, null);
          assert.strictEqual(user.status, oldUserStatus);

          // get the confirmation code and run the confirmation
          signupService.confirm(user, function(e) {
            assert.strictEqual(e, null);
            assert.strictEqual(user.email, params.email);
            // assert.strictEqual(typeof user.newEmail, 'undefined');
            assert.strictEqual(!user.newEmail, true);

            // delete the user so that the test is atomic
            user.remove(function(e) {
              assert.strictEqual(e, null);

              done();
            });

          });

        });
      });
    });
  });

  describe("#saveLastVisitedTroupeforUser", function() {
    it('should record the time each troupe was last accessed by a user', function(done) {

      persistence.Troupe.findOne({ uri: 'testtroupe1' }, function(err, troupe) {
        if(err) return done(err);
        if(!troupe) return done("Cannot find troupe");

        userService.findByEmail('testuser@troupetest.local', function(err, user) {
          if(err) return done(err);
          if(!user) return done("Cannot find user");

          var after = new Date();
          userService.saveLastVisitedTroupeforUser(user.id, troupe.id, function(err) {
            if(err) return done(err);

            var troupeId = "" + troupe.id;

            userService.getTroupeLastAccessTimesForUser(user.id, function(err, times) {
              if(err) return done(err);
              console.log(times);
              assert(times[troupeId] > after);
              done();
            });
          });

      });



      });

    });
  });
});