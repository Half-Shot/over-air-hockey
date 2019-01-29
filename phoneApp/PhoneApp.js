window.addEventListener("devicemotion", e => {
  console.log("Acceleration along the X-axis " + e.acceleration.x);
  console.log("Acceleration along the Y-axis " + e.acceleration.y);
  let power = Math.abs(e.acceleration.x) + Math.abs(e.acceleration.y);

  if (power > 5) {
    let element = document.querySelector(".mypp");
    element.innerHTML = `x = ${e.acceleration.x}</br>y = ${e.acceleration.y}`
    document.body.style.setProperty("background-color", "red");
  }
}, true);
