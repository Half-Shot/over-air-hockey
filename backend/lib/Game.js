const log = require("npmlog");


class AirGame {
    constructor (tableWidthMeters = 2, tableLengthMeters = 8) {
        this.players = {};
        this.spectators = {};
        // Generate an ID for players to find us, 6 chars long.
        this.id = String(Math.ceil(Math.random()*1000000));
        this.GLSTR = "Game:" + this.id;
        this.state = "lobby"; // One of "lobby", "game", "finished"

        // TODO: Best way to calculate size of table from meters.
        this.table = {
            width: tableWidthMeters * 300,
            height: tableLengthMeters * 300,
        }
        this.puck = {
            x: this.table.width / 2,
            y: this.table.height / 2,
            width: 33,
            height: 33,
            velocityX: 15,
            velocityY: 30,
        };
    }

    get json() {
        const players = {};
        Object.keys(this.players).forEach((k) => players[k] = {state: this.players[k].state});
        return {id: this.id, state: this.state, players, spectators: Object.keys(this.spectators).length, canStart: this.canStart};
    }

    get canStart() {
        return this.state === "lobby" && Object.values(this.players).filter((p) =>
            p.state === "ready"
        ).length >= 2;
    }

    /**
     * Do we need to run the update loop
     */
    get isRunning() {
        return this.state === "game";
    }

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
     *
     * @param {WebSocket} ws The websocket connection
     * @param {*} type Type of connection. One of "controller", "spectator".
     */
    addConnection(ws, type, nick) {
        if (!ws || !type || !nick) {
            throw Error("Missing argument(s)");
        }
        log.info(this.GLSTR, `New ${type} connected: ${nick}`);
        if (type === "controller") {
            if (this.players[nick] && this.players[nick].ws) {
                log.warn(`Dropping existing connection for ${nick}`);
                this.players[nick].ws.close();
            }
            this.players[nick] = {ws, state: "notready"};
            console.log(this.players);
            this._broadcastPlayers();
        } else if (type === "spectator") {
            if (this.spectators[nick]) {
                log.warn(`Dropping existing connection for ${nick}`);
                this.spectators[nick].close();
            }
            this.spectators[nick] = ws;
        }
        ws.on('close', (ev) => {
            log.info(this.GLSTR, `${type} ${nick} closed connection`, ev);
            if (type === "controller") {
                this.players[nick] = {ws: null, state: "disconnected"};
                this._broadcastPlayers();
            } else {
                delete this.spectators[nick];
            }
        });
    }

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

    _broadcastPlayers() {
        const json = this.json;
        this.broadcast({
            type: "players",
            players: json.players,
            canStart: json.canStart,
        });
    }

    onData(msg) {
        // TODO: Check authenticity of user.
        if (msg.type === "start") {
            log.info(this.GLSTR, "Starting game");
            this.state = "game";
        }
    }

    onUpdate(timePassedMs) {
        const relativeTime = (timePassedMs / 1000);
        this.puck.x += this.puck.velocityX * relativeTime;
        this.puck.y += this.puck.velocityY * relativeTime;

        const halfPuckHeight = (this.puck.height / 2);
        const halfPuckWidth = (this.puck.width / 2);
        let shouldBroadcastPosition = false;

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

    broadcast(msg, sendTo = "all") {
        let recipients = [];
        if (sendTo === "all" || sendTo === "players") {
            recipients = Object.values(this.players).map((p) => p.ws);
        }
        if (sendTo === "all" || sendTo === "spectators") {
            recipients = recipients.concat(Object.values(this.spectators));
        }
        recipients.forEach((ws) => {
            if (!ws) { return; }
            ws.sendJson(msg);
        });
    }
}

module.exports = AirGame;
