const log = require("npmlog");
const express = require('express');
const Game = require("./lib/Game");
const app = express();
const cors = require('cors');

app.use(cors());
require('express-ws')(app);

const PORT = 3002;
const UPDATE_TIME = 1000 / 60; // Run update loop at 60hz

const ongoingGames = {};

log.level = "silly";


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/session/create', (req, res) => {
    log.info("index.js", "Client is creating a new session");
    const game = new Game();
    ongoingGames[game.id] = game;
    res.send(game.json);
});

app.get('/session/:id', (req, res) => {
    const id = req.params.id;
    log.info("index.js", "Client is asking for info on session:", id);
    const game = ongoingGames[id];
    if (!game) {
        log.verbose("index.js", "..was not found");
        res.sendStatus(404);
        return;
    }
    log.verbose("index.js", "found");
    res.send(game.json);
});


app.ws('/ws', function(ws, req) {
    ws.sendJson = function (data) { this.send(JSON.stringify(data)); }
    ws.on('message', function(msgString) {
        let msg;
        log.silly("RX:", msgString);
        try {
            msg = JSON.parse(msgString);
        } catch (ex) {
            log.warn("index.js", "Websocket contents could not be parsed: " + ex.message);
        }
        const game = ongoingGames[msg.gameId];
        if (!game) {
            ws.sendJson({
                id: msg.id,
                type: "error",
                msg: "Game not found",
            });
            log.warn("index.js", "Could not handle event, gameId not known");
            return;
        }
        if (msg.type === "paddle") {
            game.onData(msg);
        } else if (msg.type === "subscribe") {
            // TODO: How to deal with conflicts? We currently close the existing con.
            game.addConnection(ws, "spectator", msg.nick);
        } else {
            log.warn("index.js", "Could not handle ws message: Type not understood");
            ws.sendJson({
                id: msg.id,
                type: "error",
                msg: "Type not understood",
            });
        }
    });
});

let lastExec = Date.now();

setInterval(() => {
    Object.values(ongoingGames).forEach((game) => {
        if (game.isRunning) {
            const timeDiff = Date.now() - lastExec;
            game.onUpdate(timeDiff);
            if (timeDiff > UPDATE_TIME + 50) {
                log.warn("index.js", `Game ${game.id} lagged by more than 50ms`);
            }
        }
    });
    lastExec = Date.now();
}, UPDATE_TIME);

app.listen(PORT, () => log.info("index.js", `Backend listening on port ${PORT}!`));
