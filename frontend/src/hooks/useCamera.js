import { useEffect, useRef, useState } from 'react';
import CameraModule from '../lib/camera';

export function useCamera() {
  const videoRef = useRef(null);
  const bboxCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const [cameraModule, setCameraModule] = useState(null);

  useEffect(() => {
    // Assign IDs dynamically so CameraModule can find them if needed, 
    // or we can modify CameraModule to accept elements directly.
    // Since CameraModule uses document.getElementById, we must ensure IDs exist.
    if (videoRef.current && captureCanvasRef.current && bboxCanvasRef.current) {
        videoRef.current.id = 'webcam';
        captureCanvasRef.current.id = 'capture-canvas';
        bboxCanvasRef.current.id = 'bbox-overlay';

        const cam = new CameraModule('webcam', 'capture-canvas');
        setCameraModule(cam);

        return () => {
            cam.stop();
        };
    }
  }, []);

  const startCamera = async () => {
    if (cameraModule) {
        await cameraModule.start();
    }
  };

  const stopCamera = () => {
    if (cameraModule) {
        cameraModule.stop();
    }
  };

  return {
    videoRef,
    bboxCanvasRef,
    captureCanvasRef,
    cameraModule,
    startCamera,
    stopCamera
  };
}
