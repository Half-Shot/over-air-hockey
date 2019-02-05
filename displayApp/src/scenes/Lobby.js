/* globals __DEV__ */
import Phaser from 'phaser'
import config from '../config'

export default class extends Phaser.Scene {
    constructor () {
        super({ key: 'LobbyScene' })
    }
    init ({sessionId}) {
        this.sessionId = sessionId;
        this.playerText = [];
        this.game.oahBackend.getWebsocket(sessionId).then((ws) => {
            this.ws = ws;
            console.log(this.ws);
            this.ws.sendJson({
                type: "subscribe",
                nick: "DisplayApp", // TODO: Set a nick somehow?
            });
            this.ws.onJson = (msg) => {
                if (msg.type === "players") {
                    this.renderPlayerList(msg.players);
                }
                console.log("RX:", msg);
            };
            return this.game.oahBackend.getSession(sessionId);
        }).then((session) => {
            this.renderPlayerList(session.players);
        });
    }

    preload () {}

    renderPlayerList(players) {
        this.playerText.forEach((textObject) => {
            textObject.destroy();
        });
        Object.keys(players).forEach((name, i) => {
            const state = players[name].state === "notready" ? "Not Ready" : "Ready";
            this.playerText.push(this.add.text(150, 300 + (33*i), `${name} - ${state}`, {
                font: `${config.scaleY * 20}px Sarabun`,
                fill: state === "Ready" ? "green" : "red",
            }));
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
    }
}
