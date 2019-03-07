const log = require("npmlog");
const promClient = require('prom-client');

const SPEED_MULTIPLIER = 10;
const MIN_VELOCITY = 100;
const MAX_VELOCITY = 600;

const MIN_VELOCITY_Y = -300;
const MAX_VELOCITY_Y = 300;

const PUCK_UPDATE_INTERVAL_MS = 500;

const GOAL_HEIGHT_PERCENTAGE = 0.5;

const WIN_SCORE = 9;

const gamesCreated = new promClient.Counter({
    name: 'oah_games_created',
    help: 'Number of games created',
    labelNames: []
});

const timeTakenToStartGame = new promClient.Gauge({
    name: 'oah_start_time',
    help: 'How long did the game take to start, in ms',
    labelNames: []
});

const paddleSwingCount = new promClient.Counter({
    name: 'oah_paddle_swings',
    help: 'Paddle swings at the puck',
    labelNames: ['hit', 'player_side']
});

const goalsScored = new promClient.Counter({
    name: 'oah_goals_scored',
    help: 'How many goals have been scored, and by who',
    labelNames: ['player_side']
});

const completedGames = new promClient.Counter({
    name: 'oah_completed_games',
    help: 'How many games finished',
    labelNames: []
});


/**
 * AirGame holds all the logic for the actual lobby and game.
 */
class AirGame {
    constructor (tableWidthMeters = 4, tableHeightMeters = 1, minPlayers = 2) {
        this.minPlayers = minPlayers;
        this.creationTime = Date.now();
        this.players = {};
        this.spectators = {};
        this.lastPuckUpdate = 0;
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
            goalHeight: (tableHeightMeters * 300) * GOAL_HEIGHT_PERCENTAGE,
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
        gamesCreated.inc();
    }

    /**
     * This reports the full set of state for a game. The name "json" is a bit of a misnomer though.
     */
    get json() {
        const players = {};
        let puck = undefined;
        let table = undefined;
        if (this.state === "game") {
            puck = this.puck;
            table = this.table;
        }
        for (const plr of Object.values(this.players)) {
            const player = Object.assign({}, plr);
            player.ws = undefined;
            console.log(player);
            players[plr.nick] = plr;
        }
        return {
            id: this.id,
            state: this.state,
            players,
            spectators: Object.keys(this.spectators).length,
            canStart: this.canStart,
            puck,
            table,
        };
    }

    /**
     * Is the game ready to start?
     */
    get canStart() {
        return this.state === "lobby" && Object.values(this.players).filter((p) =>
            p.state === "ready"
        ).length >= this.minPlayers;
    }

    /**
     * Do we need to run the update loop?
     */
    get isRunning() {
        return this.state === "game";
    }

    rematch() {
        this.state = "lobby";
        this.broadcast({
            type: "lobby"
        });
    }

    /**
     * Start the game
     */
    start (forcePuck = undefined) {
        timeTakenToStartGame.set(Date.now() - this.creationTime);
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
        plr1.y = this.table.height / 2;
        plr1.score = 0;
        plr2.x = this.table.width - 40;
        plr2.y = this.table.height / 2;
        plr2.score = 0;
        this.players[nicks[0]] = plr1;
        this.players[nicks[1]] = plr2;

        // Force player 2
        forcePuck = 1;

        // Place the puck randomly in front of a player
        if (forcePuck === undefined ? Math.round(Math.random()) : forcePuck === 0 ) {
            log.info(this.GLSTR, "Puck placed in front of PL1");
            this.puck.x = plr1.x + 80;
            this.puck.y = plr1.y;
        } else {
            log.info(this.GLSTR, "Puck placed in front of PL2");
            this.puck.x = plr2.x - 80;
            this.puck.y = plr2.y;
        }

        this.broadcast({
            type: "start",
            players: this.json.players,
            table: this.table,
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
        const left = player.x === 20;
        log.info(this.GLSTR, "Got punt from", player.nick);
        const bbox = this._boundingBoxForPunt(player, direction);
        log.info(this.GLSTR, "BBox:", bbox);
        this.broadcast({
            type: "paddleMoved",
            nick: player.nick,
            direction,
            endPoint: bbox.endPoint,
        });
        const puck = this.puck; // Shorthand.
        // Now, check if the puck is inside the boundaries.
        if ((left && puck.x > bbox.topRight.x) || (!left && puck.x < bbox.topRight.x)) {
            paddleSwingCount.inc({hit: "false", player_side: left ? "left" : "right"});
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
            paddleSwingCount.inc({hit: "false", player_side: left ? "left" : "right"});
            return false;
        }
        log.verbose(this.GLSTR, "Puck IS inside boundary");
        // Apply force to puck. We can roughly use the directional power.
        // Add a min so we don't slow the game down too much.

        // HACK: Controls seem unfairly weighted towards the right
        direction.left += 10;
        puck.velocityX = (direction.forward - puck.velocityX) * SPEED_MULTIPLIER;
        puck.velocityY = (direction.left - direction.right) * SPEED_MULTIPLIER;

        log.verbose(this.GLSTR, `Puck punt velocity: ${puck.velocityX} ${puck.velocityY}`);

        puck.velocityX = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, puck.velocityX));
        if (!left) {
            puck.velocityX = -puck.velocityX;
        }
        puck.velocityY = Math.max(MIN_VELOCITY_Y, Math.min(MAX_VELOCITY_Y, puck.velocityX));
        const res = {
            type: "puckUpdate",
            nick: player.nick,
            puck: {
                x: Math.round(this.puck.x),
                y: Math.round(this.puck.y),
                velocityX: this.puck.velocityX,
                velocityY: this.puck.velocityY,
            },
        }
        ws.sendJson(res);
        this.broadcast(res, "spectators");
        return true;
    }

    _boundingBoxForPunt(player, direction) {
        const BOUNDARY_MARGIN = 100;
        const BOUNDARY_MARGIN_Y = 150;
        const left = player.x == 20;
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
           x: direction.forward * 3,
           y: player.y + (direction.left * 0.5) - (direction.right * 0.5)
       };

       // XXX: Horrible left/right hardcode.
       // Convert the relative coodinates to absolute.
       if (left) {
           log.verbose("Hitting from left");
           endPoint.x += 20 + BOUNDARY_MARGIN;
       } else {
           log.verbose("Hitting from right");
           endPoint.x = player.x - endPoint.x - BOUNDARY_MARGIN;
       }
       log.verbose(this.GLSTR, "Endpoint is at ", endPoint);
       // Now, check if the puck is inside the boundaries.
       return {
           topLeft: {
               x: player.x,
               y: player.y + BOUNDARY_MARGIN_Y,
           },
           bottomLeft:  {
               x: player.x,
               y: player.y - BOUNDARY_MARGIN_Y,
           },
           topRight:  {
               x: endPoint.x,
               y: endPoint.y + BOUNDARY_MARGIN_Y,
           },
           bottomRight:  {
               x: endPoint.x,
               y: endPoint.y - BOUNDARY_MARGIN_Y,
           },
           endPoint,
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
        this.puck.x += Math.round(this.puck.velocityX * relativeTime);
        this.puck.y += Math.round(this.puck.velocityY * relativeTime);

        this.lastPuckUpdate += timePassedMs;

        const halfPuckHeight = (this.puck.height / 2);
        const halfPuckWidth = (this.puck.width / 2);

        let shouldBroadcastPosition = this.lastPuckUpdate >= PUCK_UPDATE_INTERVAL_MS;

        // This wedge of code just ensures that the puck stays within the table.
        const puckXEdge = this.puck.x - halfPuckWidth;
        const puckYEdge = this.puck.y - halfPuckWidth;
        if (
            (puckXEdge < 0) ||
            puckXEdge > this.table.width
            ) {
                const BOUNDARY_HEIGHTS = (this.table.height * (1-GOAL_HEIGHT_PERCENTAGE) / 2);
                console.log(BOUNDARY_HEIGHTS, this.table.height, puckYEdge);
                if (puckYEdge > BOUNDARY_HEIGHTS && puckYEdge < this.table.height - BOUNDARY_HEIGHTS) {
                    log.info("Hit goal!");
                    let plrNick;
                    let scorer;
                    if (this.puck.x < 10) {
                        // Goal was in P1s goal.
                        plrNick = Object.keys(this.players)[0];
                        scorer = Object.keys(this.players)[1];
                        log.info(this.GLSTR, "Puck placed in front of PL1");
                        this.puck.x = puckXEdge + 80;
                        this.puck.y = this.players[plrNick].y;
                        goalsScored.inc({player_side: "left"});
                    } else {
                        // Goal was in P2s goal.
                        plrNick = Object.keys(this.players)[1];
                        scorer = Object.keys(this.players)[0];
                        log.info(this.GLSTR, "Puck placed in front of PL2");
                        this.puck.x = this.table.width - 80;
                        this.puck.y = this.players[plrNick].y;
                        goalsScored.inc({player_side: "right"});
                    }
                    this.puck.velocityX = 0;
                    this.puck.velocityY = 0;
                    this.players[scorer].score += 1;
                    this.broadcast({ type: "score", nick: scorer, score: this.players[scorer].score }, "spectators");
                    if (this.players[scorer].score === WIN_SCORE) {
                        this.broadcast({ type: "finished", winner: scorer});
                        this.state = "finished";
                        completedGames.inc();
                        return;
                    }
            } else {
                this.puck.velocityX = -this.puck.velocityX;
                this.puck.x = Math.max(
                    0 + halfPuckWidth,
                    Math.min(
                        this.puck.x + halfPuckWidth,
                        this.table.width - halfPuckWidth
                    )
                );
            }
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
            this.lastPuckUpdate = 0;
            this.broadcast({
                type: "puckUpdate",
                puck: {
                    x: Math.round(this.puck.x),
                    y: Math.round(this.puck.y),
                    velocityX: this.puck.velocityX,
                    velocityY: this.puck.velocityY,
                }
            }, "spectators");
        }
    }

    /**
     * Send a message to all connected clients.
     * @param  {object} msg    A object payload to send.
     * @param  {String} sendTo Send to "all", "players", "spectators"
     */
    broadcast(msg, sendTo = "all") {
        let recipients = [];
        msg.sentAt = Date.now();
        if (sendTo === "all" || sendTo === "players") {
            // Players are stored as objects containing the websocket.
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
