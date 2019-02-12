const MINPOWERTOACTIVATE = 15;

const THRESHOLD = 6;
const MAX_POWER = 40;

export class Controller {

    constructor(onMotion) {
        this.powerLock = false;
        this.onMotion = onMotion;
    }

    startCapture() {
        window.addEventListener("devicemotion", listenForMotion);
    }

    listenForMotion() {
        if (powerLock) {
          return;
        }
        const power = Math.abs(e.acceleration.x) + Math.abs(e.acceleration.y);

        if (power > MINPOWERTOACTIVATE) {
            powerLock = true;
            setTimeout(() => powerLock = false, 150);
            let element = document.querySelector(".mypp");
            const dir = calculateDirectionOfMotion(e.acceleration);
            if (this.onMotion) {
                this.onMotion(dir);
            }
        }
    }

    _calculateDirectionOfMotion(accel) {
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
}
