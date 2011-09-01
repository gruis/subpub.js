exports.group = {
  SubPub: function(test) {
    var subpub = require('subpub')
    test.equal(typeof(subpub["parse"]), 'function')
    test.done();
  }
}