#!/usr/bin/env node
require.paths.push(__dirname + "..");
require.paths.push(__dirname + '/../deps');
require.paths.push(__dirname + '/../lib');
process.chdir(__dirname);

require("subpub.js").listen();