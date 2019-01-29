let accelerometer = new Accelerometer({frequency: 60});

accelerometer.addEventListener('reading', e => {
  console.log("Acceleration along the X-axis " + accelerometer.x);
  console.log("Acceleration along the Y-axis " + accelerometer.y);
  console.log("Acceleration along the Z-axis " + accelerometer.z);
});
accelerometer.start();
