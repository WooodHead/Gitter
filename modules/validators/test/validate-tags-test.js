'use strict';

var validateTags = require('../lib/validate-tags');
var assert = require('assert');

describe('validate-tags', function() {
  it('should validate', function() {
    assert.strictEqual(validateTags(['foo', 'bar', 'baz']), true);
  });

  it('should check max length', function() {
    var tags = [];
    for (var i=0; i<101; i++) {
      tags.push(i.toString());
    }
    assert.strictEqual(validateTags(tags), false);
  });

  it('should validate display names', function() {
    var tags = [''];
    assert.strictEqual(validateTags(tags), false);
  });

  it('should check allowed tags if specified', function() {
    var tags = ['foo', 'bar'];
    var allowedTags = ['foo'];
    assert.strictEqual(validateTags(tags, allowedTags), false);
  });

  it('should check duplicates', function() {
    var tags = ['foo', 'foo'];
    assert.strictEqual(validateTags(tags), false);
  });
});

