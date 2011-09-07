exports.fromString = function(str, pos) {
  this.io     = str;
  this.pos    = pos || 0;
  this.length = str.length;
  return this;
}

exports.is_eof = function(){
  return this.pos > this.length;
}

exports.read = function(bytes) { 
  var r    = this.io.slice(this.pos, this.pos + bytes);
  this.pos += bytes;
  return r;
}

exports.readline = function(sep) { 
  sep        = sep || "\n";
  var buff   = "";
  var seplen = sep.length;
  while( buff.substring(buff.length - seplen) != sep && !(this.pos > this.length) ) {
    buff += this.read(1);
  }
  return buff;
}

exports.toString = function() {
  return "'" + this.io.slice(this.pos, this.length) + "'";
}
