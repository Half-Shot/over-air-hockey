/* globals __DEV__ */
import Phaser from 'phaser'
import config from '../config'

export default class extends Phaser.Scene {
    constructor () {
        super({ key: 'LobbyScene' })
    }
    init ({sessionId}) {
        this.sessionId = sessionId;
        this.players = {
            "teeeeeeeeeest": "Ready",
            "foo": "Not Ready",
        }
        this.playerText = [];
        this.game.oahBackend.getWebsocket(sessionId).then((ws) => {
            this.ws = ws;
            console.log(this.ws);
            this.ws.sendJson({
                id: String(Math.ceil(Math.random()*Math.pow(10,16))),
                type: "subscribe",
                nick: "DisplayApp", // TODO: Set a nick somehow?
            });
            this.ws.onJson((msg) => {
                console.log("RX:", msg);
            });
            return this.oahBackend.getSession(sessionId);
        }).then((session) => {
            Object.keys(session.players).forEach((k) => {
                const state = session.players[k].state === "not-ready" ? "Not Ready" : "Ready";
                this.players[k] = state;
            });
        });
    }
    preload () {}

    renderPlayerList() {
        this.playerText.forEach((textObject) => {
            textObject.destroy();
        });
        Object.keys(this.players).forEach((name, i) => {
            const status = this.players[name];
            this.add.text(150, 300 + (33*i), `${name} - ${this.players[name]}`, {
                font: `${config.scaleY * 20}px Sarabun`,
                fill: status === "Ready" ? "green" : "red",
            });
        });
    }

    create () {
        this.add.text(100, 100, 'Lobby ', {
            font: `${config.scaleY * 32}px Sarabun`,
            fill: '#7744ff'
        });
        const url =  `${config.joinUrl}#${this.sessionId}`;
        this.add.text(100, 175, `To join this session, open ${url}`, {
            font: `${config.scaleY * 20}px Sarabun`,
            bold: true,
            fill: '#7744ff'
        });
        this.add.text(100, 250, 'Players: ', {
            font: `${config.scaleY * 20}px Sarabun`,
            fill: '#7744ff'
        });
        this.renderPlayerList();

    }
}
