import React, { useEffect, useState, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

function LiveAssistant({ engines, mode, lang, speechEnabled, micActive, setMicActive }) {
  const { videoRef, bboxCanvasRef, captureCanvasRef, cameraModule, startCamera, stopCamera } = useCamera();
  const [description, setDescription] = useState('Press the microphone to speak, or it will analyze the scene periodically.');
  const [priorityAlert, setPriorityAlert] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const loopRef = useRef(null);

  const handleSpeechResult = async (text) => {
    if (!engines || !cameraModule) return;
    setIsProcessing(true);
    const frameBase64 = cameraModule.captureFrameBase64();
    if (!frameBase64) {
        setDescription('Camera not ready.');
        setIsProcessing(false);
        return;
    }

    try {
        let response = '';
        if (mode === 'vision' && engines.brain) {
            response = await engines.brain.processUserIntent(text, frameBase64, lang);
        } else if (mode === 'braille' && engines.braille) {
            // For Braille mode, we typically just process the frame to detect Braille.
            // But we can let speech override if needed.
            response = "Braille mode active. Point camera at braille text.";
        }
        
        setDescription(response);
        if (speechEnabled && engines.tts) {
            engines.tts.speak(response, false, lang);
        }
    } catch (err) {
        console.error(err);
        setDescription('Error analyzing scene.');
    } finally {
        setIsProcessing(false);
    }
  };

  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition({
      lang,
      onResult: handleSpeechResult
  });

  // Watch for mic toggle from Header
  useEffect(() => {
    if (micActive && !isListening) {
        startListening();
    } else if (!micActive && isListening) {
        stopListening();
    }
  }, [micActive, isListening, startListening, stopListening]);

  // Sync state back to Header if it stops listening automatically
  useEffect(() => {
    if (!isListening && micActive) {
        setMicActive(false);
    }
  }, [isListening]);

  // Start camera when mounted
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [cameraModule]);

  // Main background loop for braille mode or continuous vision scanning
  useEffect(() => {
    if (!engines || !cameraModule) return;

    const runLoop = async () => {
        if (isProcessing || isListening) return; // Don't interrupt speech

        if (mode === 'braille' && engines.braille) {
            setIsProcessing(true);
            const frameBase64 = cameraModule.captureFrameBase64();
            if (frameBase64) {
                const ctx = bboxCanvasRef.current?.getContext('2d');
                if (ctx && bboxCanvasRef.current) {
                    ctx.clearRect(0, 0, bboxCanvasRef.current.width, bboxCanvasRef.current.height);
                    const result = await engines.braille.translate(frameBase64, ctx);
                    if (result && result.text) {
                        setDescription(result.text);
                        if (speechEnabled && engines.tts) {
                            engines.tts.speak(result.text, false, lang);
                        }
                    }
                }
            }
            setIsProcessing(false);
        }
    };

    loopRef.current = setInterval(runLoop, 3000); // Check every 3 seconds

    return () => clearInterval(loopRef.current);
  }, [engines, cameraModule, mode, isProcessing, isListening, lang, speechEnabled]);

  return (
    <main id="main-camera-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
        <section className="camera-section glass-panel" style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '400px' }}>
            <div className="video-container" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                <canvas ref={bboxCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}></canvas>
                <canvas ref={captureCanvasRef} style={{ display: 'none' }}></canvas>
            </div>
        </section>

        <section className="info-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isListening && (
                <div id="voice-query-box" className="glass-panel" style={{ padding: '1.5rem', borderColor: 'var(--accent-color)', background: 'rgba(99, 102, 241, 0.1)' }}>
                    <div style={{ color: 'var(--accent-color)', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600 }}><i className="ph-fill ph-microphone"></i> You asked:</div>
                    <p id="voice-query-text" style={{ fontSize: '1.25rem', color: 'white' }}>{transcript || 'Listening...'}</p>
                </div>
            )}

            {priorityAlert && (
                <div id="priority-alert" className="alert-box glass-panel" style={{ borderColor: 'var(--danger-color)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    <i className="ph-fill ph-warning-circle" style={{ color: 'var(--danger-color)' }}></i>
                    <div className="alert-content">
                        <strong>Priority Alert</strong>
                        <p>{priorityAlert}</p>
                    </div>
                </div>
            )}

            <div className="description-box glass-panel" style={{ padding: '1.5rem' }}>
                <div className="box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}><i className="ph-fill ph-text-align-left"></i> Live Scene Description</h2>
                    {isProcessing && <div className="pulse-indicator" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-color)', animation: 'pulse 1.5s infinite' }}></div>}
                </div>
                <div className="description-content">
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.5 }}>{description}</p>
                </div>
            </div>
        </section>
    </main>
  );
}

export default LiveAssistant;
