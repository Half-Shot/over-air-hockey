/* globals __DEV__ */
import Phaser from 'phaser'
import config from '../config'

const PUCK_RADIUS = 15;
const PLR_RADIUS = 20;
const TABLE_WIDTH = 1400;
const TABLE_HEIGHT = 700;

export default class extends Phaser.Scene {
    constructor () {
        super({ key: 'GameScene' });
        this.tableTopX = 0;
        this.tableTopY = 0;
        this.tableScaleX = 1;
        this.tableScaleY = 1;
        this.plr1Pos = { x: 0, y:0 };
        this.plr2Pos = { x: 0, y:0 };
        this.puckPos = {
            x: 100,
            y: 100,
            velocityX: 0,
            velocityY: 0,
        };
        this.puck = null;
        this.table = null;
        this.scores = {};
        this.scoreText = [];
        this.player1Paddle = null;
        this.player2Paddle = null;
    }

    init ({sessionId, startMsg}) {
        this.game.oahWs.onJson = (msg) => {
            if (msg.type === "players") { // Players changed in some way.
                console.log("Got players update: ", msg);
            } else if (msg.type === "paddleMoved") { // Player paddle moved.
                console.log("Got paddleMoved update: ", msg);
                // Another hack around left right players.
                if (msg.nick === Object.keys(this.scores)[0]) {
                    this.updatePlrPosition(msg.endPoint, this.player1Paddle);
                    setTimeout(() => {
                        this.updatePlrPosition(this.plr1Pos, this.player1Paddle);
                    }, 200);
                } else {
                    this.updatePlrPosition(msg.endPoint, this.player2Paddle);
                    setTimeout(() => {
                        this.updatePlrPosition(this.plr2Pos, this.player2Paddle);
                    }, 200);
                }
            } else if (msg.type === "puckUpdate") { // Puck bounced
                console.log("Got puck update. delay:", Date.now() - msg.sentAt);
                this.puckPos = msg.puck;
                this.updatePuckPosition();
            } else if (msg.type === "score") {
                console.log(`SCORE: ${msg.nick} ${msg.score}`);
                this.scores[msg.nick] = msg.score;
                this.createPlayerScores();
            } else if (msg.type === "finished") {
                console.log(`FINISHED: ${msg.winner} wins`);
                this.add.text(200, 200 , `${msg.winner} has won! Tap "Rematch" to play again.`, {
                    font: `${config.scaleY * 24}px Sarabun`,
                    fill: '#7744ff'
                });
                this.puck.destroy();
            } else if (msg.type === "lobby") {
                this.game.oahWs.close();
                this.scene.start('LobbyScene', {sessionId});
                this.scene.stop("GameScene");
            }
        }
        Object.keys(startMsg.players).forEach((nick) => this.scores[nick] = 0);
        this.state = startMsg;
        console.log("Start:", startMsg);
        this.puckPos = startMsg.puck;
        this.plr1Pos = Object.values(startMsg.players)[0];
        this.plr2Pos = Object.values(startMsg.players)[1];
        this.tableScaleX = TABLE_WIDTH / startMsg.table.width;
        this.tableScaleY = TABLE_HEIGHT / startMsg.table.height;
    }

    preload () {

    }

    create () {
        const sideMargin = (window.innerWidth - TABLE_WIDTH) / 2;
        const topMargin = (window.innerHeight - TABLE_HEIGHT) - 300;
        this.tableTopX = sideMargin;
        this.tableTopY = topMargin;
        this.table = this.createTable(sideMargin, topMargin);
        this.puck = this.createPuck(sideMargin, topMargin);
        this.player1Paddle = this.createPlayerPaddle(0x0000FF);
        this.player2Paddle = this.createPlayerPaddle(0x00FF00);
        this.createPlayerScores();
        this.updatePlrPosition(this.plr1Pos, this.player1Paddle);
        this.updatePlrPosition(this.plr2Pos, this.player2Paddle);
        this.updatePuckPosition();
    }

    createPlayerScores() {
        this.scoreText.forEach((sT) => sT.destroy());
        this.scoreText = Object.keys(this.scores).map((nick, i) => {
            const y = 25 + (config.scaleY * 24)* i;
            return this.add.text(25, y , `${nick}: ${this.scores[nick]}`, {
                font: `${config.scaleY * 24}px Sarabun`,
                fill: '#7744ff'
            });
        });
    }

    createTable(sideMargin, topMargin) {
        const graphics = this.add.graphics();
        const thickness = 2;
        const color = "black";
        const alpha = 1;
        graphics.lineStyle(thickness, color, alpha);
        // Scaling
        graphics.strokeRect( 0, 0, TABLE_WIDTH, TABLE_HEIGHT);
        graphics.setX(sideMargin);
        graphics.setY(topMargin);
        // Draw goals.
        graphics.lineStyle(5, 0xFF00FF, 1.0);
        graphics.beginPath();
        graphics.moveTo(0, TABLE_HEIGHT * 0.25);
        graphics.lineTo(0, TABLE_HEIGHT * 0.75);
        graphics.closePath();
        graphics.strokePath();

        graphics.lineStyle(5, 0xFF00FF, 1.0);
        graphics.beginPath();
        graphics.moveTo(TABLE_WIDTH, TABLE_HEIGHT * 0.25);
        graphics.lineTo(TABLE_WIDTH, TABLE_HEIGHT * 0.75);
        graphics.closePath();
        graphics.strokePath();


        return graphics;
    }

    createPuck() {
        const puck = this.add.graphics();
        const radius = PUCK_RADIUS * this.tableScaleX;
        puck.lineStyle(radius + 3, 0x000000);

        puck.beginPath();
        puck.arc(0, 0, radius, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), false, 0.02);
        puck.strokePath();
        puck.closePath();

        puck.beginPath();
        puck.lineStyle(radius, 0xFF0000);
        puck.arc(0, 0, radius, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), true, 0.02);
        puck.strokePath();
        puck.closePath();
        return puck;
    }

    createPlayerPaddle(color ) {
        const plr = this.add.graphics();
        const radius = PLR_RADIUS * this.tableScaleX;
        plr.lineStyle(radius + 3, 0x000000);

        plr.beginPath();
        plr.arc(0, 0, radius, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), false, 0.02);
        plr.strokePath();
        plr.closePath();

        plr.beginPath();
        plr.lineStyle(radius, color);
        plr.arc(0, 0, radius, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), true, 0.02);
        plr.strokePath();
        plr.closePath();
        return plr;
    }

    update(totalElapsed, sinceLastUpdateMs) {
        const xSpeed = Math.round(this.puckPos.velocityX * (sinceLastUpdateMs/1000));
        const ySpeed = Math.round(this.puckPos.velocityY * (sinceLastUpdateMs/1000));
        this.puckPos.x += xSpeed;
        this.puckPos.y += ySpeed;
        this.updatePuckPosition();
    }

    updatePlrPosition(pos, obj) {
        const halfPuckRadius = (PLR_RADIUS * this.tableScaleX) / 2;
        const x = (pos.x * this.tableScaleX) + halfPuckRadius + this.tableTopX;
        const y = (pos.y * this.tableScaleY) + halfPuckRadius + this.tableTopY;
        obj.setX(x);
        obj.setY(y);
    };

    updatePuckPosition() {
        const halfPuckRadius = (PUCK_RADIUS * this.tableScaleX) / 2;
        const x = (this.puckPos.x * this.tableScaleX) + halfPuckRadius + this.tableTopX;
        const y = (this.puckPos.y * this.tableScaleY) + halfPuckRadius + this.tableTopY;
        this.puck.setX(x);
        this.puck.setY(y);
    };
}
