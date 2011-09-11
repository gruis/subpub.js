/** 
  function ByteLengthExceeded(message) {
    this.name = "ByteLengthExceeded";
    this.message = (message || "");
  }
  ByteLengthExceeded.prototype = Error.prototype;
*/
exports.version = require('subpub/version').version

exports.listen = function(port, host) {
  this.port    = port || 6379;
  this.host    = host || "0.0.0.0";
  console.log("listening on "+ this.host + ":" + this.port);
  this.subscriptions = {};
  this.sub_patterns  = {};
  this.orig_pattern  = {};
  this.started_at    = new Date;
  var stringIO       = require('subpub/io');
  var self           = this;
  
  var net            = require('net');
  var server         = net.createServer(function(socket) {
    socket.setEncoding("utf-8")
    socket.on('data', function(input){
      try{
        var resp = self.route(socket, self.parse(stringIO.fromString(input)));
        if(typeof(resp) == 'undefined'){ return; };
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
        self.punsubscribe(socket, function(chan, rem){ /* console.log(" punsubscribed from '"+chan+"', "+rem+" remaining") */ });
      } catch(e) {
        console.error(e);
        typeof(e.stack) != 'undefined' && console.error(e.stack);
      }
    });
  });
  
  server.listen(this.port, this.host);
}

exports.parse = function(io) {
  var start = io.readline().replace(/(\n|\r)+$/, ''); // "\r\n").replace(/(\n|\r)+$/, '');
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
  //console.log("route(socket,"+input+")");
  // these calls could be made dynamically, but in the current architecture it would give users
  // access to internal methods that should be private.
  switch(input[0].toLowerCase()){
    case 'publish':
      return this.publish(input[1], input[2]);
    case 'subscribe':
      return this.subscribe(socket, input.slice(1,input.length));
    case 'psubscribe':
      return this.psubscribe(socket, input.slice(1,input.length));
    case 'punsubscribe':
      return this.punsubscribe(socket, input.slice(1,input.length));
    case 'unsubscribe':
      return this.unsubscribe(socket, input.slice(1,input.length));
    case 'quit':
      socket.end();
      return undefined;
    case 'shutdown':
      process.exit();       // todo - send a message to all sockets
    case 'info':
      return this.info();
    default:
      throw("UnrecognizedCommand: '"+input[0]+"'");
  }
}

this.publish = function(channel, msg) {
  if (typeof(msg) != 'string') { return "-no message given"  };

  (typeof(this.subscriptions[channel]) == 'undefined') && (this.subscriptions[channel] = []);
  var encMsg = "*3\r\n$7\r\nmessage\r\n$" + channel.length + "\r\n" + channel + "\r\n$" + msg.length + "\r\n" + msg + "\r\n";
  for (var sidx = this.subscriptions[channel].length - 1; sidx >= 0; sidx--){
    this.subscriptions[channel][sidx].write(encMsg)
  };
  
  patterns = this.matching_patterns(channel);
  for (var pidx = patterns.length - 1; pidx >= 0; pidx--){
    pattern  = patterns[pidx];
    opattern = this.orig_pattern[pattern];
    encMsg   = "*4\r\n$8\r\npmessage\r\n$" + opattern.length + "\r\n" + opattern + "\r\n$" + channel.length + "\r\n" + channel + "\r\n$" + msg.length + "\r\n" + msg + "\r\n";
    for (var sidx = this.sub_patterns[pattern].length - 1; sidx >= 0; sidx--){
      this.sub_patterns[pattern][sidx].write(encMsg);
    };
  };
  
  return "+OK";
}

/**
 * Key based subscriptions
 */

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


/**
 * Pattern Based Subscriptions
 */

this.sub_patterns_cnt = function(socket) {
  cnt = 0;
  for (var name in this.sub_patterns) {
    this.sub_patterns.hasOwnProperty(name) && this.sub_patterns[name].indexOf(socket) > -1 && cnt++;
  }
  return cnt;
}

this.sub_patterns_for = function(socket){
  subs = [];
  for (var name in this.sub_patterns) {
    this.sub_patterns.hasOwnProperty(name) && this.sub_patterns[name].indexOf(socket) > -1 && subs.push(name);
  }
  return subs;
}

this.matching_patterns = function(channel){
  matches = []
  for (var pattern in this.sub_patterns) {
    this.sub_patterns.hasOwnProperty(pattern) && channel.match("^"+pattern+"$") && matches.push(pattern);
  }
  return matches;
}

this.psubscribe = function(socket, patterns) {
  reply = '';
  for (var pidx = patterns.length - 1; pidx >= 0; pidx--){
    pattern = patterns[pidx].replace(/\./g,"\\.").replace(/\*/g,".*");
    this.orig_pattern[pattern] = patterns[pidx];
    typeof(this.sub_patterns[pattern]) == 'undefined' && (this.sub_patterns[pattern] = []);
    this.sub_patterns[pattern].indexOf(socket) == -1 && this.sub_patterns[pattern].push(socket);
    reply += "*3\r\n$10\r\npsubscribe\r\n$" + patterns[pidx].length + "\r\n" + patterns[pidx] + "\r\n:" + this.sub_patterns_cnt(socket) + "\r\n";
  };
  return reply;
}

this.punsubscribe = function(socket, patterns){
  var self     = this;
  // by default we send an unsubscribe confirmation to the socket
  var callback = function(chan,rem) { socket.write("*3\r\n$12\r\npunsubscribe\r\n" + chan.length + "\r\n" + chan + "\r\n:" + rem + "\r\n"); };
  // but if the last argument or the last element of the last argument is a function we'll call it for every channel
  // that the socket is unsubscribed from.
  if (typeof(patterns) == 'function') { 
    callback = patterns;
    patterns = []
  } else if(typeof(patterns) == 'undefined') {
    patterns = [];
  } else if(typeof(patterns[patterns.length]) == 'function') {
    callback = patterns.pop();
  };
  // if no patterns are specified then unsubsribe from all of them.
  if (patterns.length == 0) { 
    patterns = this.sub_patterns_for(socket).map(function(p){
      return self.orig_pattern[p]; 
    });
  };

  for (var pidx = patterns.length - 1; pidx >= 0; pidx--){
    pattern = patterns[pidx].replace(/\./g,"\\.").replace(/\*/g,".*");
    
    if (typeof(this.sub_patterns[pattern]) == 'undefined') { throw("channel '"+patterns[pidx]+"' does not exist"); };
    
    idx = this.sub_patterns[pattern].indexOf(socket);
    if(idx == -1) { throw("not subscribe to channel '"+patterns[pidx]+"'") };
    this.sub_patterns[pattern].splice(idx, 1);
    
    callback(patterns[pidx], this.sub_patterns_cnt(socket));
  };
  // tells the router not to return anything
  return undefined;
}


/**
 * Helper functions
 */

this.uptime = function(){
  return Math.round((new Date - this.started_at) / 1000);
}

this.info = function(){
  var inf = 'redis_version:' + this.version + '\r\nprocess_id:' + process.pid + '\r\nuptime_in_seconds:' + this.uptime() + '\r\nuptime_in_days:' + Math.round(this.uptime() / 86400);
  // 'pubsub_channels' : 
  // 'pubsub_patterns' : 
  // 'connected_clients' : 
  return '$' + inf.length + "\r\n" + inf; 
}
