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
  var stringIO       = require('subpub/io');
  var self           = this;
  this.subscriptions = {}
  var net            = require('net');
  var server         = net.createServer(function(socket) {
    socket.setEncoding("utf-8")
    socket.on('data', function(input){
      try{
        var resp = self.route(socket, self.parse(stringIO.fromString(input)));
        if(typeof(resp == 'string')){ return; };
        resp[resp.length - 2] == "\r" && resp[resp.length -1] == "\n" || (resp += "\r\n");
        socket.write( resp );
      } catch(err) {
        socket.write("-" + err + "\r\n");
        console.error(err);
        typeof(err.stack) != 'undefined' && console.error(err.stack);
      }
    });
    socket.on('close', function(){
      try {
        self.unsubscribe(socket, function(chan, rem){ /* console.log(" unsubscribed from '"+chan+"', "+rem+" remaining") */ });
      } catch(e) {
        console.error(e);
        typeof(e.stack) != 'undefined' && console.error(e.stack);
      }
    });
  });
  
  server.listen(this.port, this.host);
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


this.route = function(socket, input){
  console.log("route(socket,"+input+")");
  switch(input[0]){
    case 'PUBLISH':
      return this.publish(input[1], input[2]);
    case 'SUBSCRIBE':
      return this.subscribe(socket, input.slice(1,input.length))
    case 'PSUBSCRIBE':
      // do something
    case 'PUNSUBSCRIBE':
      // do something
    case 'UNSUBSCRIBE':
      return this.unsubscribe(socket, input.slice(1,input.length))
    case 'QUIT':
      // quit
    case 'SHUTDOWN':
      // todo - send a message to all sockets
      process.exit();
    default:
      throw("UnrecognizedCommand: '"+input[0]+"'");
  }
}
this.subscription_cnt = function(socket) {
  cnt = 0;
  for (var name in this.subscriptions) {
    this.subscriptions.hasOwnProperty(name) && this.subscriptions[name].indexOf(socket) > -1 && cnt++;
  }
  return cnt;
}
this.subscriptions_for = function(socket){
  subs = [];
  for (var name in this.subscriptions) {
    this.subscriptions.hasOwnProperty(name) && this.subscriptions[name].indexOf(socket) > -1 && subs.push(name);
  }
  return subs;
}

this.subscribe = function(socket, channels){
  reply = '';
  for (var cidx = channels.length - 1; cidx >= 0; cidx--){
    typeof(this.subscriptions[channels[cidx]]) == 'undefined' && (this.subscriptions[channels[cidx]] = []);
    this.subscriptions[channels[cidx]].indexOf(socket) == -1 && this.subscriptions[channels[cidx]].push(socket);
    reply += "*3\r\n$9\r\nsubscribe\r\n$" + channels[cidx].length + "\r\n" + channels[cidx] + "\r\n:" + this.subscription_cnt(socket) + "\r\n";
  };
  return reply; 
}

this.unsubscribe = function(socket, channels){
  // by default we send an unsubscribe confirmation to the socket
  var callback = function(chan,rem) { socket.write("*3\r\n$11\r\nunsubscribe\r\n" + chan.length + "\r\n" + chan + "\r\n:" + rem + "\r\n"); };
  // but if the last argument or the last element of the last argument is a function we'll call it for every channel
  // that the socket is unsubscribed from.
  if (typeof(channels) == 'function') { 
    callback = channels;
    channels = []
  } else if(typeof(channels) == 'undefined') {
    channels = [];
  } else if(typeof(channels[channels.length]) == 'function') {
    callback = channels.pop();
  };
  // if no channels are specified then unsubsribe from all of them.
  if (channels.length == 0) { channels = this.subscriptions_for(socket) };

  for (var cidx = channels.length - 1; cidx >= 0; cidx--){
    if (typeof(this.subscriptions[channels[cidx]]) == 'undefined') { throw("channel '"+channels[cidx]+"' does not exist"); };
    
    idx = this.subscriptions[channels[cidx]].indexOf(socket);
    if(idx == -1) { throw("not subscribe to channel '"+channels[cidx]+"'") };
    this.subscriptions[channels[cidx]].splice(idx, 1);
    
    callback(channels[cidx], this.subscription_cnt(socket));
  };
  // tells the router not to return anything
  return undefined;
}


this.psubscribe = function(socket, channels) {
  reply = '';
  for (var cidx = channels.length - 1; cidx >= 0; cidx--){
    // ...
  };
  return reply;
}

this.punsubscribe = function(socket, channels){
  reply = '';
  for (var cidx = channels.length - 1; cidx >= 0; cidx--){
    // ...
  };
  return reply;
}

this.publish = function(channel, msg) {
  if (typeof(msg) != 'string') { return "-no message given"  };
  (typeof(this.subscriptions[channel]) == 'undefined') && (this.subscriptions[channel] = []);
  var encMsg = "*3\r\n$7\r\nmessage\r\n$" + channel.length + "\r\n" + channel + "\r\n$" + msg.length + "\r\n" + msg + "\r\n"
  for (var sidx = this.subscriptions[channel].length - 1; sidx >= 0; sidx--){
    this.subscriptions[channel][sidx].write(encMsg)
  };
  return "+OK";
}
