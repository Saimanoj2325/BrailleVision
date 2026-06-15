import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import LiveAssistant from './components/LiveAssistant';
import BrailleLearner from './components/BrailleLearner';
import BrainModule from './lib/webgpu_vlm';
import BrailleTFJS from './lib/braille';
import TTSModule from './lib/tts';

function App() {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'learn'
  const [mode, setMode] = useState('vision'); // 'vision' or 'braille'
  const [lang, setLang] = useState('eng_Latn');
  const [status, setStatus] = useState({ text: 'Initializing...', connected: false });
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const [appStarted, setAppStarted] = useState(false);

  const enginesRef = useRef({
    brain: null,
    braille: null,
    tts: null,
  });

  useEffect(() => {
    let isMounted = true;
    const initEngines = async () => {
      const handleStatusChange = (msg) => {
        if (isMounted) setStatus({ text: msg, connected: false });
      };

      try {
        const tts = new TTSModule();
        const brain = new BrainModule(handleStatusChange);
        const braille = new BrailleTFJS(handleStatusChange);

        const vSuccess = await brain.init();
        const bSuccess = await braille.init();

        if (isMounted && vSuccess && bSuccess) {
          setStatus({ text: 'Models Ready', connected: true });
          enginesRef.current = { brain, braille, tts };
        } else if (isMounted) {
          setStatus({ text: 'Error loading models', connected: false });
        }
      } catch (err) {
        console.error("Init Error:", err);
        if (isMounted) setStatus({ text: 'Error loading models', connected: false });
      }
    };

    initEngines();

    return () => { isMounted = false; };
  }, []);

  const handleMasterStart = () => {
    setAppStarted(true);
    if (enginesRef.current.tts) {
      enginesRef.current.tts.speak("System active. What would you like to explore?", false, lang);
    }
  };

  return (
    <div className="app-container">
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mode={mode} 
        setMode={setMode}
        lang={lang}
        setLang={setLang}
        status={status}
        speechEnabled={speechEnabled}
        setSpeechEnabled={setSpeechEnabled}
        micActive={micActive}
        setMicActive={setMicActive}
      />

      {!appStarted ? (
        <div className="glass-panel" style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', background: 'var(--bg-color)' }}>
          <h2>Vision Assistant</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px' }}>
              This app requires Camera, Microphone, and Motion sensor access to provide conversational guidance.
          </p>
          <button 
            className="primary-btn" 
            style={{ fontSize: '1.5rem', padding: '1.5rem 3rem' }}
            onClick={handleMasterStart}
            disabled={!status.connected}
          >
            {status.connected ? <><i className="ph-fill ph-power"></i> Tap to Start</> : <><i className="ph-fill ph-spinner ph-spin"></i> Loading AI...</>}
          </button>
          <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '1rem', textAlign: 'center', maxWidth: '80%', lineHeight: 1.4, minHeight: '3rem' }}>
            {status.text}
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'camera' && (
            <LiveAssistant 
              engines={enginesRef.current} 
              mode={mode} 
              lang={lang}
              speechEnabled={speechEnabled}
              micActive={micActive}
              setMicActive={setMicActive}
            />
          )}
          {activeTab === 'learn' && (
            <BrailleLearner 
              engines={enginesRef.current} 
              lang={lang} 
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
