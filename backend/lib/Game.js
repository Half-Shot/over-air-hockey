const log = require("npmlog");

/**
 * AirGame holds all the logic for the actual lobby and game.
 */
class AirGame {
    constructor (tableWidthMeters = 8, tableHeightMeters = 2) {
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
            height: tableHeightMeters * 300,
        }
        // Start the puck in a position
        // TODO: These are just default values, we need to set them somehow.
        this.puck = {
            x: this.table.width / 2,
            y: this.table.height / 2,
            width: 33,
            height: 33,
            velocityX: 0,
            velocityY: 0,
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
    start (forcePuck = undefined) {
        if (this.state === "game") {
            throw Error ("Already in-game");
        } else if (!this.canStart) {
            throw Error ("Cannot start, not all conditions have been met");
        }
        log.info(this.GLSTR, "Game is starting");
        this.state = "game";
        // Put the first player on the left and the second player on the right.
        // TODO: Allow for more than 2 players
        const nicks = Object.keys(this.players);
        const plr1 = this.players[nicks[0]];
        const plr2 = this.players[nicks[1]];

        plr1.x = 20;
        plr1.y = plr2.y = this.table.height / 2;
        plr2.x = this.table.width - 20;
        this.players[nicks[0]] = plr1;
        this.players[nicks[1]] = plr2;

        // Place the puck randomly in front of a player
        if (forcePuck === undefined ? Math.round(Math.random()) : forcePuck === 0 ) {
            log.info(this.GLSTR, "Puck placed in front of PL1");
            this.puck.x = plr1.x + 20;
            this.puck.y = plr1.y;
        } else {
            log.info(this.GLSTR, "Puck placed in front of PL2");
            this.puck.x = plr2.x - 20;
            this.puck.y = plr2.y;
        }

        this.broadcast({
            type: "start",
            players: [
                {
                    nick: nicks[0],
                    x: plr1.x,
                    y: plr1.y,
                },
                {
                    nick: nicks[1],
                    x: plr2.x,
                    y: plr2.y,
                },
            ],
            puck: this.puck,
        });

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
            this.players[nick] = {ws, state: "notready", nick};
            this._broadcastPlayers();
        } else if (type === "spectator") {
            if (this.spectators[nick]) {
                log.warn(`Dropping existing connection for ${nick}`);
                this.spectators[nick].close();
            }
            this.spectators[nick] = ws;
        } else {
            throw new Error("Not a known connection type");
        }
        // Handle the case where the websocket suddenly closed.
        ws.on('close', (ev) => {
            log.warn(this.GLSTR, `${type} ${nick} closed connection`, ev);
            if (type === "controller") {
                this.players[nick] = {ws: null, state: "disconnected", nick};
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

    paddleMoved(ws, direction) {
        const player = Object.values(this.players).find((p) =>
            p.ws === ws
        );
        this.broadcast({
            type: "paddleMoved",
            nick: player.nick,
            direction,
        });
        log.info(this.GLSTR, "Got punt from", player.nick);
        const bbox = this._boundingBoxForPunt(player, direction);
        const puck = this.puck; // Shorthand.
        // Now, check if the puck is inside the boundaries.
        if (
            puck.x > bbox.topRight.x) {
            // Puck isn't inside our radius, ignore.
            return false;
        }
        // I apologise to whoever has to read this :(
        // Work out how far the puck is along the X axis.
        const relX = (puck.x - bbox.topLeft.x) / (bbox.topRight.x - bbox.topLeft.x);
        // Get the width of our box.
        const yWidth = Math.abs(bbox.topLeft.y - bbox.topRight.y);
        const yTop = yWidth*relX + bbox.topRight.y;
        const yBottom = yWidth*relX + bbox.bottomLeft.y;
        log.verbose(this.GLSTR, "Puck Pos:", puck);
        log.verbose(this.GLSTR, `relX:${relX} yTop:${yTop} yBottom:${yBottom}`);
        // Check if it's inside the widths.
        if (puck.y > yTop || puck.y < yBottom) {
            return false;
        }
        log.verbose(this.GLSTR, "Puck IS inside boundary");
        // Apply force to puck. We can roughly use the directional power.
        // Add a min so we don't slow the game down too much.
        puck.velocityX = Math.max(20, direction.forward - puck.velocityX);
        puck.velocityY = direction.left - direction.right;
        this.broadcast({
            type: "puckUpdate",
            puck: {
                x: Math.round(this.puck.x),
                y: Math.round(this.puck.y),
                velocityX: this.puck.velocityX,
                velocityY: this.puck.velocityY,
            },
        });
        return true;
    }

    _boundingBoxForPunt(player, direction) {
        const BOUNDARY_MARGIN = 50;
        // Did we hit the puck?
        /*
        The way this works is that we stretch a bounding box from the paddle position
        out in a direction and see where it lands.
        ----
        |   p
        |  /
        | o
        |
        |---
        */
       // Direction is left,right and foward with 0-100% values.
       const endPoint = {
           x: direction.forward * 1,
           y: player.y + (direction.left * 0.5) - (direction.right * 0.5)
       };

       // XXX: Horrible left/right hardcode.
       // Convert the relative coodinates to absolute.
       if (player.x === 20) {
           endPoint.x += 20;
       } else {
           endPoint.x = player.x - endPoint.x;
       }
       console.log(player.x);
       log.info(this.GLSTR, "Endpoint is at ", endPoint);
       // Now, check if the puck is inside the boundaries.
       return {
           topLeft: {
               x: player.x,
               y: player.y + BOUNDARY_MARGIN,
           },
           bottomLeft:  {
               x: player.x,
               y: player.y - BOUNDARY_MARGIN,
           },
           topRight:  {
               x: endPoint.x + BOUNDARY_MARGIN,
               y: endPoint.y + BOUNDARY_MARGIN,
           },
           bottomRight:  {
               x: endPoint.x + BOUNDARY_MARGIN,
               y: endPoint.y - BOUNDARY_MARGIN,
           },
       };
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
