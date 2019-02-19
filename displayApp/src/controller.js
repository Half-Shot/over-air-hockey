const MINPOWERTOACTIVATE = 15;

const THRESHOLD = 6;
const MAX_POWER = 40;
const TIMEOUT = 333;

export default class Controller {

    constructor(onMotion) {
        this.powerLock = false;
        this.onMotion = onMotion;
    }

    startCapture() {
        try {
            window.addEventListener("devicemotion", this.listenForMotion.bind(this));
        } catch (ex) {
            alert(ex);
        }
    }

    listenForMotion(e) {
        const debugData = Object.assign({
            time: Date.now(),
        }, e);

        if (this.powerLock) {
          return;
        }
        const power = Math.abs(e.acceleration.x) + Math.abs(e.acceleration.y);
        debugData.power = power;
        if (power > MINPOWERTOACTIVATE) {
            this.powerLock = true;
            setTimeout(() => this.powerLock = false, TIMEOUT);
            const dir = this._calculateDirectionOfMotion(e.acceleration);
            if (this.onMotion) {
                this.onMotion(dir);
            }
        }
        document.querySelector("#debugInfo").innerHTML = JSON.stringify(debugData);
    }

    _calculateDirectionOfMotion(accel) {
        const dir = {
            left: 0,
            right: 0,
            forward: 0,
        };

        if (accel.x > THRESHOLD) {
            dir.left = (accel.x / MAX_POWER) * 150;
        }
        if (accel.x < THRESHOLD) {
            dir.right = (Math.abs(accel.x) / MAX_POWER) * 150;
        }
        dir.forward = (Math.abs(accel.y) / MAX_POWER) * 150;

        dir.left = Math.min(dir.left, 100);
        dir.right = Math.min(dir.right, 100);
        dir.forward = Math.min(dir.forward, 100);

        return dir;
    }
}
