const log = require("npmlog");
const Game = require("./lib/Game");
const Backend = require("./lib/Backend");
const optionDefinitions = [
  { name: 'verbose', alias: 'v', type: Boolean },
  { name: 'port', alias: 'p', type: Number, defaultValue: 3002 },
  { name: 'fakeGame', alias: 'f', type: Boolean },
]
const opts = require("command-line-args")(optionDefinitions);
log.level = opts.verbose ? "silly" : "info";

const backend = new Backend(opts);
backend.start();
