exports.group = {
  "IO#read": function(test) {
    var IO = require('subpub/io');
    var io = IO.fromString("abcdefghijlkmno");
    test.equal(io.read(3), 'abc')
    test.equal(io.read(2), 'de')
    test.done();
  },
  "IO#readline" : function(test) {
    var IO = require('subpub/io');
    var io = IO.fromString("abcdefghijlkmno\nghij");
    test.equal(io.readline(), "abcdefghijlkmno\n");
    test.equal(io.readline(), "ghij");
    
    io = IO.fromString("abcdefghijlkmno\r\nghij");
    test.equal(io.readline("\r\n"), "abcdefghijlkmno\r\n");
    
    test.done();
  }
}