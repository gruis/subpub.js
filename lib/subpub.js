/** 
  function ByteLengthExceeded(message) {
    this.name = "ByteLengthExceeded";
    this.message = (message || "");
  }
  ByteLengthExceeded.prototype = Error.prototype;
*/

exports.listen = function(port, host) {
  this.port    = port || 6379;
  this.host    = host || "127.0.0.1";
  console.log("listening on "+ this.host + ":" + this.port);
  var stringIO = require('subpub/io');
  var self     = this;

  var net      = require('net');
  var server   = net.createServer(function(socket) {
    console.log("got a connection " + socket);
    socket.setEncoding("utf-8")
    socket.on('data', function(input){
      try{
        socket.write( self.route(socket, self.parse(stringIO.fromString(input))) + "\r\n" );
      } catch(err) {
        socket.write("-" + err + "\r\n");
      }
    });
    //socket.pipe(socket);
  });
  
  server.listen(this.port, this.host);
}

this.route = function(socket, input){
  console.log("route(socket, "+input+")");
  switch(input[0]){
    case 'PUBLISH':
      // do something
      this.publish(input[1], input[2]);
      return '+OK';
    case "SUBSCRIBE":
      // do something
      // this.subscribe(socket, input.slice(1,input.length))
    case "PSUBSCRIBE":
      // do something
    case "PUNSUBSCRIBE":
      // do something
    case "UNSUBSCRIBE":
      // do something
    case "QUIT":
      // quit
    case "SHUTDOWN":
      // shutdown
    default:
      throw("UnrecognizedCommand: "+input[0]);
  }
}
exports.parse = function(io) {
  var start = io.readline().replace(/(\n|\r)+$/, '');
  // inline command
  if (start[0] != '*') { return start.split(' ') };
  // Unified Request Protocol
  var input = [];
  nargs     = parseInt(start.slice(1,start.length));
  for (var i=0; i < nargs; i++) {
    len = io.readline("\r\n").replace(/(\n|\r)+$/, '');
    if (len[0] != '$' || (len = parseInt(len.slice(1,len.length)) ) == NaN) { throw("ByteLengthExceeded") };
    input.push(io.read(len));
    if (io.read(2) != "\r\n") { throw("ParseError") };
  };
  return input;
}
