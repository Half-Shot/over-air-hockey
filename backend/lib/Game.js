const log = require("npmlog");

class AirGame {
    constructor (tableWidthMeters = 2, tableLengthMeters = 8) {
        this.players = {};
        this.spectators = {};
        // Generate an ID for players to find us, 6 chars long.
        this.id = String(Math.ceil(Math.random()*1000000));
        this.state = "lobby";

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

    /**
     * Do we need to run the update loop
     */
    get isRunning() {
        return this.state === "game";
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
        if (type === "controller") {
            this.players[nick] = ws;
        } else if (type === "spectator") {
            this.spectators[nick] = ws;
        }
    }

    onData(msg) {
        // TODO: Check authenticity of user.
        if (msg.type === "start") {
            log.info("Game:" + this.id, "Starting game");
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
            recipients = Object.values(this.players);
        }
        if (sendTo === "all" || sendTo === "spectators") {
            recipients = recipients.concat(Object.values(this.spectators));
        }
        recipients.forEach((ws) => {
            ws.sendJson(msg);
        });
    }
}

module.exports = AirGame;