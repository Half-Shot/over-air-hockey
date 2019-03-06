const cors = require('cors');
const log = require("npmlog");
const express = require('express');
const Game = require('./Game');
const FakeWs = require("./FakeWs");

const UPDATE_TIME = 1000 / 25; // Run update loop at 60hz

class Backend {
    constructor(opts) {
        this.opts = opts;
        this.ongoingGames = {};
        this.lastExec = null;
    }

    start() {
        log.info("Backend", "Starting the backend");
        const app = express();
        // cors allows us to avoid CORS issues.
        app.use(cors());
        require('express-ws')(app);
        app.post('/session/create', this._sessionCreate.bind(this));
        app.get('/session/:id', this._sessionGet.bind(this));
        app.ws('/ws', this._onWebsocket.bind(this));

        // This is the game loop that will periodically execute game logic.
        this.lastExec = Date.now();
        setInterval(this._gameLoop.bind(this), UPDATE_TIME);
        console.log(this.opts);
        if (this.opts.fakeGame) {
            log.warn("Backend", "Fake game specified, creating a fake game..");
            const game = this.createFakeGame();
            console.log(game);
        }
        app.listen(this.opts.port, () => log.info("Backend", `Backend listening on port ${this.opts.port}!`));
    }

    createFakeGame() {
        // Create a fake websocket
        const fakeWs = new FakeWs();
        const fakeWs2 = new FakeWs();
        //const fakeWs3 = new FakeWs();
        const game = new Game(undefined, undefined, 1);
        this.ongoingGames[game.id] = game;
        game.addConnection(fakeWs, "spectator", "Mr. FakeScreen");
        game.addConnection(fakeWs2, "controller", "Player One");
        //game.addConnection(fakeWs3, "controller", "Player Two");
        game.setPlayerReady(fakeWs2);
        //game.setPlayerReady(fakeWs3);
        //game.start();
        log.info("Backend", `Created new fake game ${game.id}`);
        return game;
    }

    _gameLoop() {
        Object.values(this.ongoingGames).forEach((game) => {
            if (game.isRunning) {
                // This smooths out motion if we have lag on the server, by how much time has passed.
                const timeDiff = Date.now() - this.lastExec;
                game.onUpdate(timeDiff);
                if (timeDiff > UPDATE_TIME + 50) {
                    log.warn("Backend", `Game ${game.id} lagged by more than 50ms`);
                }
            }
        });
        this.lastExec = Date.now();
    }

    /*
    Create a new session. See Game.constructor for what this entails.
     */
    _sessionCreate(req, res) {
        const game = new Game();
        this.ongoingGames[game.id] = game;
        log.info("Backend", `Created new game ${game.id}`);
        res.send(game.json);
    }

    /*
    Get the status of an existing session by it's Id
     */
    _sessionGet(req, res) {
        let id = req.params.id;
        log.info("Backend", "Client is asking for info on session:", id);
        let game = this.ongoingGames[id];
        if (this.opts.fakeGame && !game) {
            log.warn("Backend", "Fake game override:", id);
            id = Object.keys(this.ongoingGames)[0];
            game = this.ongoingGames[id].json;
            game.redirectId = id;
        }
        else if (!game) {
            log.verbose("Backend", "..was not found");
            res.sendStatus(404);
            return;
        } else {
            game = game.json;
        }
        log.verbose("Backend", "found");
        res.send(game);
    }

    _onWebsocket(ws, req) {
        /*
        10 second websocket primer - It's a two way communication socket for browsers.
        You can send JSON down one end and listen for it as well.
         */

        // This is called on a new WebSocket connection.
        // Create a handy way to send JSON to the websocket.
        ws.sendJson = function (data) { log.silly("TX:", data); this.send(JSON.stringify(data)); }

        ws.on('message', (msgString) => {
            let msg;
            log.silly("RX:", msgString);
            try {
                msg = JSON.parse(msgString);
            } catch (ex) {
                log.warn("Backend", "Websocket contents could not be parsed: " + ex.message);
            }

            const game = this.ongoingGames[msg.gameId];
            if (!game) {
                // Game doesn't exist, tell the sender.
                ws.sendJson({
                    id: msg.id,
                    type: "error",
                    msg: "Game not found",
                });
                log.warn("Backend", "Could not handle event, gameId not known");
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
            } else if (msg.type === "rematch") {
                // The display app has connected and waits to listen for events.
                // TODO: How to deal with conflicts? We currently close the existing con.
                game.rematch();
            } else {
                log.warn("Backend", "Could not handle ws message: Type not understood");
                ws.sendJson({
                    id: msg.id,
                    type: "error",
                    msg: "Type not understood",
                });
            }
        });
    }
}

module.exports = Backend;
