const EventEmitter = require("events");
const log = require("npmlog");

class FakeWs extends EventEmitter {
    send(msg) {
        log.info("FakeWs", "Got message:", msg);
    }
    sendJson(msg) {
        log.info("FakeWs", "Got message:", msg);
    }
}

module.exports = FakeWs;
