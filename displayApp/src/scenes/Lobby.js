/* globals __DEV__ */
import Phaser from 'phaser'

export default class extends Phaser.Scene {
    constructor () {
        super({ key: 'LobbyScene' })
    }
    init ({sessionId}) {
        this.sessionId = sessionId;
        this.game.oahBackend.getWebsocket(sessionId).then((ws) => {
            this.ws = ws;
            console.log(this.ws);
            this.ws.sendJson({
                id: String(Math.ceil(Math.random()*Math.pow(10,16))),
                type: "subscribe",
                nick: "DisplayApp", // TODO: Set a nick somehow?
            });
        });
    }
    preload () {}

    create () {
        this.add.text(100, 100, 'Lobby ', {
            font: '32px Bangers',
            fill: '#7744ff'
        });
        this.add.text(100, 300, `Game ID: ${this.sessionId}`, {
            font: '32px Bangers',
            fill: '#7744ff'
        });
    }
}
