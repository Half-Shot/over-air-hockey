let powerLock = false;

window.addEventListener("devicemotion", e => {
  if (powerLock) {
      return;
  }
  console.log("Acceleration along the X-axis " + e.acceleration.x);
  console.log("Acceleration along the Y-axis " + e.acceleration.y);
  let power = Math.abs(e.acceleration.x) + Math.abs(e.acceleration.y);
  if (e.acceleration.x) {
      document.querySelector("#data").innerHTML = JSON.stringify({
          x: e.acceleration.x,
          y: e.acceleration.y,
          z: e.acceleration.z,
      });
  }
  if (power > 15) {
    powerLock = true;
    setTimeout(() => powerLock = false, 150);
    let element = document.querySelector(".mypp");
    document.querySelector(".mypp").innerHTML = `x = ${e.acceleration.x}</br>y = ${e.acceleration.y}`
    const dir = calculateDirectionOfMotion(e.acceleration);
    //if (e.acceleration.x > 5)
    document.querySelector("#direction").innerHTML = JSON.stringify(dir);
    document.body.style.setProperty("background-color", "red");
  }
}, true);

function calculateDirectionOfMotion(accel) {
    const THRESHOLD = 6;
    const MAX_POWER = 40;
    const dir = {
        left: 0,
        right: 0,
        forward: 0,
    };

    if (accel.x > THRESHOLD) {
        dir.left = (accel.x / MAX_POWER) * 100;
    }
    if (accel.x < THRESHOLD) {
        dir.right = (Math.abs(accel.x) / MAX_POWER) * 100;
    }
    dir.forward = (Math.abs(accel.y) / MAX_POWER) * 100;

    dir.left = Math.min(dir.left, 100);
    dir.right = Math.min(dir.right, 100);
    dir.forward = Math.min(dir.forward, 100);

    return dir;
}
