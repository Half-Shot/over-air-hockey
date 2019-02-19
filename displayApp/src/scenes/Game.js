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
        this.player1Paddle = null;
        this.player2Paddle = null;
    }

    init ({sessionId, startMsg}) {
        this.game.oahWs.onJson = (msg) => {
            if (msg.type === "players") { // Players changed in some way.
                console.log("Got players update: ", msg);
            } else if (msg.type === "paddleMoved") { // Player paddle moved.
                console.log("Got paddleMoved update: ", msg);
                let oldX = this.plr1Pos.x;
                let oldY = this.plr1Pos.y;
                this.updatePlrPosition(msg.endPoint, this.player1Paddle);
                setTimeout(() => {
                    this.updatePlrPosition(this.plr1Pos, this.player1Paddle);
                }, 200);
            } else if (msg.type === "puckUpdate") { // Puck bounced
                console.log("Got puck update. delay:", Date.now() - msg.sentAt);
                this.puckPos = msg.puck;
                this.updatePuckPosition();
            }
        }
        console.log(startMsg);
        this.puckPos = startMsg.puck;
        this.plr1Pos = startMsg.players[0];
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
        this.player1Paddle = this.createPlayerPaddle();
        this.updatePlrPosition(this.plr1Pos, this.player1Paddle);
        this.updatePuckPosition();
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

    createPlayerPaddle() {
        const plr = this.add.graphics();
        const radius = PLR_RADIUS * this.tableScaleX;
        plr.lineStyle(radius + 3, 0x000000);

        plr.beginPath();
        plr.arc(0, 0, radius, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), false, 0.02);
        plr.strokePath();
        plr.closePath();

        plr.beginPath();
        plr.lineStyle(radius, 0x0000FF);
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
