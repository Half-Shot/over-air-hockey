const log = require("npmlog");

/**
 * AirGame holds all the logic for the actual lobby and game.
 */
class AirGame {
    constructor (tableWidthMeters = 2, tableLengthMeters = 8) {
        this.players = {};
        this.spectators = {};
        // Generate an ID for players to find us, 6 chars long.
        this.id = "";
        while(this.id.length < 6) {
            // This can generate numbers < 6 chars, so loop round.
            this.id = String(Math.ceil(Math.random()*1000000));
        }
        // Logging identifier.
        this.GLSTR = "Game:" + this.id;
        this.state = "lobby"; // One of "lobby", "game", "finished"

        // TODO: Best way to calculate size of table from meters?
        this.table = {
            width: tableWidthMeters * 300,
            height: tableLengthMeters * 300,
        }
        // Start the puck in a position
        // TODO: These are just default values, we need to set them somehow.
        this.puck = {
            x: this.table.width / 2,
            y: this.table.height / 2,
            width: 33,
            height: 33,
            velocityX: 15,
            velocityY: 30,
        };
    }

    /**
     * This reports the full set of state for a game. The name "json" is a bit of a misnomer though.
     */
    get json() {
        const players = {};
        Object.keys(this.players).forEach((k) => players[k] = {state: this.players[k].state});
        return {id: this.id, state: this.state, players, spectators: Object.keys(this.spectators).length, canStart: this.canStart};
    }

    /**
     * Is the game ready to start?
     */
    get canStart() {
        return this.state === "lobby" && Object.values(this.players).filter((p) =>
            p.state === "ready"
        ).length >= 2;
    }

    /**
     * Do we need to run the update loop?
     */
    get isRunning() {
        return this.state === "game";
    }

    /**
     * Start the game
     */
    start () {
        if (this.state === "game") {
            throw Error ("Already in-game");
        } else if (!this.canStart) {
            throw Error ("Cannot start, not all conditions have been met");
        }
        this.state = "game";
        // TODO: Put the players in the right positions and set everything up.
        this.broadcast({type: "start"});
    }

    /**
     * Adds a new connection to the game which will be broadcast to regularly.
     * A connection is mapped to a nick, so the connection will be dropped
     * if another player connects with the same nickname.
     * @param {WebSocket} ws The websocket connection
     * @param {string} type Type of connection. One of "controller", "spectator".
     * @param {string} nick The nickname for the player.
     */
    addConnection(ws, type, nick) {
        if (!ws || !type || !nick) {
            throw Error("Missing argument(s)");
        }
        log.info(this.GLSTR, `New ${type} connected: ${nick}`);
        if (type === "controller") {
            if (this.players[nick] && this.players[nick].ws) {
                //TODO: This seems insecure.
                log.warn(`Dropping existing connection for ${nick}`);
                this.players[nick].ws.close();
            }
            this.players[nick] = {ws, state: "notready"};
            this._broadcastPlayers();
        } else if (type === "spectator") {
            if (this.spectators[nick]) {
                log.warn(`Dropping existing connection for ${nick}`);
                this.spectators[nick].close();
            }
            this.spectators[nick] = ws;
        }
        // Handle the case where the websocket suddenly closed.
        ws.on('close', (ev) => {
            log.warn(this.GLSTR, `${type} ${nick} closed connection`, ev);
            if (type === "controller") {
                this.players[nick] = {ws: null, state: "disconnected"};
                this._broadcastPlayers();
            } else {
                delete this.spectators[nick];
            }
        });
    }

    /**
     * Set a player to be in the ready state.
     * @param {[type]} ws The players websocket connection.
     */
    setPlayerReady(ws) {
        const player = Object.values(this.players).find((p) =>
            p.ws === ws
        );
        if (!player) {
            throw Error ("Player not found");
        }
        player.state = "ready";
        this._broadcastPlayers();
    }

    /**
     * Broadcast a list of players and their states to all connections.
     * @return {[type]} [description]
     */
    _broadcastPlayers() {
        const json = this.json;
        this.broadcast({
            type: "players",
            players: json.players,
            canStart: json.canStart,
        });
    }

    /**
     * We got some JSON data, parse it.
     */
    onData(msg) {
        //TODO: We don't really do anything with this yet.
    }

    /**
     * This should be called regularly to update the games entites.
     * @param  {number} timePassedMs Time since last update, in ms.
     */
    onUpdate(timePassedMs) {
        // Work out how many seconds have passed since the last update.
        const relativeTime = (timePassedMs / 1000);
        // Move the puck, multiply m/s by relativeTime.
        this.puck.x += this.puck.velocityX * relativeTime;
        this.puck.y += this.puck.velocityY * relativeTime;

        const halfPuckHeight = (this.puck.height / 2);
        const halfPuckWidth = (this.puck.width / 2);

        let shouldBroadcastPosition = false;

        // This wedge of code just ensures that the puck stays within the table.
        if (
            (this.puck.x - halfPuckWidth < 0) ||
            (this.puck.x + halfPuckWidth > this.table.width)
            ) {
            this.puck.velocityX = -this.puck.velocityX;
            this.puck.x = Math.max(
                0 + halfPuckWidth,
                Math.min(
                    this.puck.x + halfPuckWidth,
                    this.table.width - halfPuckWidth
                )
            );
            shouldBroadcastPosition = true;
        }

        if (
            (this.puck.y - halfPuckHeight < 0) ||
            (this.puck.y + halfPuckHeight > this.table.height)
            ) {
            this.puck.velocityY = -this.puck.velocityY;
            this.puck.y = Math.max(
                0 + halfPuckHeight,
                Math.min(
                    this.puck.y + halfPuckHeight,
                    this.table.height - halfPuckHeight
                )
            );
            shouldBroadcastPosition = true;
        }

        // We only broadcast the pucks position IF the velocity has changed,
        // because we assume that connected clients will be tracking the position
        // locally.
        if (shouldBroadcastPosition) {
            this.broadcast({
                type: "puckUpdate",
                puck: {
                    x: Math.round(this.puck.x),
                    y: Math.round(this.puck.y),
                    velocityX: this.puck.velocityX,
                    velocityY: this.puck.velocityY,
                },
            })
        }
    }

    /**
     * Send a message to all connected clients.
     * @param  {object} msg    A object payload to send.
     * @param  {String} sendTo Send to "all", "players", "spectators"
     */
    broadcast(msg, sendTo = "all") {
        let recipients = [];
        if (sendTo === "all" || sendTo === "players") {
            // Players are stored as objects containing the wensocket.
            recipients = Object.values(this.players).map((p) => p.ws);
        }
        if (sendTo === "all" || sendTo === "spectators") {
            recipients = recipients.concat(Object.values(this.spectators));
        }
        recipients.forEach((ws) => {
            // Did the websocket connection die? Ignore it.
            if (!ws) { return; }
            ws.sendJson(msg);
        });
    }
}

module.exports = AirGame;
