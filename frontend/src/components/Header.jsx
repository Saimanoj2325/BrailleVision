import React from 'react';

function Header({ 
  activeTab, 
  setActiveTab, 
  mode, 
  setMode, 
  lang, 
  setLang, 
  status, 
  speechEnabled, 
  setSpeechEnabled,
  micActive,
  setMicActive
}) {
  return (
    <header className="glass-panel">
      <div className="brand">
        <i className="ph-fill ph-eye"></i>
        <h1>Vision Assistant</h1>
      </div>
      
      <div className="app-tabs" style={{ display: 'flex', gap: '1rem', margin: '0 1rem', flex: 1, justifyContent: 'center' }}>
        <button 
          className={`primary-btn tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
          style={{ flex: 1, maxWidth: '200px', fontSize: '1.1rem', padding: '0.8rem', ...(activeTab !== 'camera' && { background: 'var(--bg-color-alt, #2d3748)', border: '2px solid var(--accent-color)', color: 'var(--text-primary)' }) }}
          onClick={() => setActiveTab('camera')}
        >
          <i className="ph-fill ph-camera"></i> Live Assistant
        </button>
        <button 
          className={`primary-btn tab-btn ${activeTab === 'learn' ? 'active' : ''}`}
          style={{ flex: 1, maxWidth: '200px', fontSize: '1.1rem', padding: '0.8rem', ...(activeTab !== 'learn' && { background: 'var(--bg-color-alt, #2d3748)', border: '2px solid var(--accent-color)', color: 'var(--text-primary)' }) }}
          onClick={() => setActiveTab('learn')}
        >
          <i className="ph-fill ph-student"></i> Braille Learner
        </button>
      </div>

      <div className="controls">
        <select 
          className="glass-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="eng_Latn">English</option>
          <option value="spa_Latn">Spanish</option>
          <option value="fra_Latn">French</option>
          <option value="slv_Latn">Slovenian</option>
          <option value="hin_Deva">Hindi</option>
          <option value="zho_Hans">Chinese Simplified</option>
          <option value="jpn_Jpan">Japanese</option>
          <option value="deu_Latn">German</option>
          <option value="ara_Arab">Arabic</option>
          <option value="kor_Hang">Korean</option>
        </select>

        <div className="mode-toggle">
          <button 
            className={`mode-btn ${mode === 'vision' ? 'active' : ''}`} 
            aria-label="Vision Description Environment Mode"
            onClick={() => setMode('vision')}
          >
            <i className="ph-fill ph-image"></i>
          </button>
          <button 
            className={`mode-btn ${mode === 'braille' ? 'active' : ''}`} 
            aria-label="Braille Translation Mode"
            onClick={() => setMode('braille')}
          >
            <i className="ph-fill ph-translate"></i>
          </button>
        </div>

        <div className="status-indicator">
          <span className={`dot ${status.connected ? 'connected' : 'disconnected'}`}></span>
          <span className="text">{status.text}</span>
        </div>
        
        <button 
          className={`icon-toggle ${speechEnabled ? 'active' : ''}`} 
          aria-label="Toggle Voice Output"
          onClick={() => setSpeechEnabled(!speechEnabled)}
        >
          <i className={speechEnabled ? "ph-fill ph-speaker-high" : "ph-fill ph-speaker-none"}></i>
        </button>
        <button 
          className={`icon-toggle ${micActive ? 'active' : ''}`} 
          aria-label="Toggle Microphone Input"
          onClick={() => setMicActive(!micActive)}
        >
          <i className={micActive ? "ph-fill ph-microphone" : "ph-fill ph-microphone-slash"}></i>
        </button>
      </div>
    </header>
  );
}

export default Header;
