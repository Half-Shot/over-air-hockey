import Phaser from 'phaser'

const config = {
  type: Phaser.AUTO,
  parent: 'content',
  width: window.innerWidth,
  height: window.innerHeight,
  localStorageName: 'over-air-hockey',
  // Later: https://hockey.webres.me
  backendUrl: "http://192.168.0.15:3002",
  joinUrl: "http://192.168.0.15:3000/client.html",
  scaleX: (window.innerWidth * window.devicePixelRatio) / 1920,
  scaleY: (window.innerHeight * window.devicePixelRatio) / 1080,
  backgroundColor: "#FFFFFF",
}
export default config;
console.log(`Scaled to: ${config.scaleX} ${config.scaleY}`)
