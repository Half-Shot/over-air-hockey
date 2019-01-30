const log = require("npmlog");
const express = require('express');
const Game = require("./lib/Game");
const app = express();
require('express-ws')(app);   

const PORT = 3000;
const UPDATE_TIME = 1000 / 60; // Run update loop at 60hz

const ongoingGames = {};

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.ws('/ws', function(ws, req) {
    ws.sendJson = function (data) { this.send(JSON.stringify(data)); }
    ws.on('message', function(msgString) {
        let msg;
        try {
            msg = JSON.parse(msgString);
        } catch (ex) {
            log.warn("index.js", "Websocket contents could not be parsed: " + ex.message);
        }
        const game = ongoingGames[msg.gameId];
        if (msg.type === "paddle") {
            if (!game) {
                ws.sendJson({
                    id: msg.id,
                    type: "error",
                    msg: "Game not found",
                });
                log.warn("index.js", "Could not handle paddle event, gameId not known");
            }
            game.onData(msg);
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

const g = new Game();

ongoingGames[g.id] = g;
g.onData({type: "start"});

app.listen(PORT, () => log.info("index.js", `Backend listening on port ${PORT}!`));