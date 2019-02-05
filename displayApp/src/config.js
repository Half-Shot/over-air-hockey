import Phaser from 'phaser'

const config = {
  type: Phaser.AUTO,
  parent: 'content',
  width: window.innerWidth,
  height: window.innerHeight,
  localStorageName: 'over-air-hockey',
  // Later: https://hockey.webres.me
  backendUrl: "https://webres.me/api",
  wsUrl: "wss://webres.me/ws",
  joinUrl: "https://webres.me/client.html",
  scaleX: (window.innerWidth * window.devicePixelRatio) / 1920,
  scaleY: (window.innerHeight * window.devicePixelRatio) / 1080,
  backgroundColor: "#FFFFFF",
}
export default config;
console.log(`Scaled to: ${config.scaleX} ${config.scaleY}`);
