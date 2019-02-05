import Phaser from 'phaser'

import BootScene from './scenes/Boot'
import GameScene from './scenes/Game'
import LobbyScene from './scenes/Lobby'
import {Backend} from './Backend'

import config from './config'

const LOCALSTORAGE_KEY = "over-air-hockey-session";

// TODO:
// 1. Check if a game was ongoing in localstorage.
//   if so, boot in to that game.
//     if it fails, kick us back to step 2
// 2. Connect to the web app and create a "game".
// 3. Show a URL onscreen to allow users to join the game.
// 4. Once two (or more) players have joined and readied up, start the game.
// 5. Keep playing until a win condition is met, or let the players quit back to 1
// 6. Once someone has won, prompt on device to rematch or quit back to 1.I

const gameConfig = Object.assign(config, {
  scene: [BootScene, GameScene, LobbyScene]
})

class Game extends Phaser.Game {
  constructor () {
    super(gameConfig)
    window.game = this;
    this.oahBackend = new Backend(gameConfig.backendUrl);
    this.startSession().then((sessionId) => {
        console.log("Got session, starting:", sessionId);
        this.scene.start('LobbyScene', {sessionId});
        this.scene.stop("BootScene");
    }).catch((err) => {
        console.error("Failed to start:", err);
    });
  }

  async startSession() {
      let sessionId = localStorage.getItem(LOCALSTORAGE_KEY);
      if (sessionId) {
          // Session found, check where it's at.
          try {
              const state = await this.oahBackend.getSession(sessionId);
              if (state.state !== "finished")  {
                  return sessionId;
              }
          } catch (ex) {
              if (ex.status !== 404) { // Does 404 always mean the game wasn't found?
                  throw Error("Unexpected error:", ex);
              }
          }
      }
      localStorage.removeItem(LOCALSTORAGE_KEY);
      const game = await this.oahBackend.createSession();
      console.log("Created game:", game);
      localStorage.setItem(LOCALSTORAGE_KEY, game.id);
      sessionId = game.id;
      return sessionId;
  }
}

window.game = new Game()
