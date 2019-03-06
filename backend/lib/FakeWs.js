const EventEmitter = require("events");
const log = require("npmlog");

class FakeWs extends EventEmitter {
    emitMsg(msg) {
        this.emit("message", JSON.stringify(msg));
    }
    send(msg) {
        log.info("FakeWs", "Got message:", msg);
    }
    sendJson(msg) {
        log.info("FakeWs", "Got message:", msg);
    }
}

module.exports = FakeWs;
