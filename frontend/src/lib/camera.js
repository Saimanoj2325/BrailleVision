export default class CameraModule {
    constructor(videoElementId, canvasElementId) {
        this.video = document.getElementById(videoElementId);
        this.canvas = document.getElementById(canvasElementId);
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.isActive = false;
        
        // Target internal processing resolution, keeps base64 string smaller
        this.targetWidth = 512;
        this.targetHeight = 512;
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Prefer back camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    advanced: [{ focusMode: "continuous" }] // Optimize for scanning on mobile
                },
                audio: false
            });
            
            this.video.srcObject = this.stream;
            this.isActive = true;
            
            // Wait for video to actually start to get dimensions
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    
                    // Setup canvas taking aspect ratio into account
                    const aspect = this.video.videoWidth / this.video.videoHeight;
                    if (aspect > 1) {
                        this.canvas.width = this.targetWidth;
                        this.canvas.height = this.targetWidth / aspect;
                    } else {
                        this.canvas.height = this.targetHeight;
                        this.canvas.width = this.targetHeight * aspect;
                    }
                    
                    resolve(true);
                };
            });
            
        } catch (err) {
            console.error("Error accessing camera:", err);
            throw err;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
            this.isActive = false;
        }
    }

    captureFrameBase64() {
        if (!this.isActive || !this.video.videoWidth) return null;

        // Draw current video frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Return base64 jpeg at 70% quality to save bandwidth
        return this.canvas.toDataURL('image/jpeg', 0.7);
    }

    analyzeFrameQuality() {
        if (!this.isActive || !this.video.videoWidth) return null;
        
        // Draw frame to internal canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let totalLuminance = 0;
        let pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += luminance;
        }
        const avgLuminance = totalLuminance / pixelCount;

        // Fast Variance of Laplacian for blur detection
        let laplacianSum = 0;
        let laplacianSqSum = 0;
        let lapCount = 0;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const step = 2; // Sample for performance

        for (let y = 1; y < h - 1; y += step) {
            for (let x = 1; x < w - 1; x += step) {
                // We use Green channel as a lightweight luminance proxy for edges
                const idx = (y * w + x) * 4 + 1; 
                const top = ((y - 1) * w + x) * 4 + 1;
                const bottom = ((y + 1) * w + x) * 4 + 1;
                const left = (y * w + (x - 1)) * 4 + 1;
                const right = (y * w + (x + 1)) * 4 + 1;
                
                const centerVal = data[idx];
                const lap = (data[top] + data[bottom] + data[left] + data[right]) - 4 * centerVal;
                
                laplacianSum += lap;
                laplacianSqSum += (lap * lap);
                lapCount++;
            }
        }
        
        const mean = laplacianSum / lapCount;
        const variance = (laplacianSqSum / lapCount) - (mean * mean);
        
        return {
            isBlurry: variance < 150, // Threshold approximation
            isTooDark: avgLuminance < 40,
            metrics: { variance, avgLuminance }
        };
    }
}
