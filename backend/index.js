const log = require("npmlog");
const express = require('express');
const Game = require("./lib/Game");
const app = express();
const cors = require('cors');

// cors allows us to avoid CORS issues.
app.use(cors());
require('express-ws')(app);

const PORT = 3002;
const UPDATE_TIME = 1000 / 60; // Run update loop at 60hz

const ongoingGames = {};

log.level = "silly";

/*
Create a new session. See Game.constructor for what this entails.
 */
app.post('/session/create', (req, res) => {
    log.info("index.js", "Client is creating a new session");
    const game = new Game();
    ongoingGames[game.id] = game;
    res.send(game.json);
});

/*
Get the status of an existing session by it's Id
 */
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

/*
10 second websocket primer - It's a two way communication socket for browsers.
You can send JSON down one end and listen for it as well.
 */
app.ws('/ws', function(ws, req) {
    // This is called on a new WebSocket connection.
    // Create a handy way to send JSON to the websocket.
    ws.sendJson = function (data) { log.silly("TX:", data); this.send(JSON.stringify(data)); }

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
            // Game doesn't exist, tell the sender.
            ws.sendJson({
                id: msg.id,
                type: "error",
                msg: "Game not found",
            });
            log.warn("index.js", "Could not handle event, gameId not known");
            return;
        }

        if (msg.type === "paddle") {
            // Player moved their paddle.
            game.paddleMoved(ws, msg.direction);
        } else if (msg.type === "join") {
            // Player joined as a controller.
            game.addConnection(ws, "controller", msg.nick);
            ws.sendJson({id: msg.id, type: "ok"});
        } else if (msg.type === "ready") {
            // Player is in the lobby and has set themselves as ready.
            try {
                game.setPlayerReady(ws);
            } catch (ex) {
                ws.sendJson({id: msg.id, type: "error", msg: ex.message});
                return;
            }
            ws.sendJson({id: msg.id, type: "ok"});
        } else if (msg.type === "start") {
            // One player has asked to start the game.
            try {
                game.start();
            } catch (ex) {
                ws.sendJson({id: msg.id, type: "error", msg: ex.message});
                return;
            }
            ws.sendJson({id: msg.id, type: "ok"});
        } else if (msg.type === "subscribe") {
            // The display app has connected and waits to listen for events.
            // TODO: How to deal with conflicts? We currently close the existing con.
            game.addConnection(ws, "spectator", msg.nick);
            ws.sendJson({id: msg.id, type: "ok"});
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

// This is the game loop that will periodically execute game logic.
setInterval(() => {
    Object.values(ongoingGames).forEach((game) => {
        if (game.isRunning) {
            // This smooths out motion if we have lag on the server, by how much time has passed.
            const timeDiff = Date.now() - lastExec;
            game.onUpdate(timeDiff);
            if (timeDiff > UPDATE_TIME + 50) {
                log.warn("index.js", `Game ${game.id} lagged by more than 50ms`);
            }
        }
    });
    lastExec = Date.now();
}, UPDATE_TIME);

// Start the backend!
app.listen(PORT, () => log.info("index.js", `Backend listening on port ${PORT}!`));
