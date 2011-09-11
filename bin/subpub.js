#!/usr/bin/env node
require.paths.push(__dirname + "..");
require.paths.push(__dirname + '/../deps');
require.paths.push(__dirname + '/../lib');
process.chdir(__dirname);

var config = {
  'port': 6379,
  'host':"0.0.0.0"
};

var Path   = require("path");
var path   = Path.resolve(process.env.HOME + "/.subpub/config.json");

if (Path.existsSync(path)) {
  cnf = JSON.parse(require("fs").readFileSync(path));
  for (var key in cnf) {
    cnf.hasOwnProperty(key) && (config[key] = cnf[key]);
  }
};

require("subpub.js").listen(config["port"], config["host"]);
