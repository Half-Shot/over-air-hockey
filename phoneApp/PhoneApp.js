let accelerometer = new Accelerometer({frequency: 60});

accelerometer.addEventListener('reading', e => {
  console.log("Acceleration along the X-axis " + accelerometer.x);
  console.log("Acceleration along the Y-axis " + accelerometer.y);
  let power = Math.abs(accelerometer.x) + Math.abs(accelerometer.y);

  if (power > 5) {
    document.body.style.setProperty("background-color", "red");
  }
});
accelerometer.start();
