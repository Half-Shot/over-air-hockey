import Phaser from 'phaser'

export default {
  type: Phaser.AUTO,
  parent: 'content',
  width: 800,
  height: 600,
  localStorageName: 'over-air-hockey',
  // Later: https://hockey.webres.me
  backendUrl: "http://localhost:3002",
}
