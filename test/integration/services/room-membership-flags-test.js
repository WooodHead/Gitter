"use strict";

var testRequire = require('../test-require');
var assert = require('assert');

describe('room-membership-flags', function () {
  var underTest;
  before(function() {
    underTest = testRequire('./services/room-membership-flags');
  });

  describe('getModeFromFlags', function() {
    var FIXTURES = {
      "01101": "all",
      "11101": "all", // Ignore other values
      "00100": "mute",
      "10100": "mute", // Ignore other values
      "01110": "mention",
      "11110": "mention", // Ignore other values
    };

    Object.keys(FIXTURES).forEach(function(flags) {
      var mode = FIXTURES[flags];

      it('should handle ' + mode, function() {
        var result = underTest.getModeFromFlags(parseInt(flags,2));
        assert.strictEqual(result, mode);
      });
    });

  });

  describe('getUpdateForMode', function() {
    var UNTOUCHED_BITS = '11111111111111111111111';

    var FIXTURES = {
      "all-no-default": {
        mode: 'all',
        and: UNTOUCHED_BITS + "01101",
        or: "01101",
        lurk: false,
        isDefault: undefined
      },
      "announcement-no-default": {
        mode: 'announcement',
        and: UNTOUCHED_BITS + "01110",
        or: "01110",
        lurk: true,
        isDefault: undefined
      },
      "mention-no-default": {
        mode: 'mention',
        and: UNTOUCHED_BITS + "01110",
        or: "01110",
        lurk: true,
        isDefault: undefined
      },
      "mute-no-default": {
        mode: 'mute',
        and: UNTOUCHED_BITS + "00100",
        or: "00100",
        lurk: true,
        isDefault: undefined
      },

      // -------------------------------------------

      "all-is-default": {
        mode: 'all',
        and: UNTOUCHED_BITS + "11101",
        or: "11101",
        lurk: false,
        isDefault: true
      },
      "announcement-is-default": {
        mode: 'announcement',
        and: UNTOUCHED_BITS + "11110",
        or: "11110",
        lurk: true,
        isDefault: true
      },
      "mention-is-default": {
        mode: 'mention',
        and: UNTOUCHED_BITS + "11110",
        or: "11110",
        lurk: true,
        isDefault: true
      },
      "mute-is-default": {
        mode: 'mute',
        and: UNTOUCHED_BITS + "10100",
        or: "10100",
        lurk: true,
        isDefault: true
      },

      // -------------------------------------------

      "all-not-default": {
        mode: 'all',
        and: UNTOUCHED_BITS + "01101",
        or: "01101",
        lurk: false,
        isDefault: false
      },
      "announcement-not-default": {
        mode: 'announcement',
        and: UNTOUCHED_BITS + "01110",
        or: "01110",
        lurk: true,
        isDefault: false
      },
      "mention-not-default": {
        mode: 'mention',
        and: UNTOUCHED_BITS + "01110",
        or: "01110",
        lurk: true,
        isDefault: false
      },
      "mute-not-default": {
        mode: 'mute',
        and: UNTOUCHED_BITS + "00100",
        or: "00100",
        lurk: true,
        isDefault: false
      },

    };

    var FLAG_VALUES = [
      '0000000000000000000000000000',
      '1111111111111111111111111111',
      '1010101010101010101010101010',
      '1001001001001001001001001001'
    ];

    Object.keys(FIXTURES).forEach(function(testName) {
      var values = FIXTURES[testName];
      var mode = values.mode;

      it('should handle ' + testName, function() {
        var result = underTest.getUpdateForMode(mode, values.isDefault);
        assert.deepEqual(result, {
          $set: { lurk: values.lurk },
          $bit: { flags: {
                    and: parseInt(values.and, 2),
                    or: parseInt(values.or, 2)
                }
          }
        });

        FLAG_VALUES.forEach(function(flags) {
          var flagValue = parseInt(flags, 2);
          // Test for bit idempotency
          var result1 = (flagValue & parseInt(values.and, 2)) | parseInt(values.or, 2);
          var result2 = (flagValue | parseInt(values.or, 2)) & parseInt(values.and, 2);

          assert.strictEqual(result1.toString(2), result2.toString(2));
          var newMode = underTest.getModeFromFlags(result1);

          assert.strictEqual(newMode, mode === "announcement" ? "mention" : mode, "For flags " + flags + ", expected mode " + mode + " got " + newMode);
        });

      });
    });

  });

  describe('getLurkForFlags', function() {
    var FIXTURES = {
      "01101": false,
      "11101": false,
      "00100": true,
      "10100": true,
      "01110": true,
      "11110": true, // Ignore other values
    };

    Object.keys(FIXTURES).forEach(function(flags) {
      var isLurking = FIXTURES[flags];

      it('should handle ' + flags, function() {
        var result = underTest.getLurkForFlags(parseInt(flags, 2));
        assert.strictEqual(result, isLurking);
      });
    });

  });

  describe('getLurkForMode', function() {
    var FIXTURES = {
      "all": false,
      "announcement": true,
      "mention": true,
      "mute": true
    };

    Object.keys(FIXTURES).forEach(function(mode) {
      var isLurking = FIXTURES[mode];

      it('should handle ' + mode, function() {
        var result = underTest.getLurkForMode(mode);
        assert.strictEqual(result, isLurking);
      });
    });
  });

  describe('getFlagsForMode', function() {
    var FIXTURES = {
      "all-default": {
        mode: 'all',
        default: true,
        value: '11101'
      },
      "announcement-default": {
        mode: 'announcement',
        default: true,
        value: '11110'
      },
      "mention-default": {
        mode: 'mention',
        default: true,
        value: '11110'
      },
      "mute-default": {
        mode: 'mute',
        default: true,
        value: '10100'
      },

      /* ----------------------- */

      "all-not-default": {
        mode: 'all',
        default: false,
        value: '1101'
      },
      "announcement-not-default": {
        mode: 'announcement',
        default: false,
        value: '1110'
      },
      "mention-not-default": {
        mode: 'mention',
        default: false,
        value: '1110'
      },
      "mute-not-default": {
        mode: 'mute',
        default: false,
        value: '100'
      },
    };

    Object.keys(FIXTURES).forEach(function(testName) {
      var values = FIXTURES[testName];

      it('should handle ' + testName, function() {
        var result = underTest.getFlagsForMode(values.mode, values.default);
        assert.strictEqual(result.toString(2), values.value);
      });
    });
  });

  describe('toggleLegacyLurkMode', function() {
    var FIXTURES = [{
        flags: '11101',
        lurk: true,
        expected: '11110'
      },{
        flags: '11111',
        lurk: true,
        expected: '11110'
      },{
        flags: '11110',
        lurk: true,
        expected: '11110'
      },{
        flags: '0',
        lurk: true,
        expected: '0'
      },{
        flags: '11101',
        lurk: false,
        expected: '11101'
      },{
        flags: '11111',
        lurk: false,
        expected: '11111'
      },{
        flags: '11110',
        lurk: false,
        expected: '11101'
      },{
        flags: '0',
        lurk: false,
        expected: '1'
      }];

    FIXTURES.forEach(function(values, index) {
      it('should handle case ' + index, function() {
        var result = underTest.toggleLegacyLurkMode(parseInt(values.flags, 2), values.lurk);
        assert.strictEqual(result.toString(2), values.expected);
      });
    });
  });

});
