import Phaser from 'phaser'
import WebFont from 'webfontloader'

export default class extends Phaser.Scene {
  constructor () {
    super({ key: 'BootScene' })
  }

  preload () {
    this.ready = false
    this.fontsLoaded = this.fontsLoaded.bind(this)
    this.add.text(100, 100, 'loading fonts...')

    this.load.image('loaderBg', './assets/images/loader-bg.png')
    this.load.image('loaderBar', './assets/images/loader-bar.png')

    WebFont.load({
      google: {
        families: ['Sarabun']
      },
      fontactive: this.fontsLoaded,
    });
  }

  update () {

  }

  fontsLoaded () {
    console.log("Fonts loaded");
    this.ready = true;
    this.game.loaded();
  }
}
