var assert = require("node-assert-extras");

exports.group = {
  version: function(test){
    test.equal(typeof(require('subpub').version), 'string')
    test.done();
  },
  SubPub: function(test) {
    var subpub = require('subpub')
    test.equal(typeof(subpub["parse"]), 'function')
    assert.isFunction(subpub['parse'])
    test.done();
  },
  'parse subscribe': function(test) {
    var subpub = require('subpub')
    parsed = subpub.parse(require('subpub/io').fromString("SUBSCRIBE data.json\r\n"));
    test.equal(Object.prototype.toString.call(parsed), '[object Array]');
    test.equal(parsed[0], 'SUBSCRIBE');
    test.equal(parsed[1], 'data.json');
    test.done();
  },
  'parse psubscribe': function(test) {
    var subpub = require('subpub')
    parsed = subpub.parse(require('subpub/io').fromString("PSUBSCRIBE data.*\r\n"));
    test.equal(Object.prototype.toString.call(parsed), '[object Array]');
    test.equal(parsed[0], 'PSUBSCRIBE');
    test.equal(parsed[1], 'data.*');
    test.done();    
  },
  'parse unsubscribe': function(test) {
    var subpub = require('subpub')
    parsed = subpub.parse(require('subpub/io').fromString("UNSUBSCRIBE data.json\r\n"));
    test.equal(Object.prototype.toString.call(parsed), '[object Array]');
    test.equal(parsed[0], 'UNSUBSCRIBE');
    test.equal(parsed[1], 'data.json');
    test.done();
  },
  'parse punsubscribe': function(test) {
    var subpub = require('subpub')
    parsed = subpub.parse(require('subpub/io').fromString("PUNSUBSCRIBE data.*\r\n"));
    test.equal(Object.prototype.toString.call(parsed), '[object Array]');
    test.equal(parsed[0], 'PUNSUBSCRIBE');
    test.equal(parsed[1], 'data.*');
    test.done();
  },
  'parse publish command': function(test) {
    var subpub  = require('subpub')
    var msg     = '{"data" : "a message for you"}'
    var channel = "data.json"
    parsed      = subpub.parse(require('subpub/io').fromString("*3\r\n$7\r\nPUBLISH\r\n$"+channel.length+"\r\n"+channel+"\r\n$"+msg.length+"\r\n"+msg+"\r\n"));
    test.equal(Object.prototype.toString.call(parsed), '[object Array]');
    test.equal(parsed.length, 3);
    test.equal(parsed[0], 'PUBLISH');
    test.equal(parsed[1], channel);
    test.equal(parsed[2], msg);
    test.done();
  },
  'publish fast': function(test){
    var subpub  = require('subpub')
    var msg     = '{"data" : "a message for you"}'
    var channel = "data.json"
    var start   = new Date().getTime();
    for (var i = 75000; i >= 0; i--){
      subpub.parse(require('subpub/io').fromString("*3\r\n$7\r\nPUBLISH\r\n$"+channel.length+"\r\n"+channel+"\r\n$"+msg.length+"\r\n"+msg+"\r\n"));
    };
    took = (new Date().getTime() - start) / 1000;
    test.ok(took < 1, "expected "+ took + "s to be less than 1s");
    test.done();
  }
  
}

