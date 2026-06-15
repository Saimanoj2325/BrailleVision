export default class SensorModule {
    constructor() {
        this.beta = 0; // Front-to-back tilt [-180, 180]
        this.gamma = 0; // Left-to-right tilt [-90, 90]
        this.alpha = 0; // Compass direction [0, 360]
        this.isSupported = false;
        
        this._handleOrientation = this._handleOrientation.bind(this);
    }
    
    async requestPermission() {
        // iOS 13+ requires explicit permission for DeviceOrientationEvent
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    this.startListening();
                    return true;
                } else {
                    console.warn("Device orientation permission denied");
                    return false;
                }
            } catch (err) {
                console.error("Error requesting device orientation permission", err);
                return false;
            }
        } else {
            // Non-iOS 13+ devices
            this.startListening();
            return true;
        }
    }

    startListening() {
        if ('DeviceOrientationEvent' in window) {
            window.addEventListener('deviceorientation', this._handleOrientation);
            this.isSupported = true;
        }
    }

    stopListening() {
        window.removeEventListener('deviceorientation', this._handleOrientation);
    }

    _handleOrientation(event) {
        this.beta = event.beta;
        this.gamma = event.gamma;
        this.alpha = event.alpha;
    }

    getOrientationGuidance() {
        if (!this.isSupported) return "";
        
        let guidance = "";
        
        // Check left-to-right tilt (should be near 0 for level camera)
        if (this.gamma > 15) {
            guidance += "tilt the phone slightly left, ";
        } else if (this.gamma < -15) {
            guidance += "tilt the phone slightly right, ";
        }
        
        // Define what "upright" means vs "flat"
        // Assuming scanning a table (beta ~ 0) or scanning a wall (beta ~ 90)
        // If it's awkwardly between 20 and 60, it might be heavily angled to the surface
        if (this.beta > 20 && this.beta < 60) {
            guidance += "and hold the phone parallel to the surface you are trying to read.";
        }
        
        if (guidance) {
            return "Please " + guidance;
        }
        
        return "Orientation looks good.";
    }
}

