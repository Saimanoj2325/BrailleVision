export default class TTSModule {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.enabled = true;
        this.isSpeaking = false;
        
        // Wait for voices to load
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                this.voices = this.synth.getVoices();
            };
        } else {
            this.voices = this.synth.getVoices();
        }

        // Audio Context for UI Beeps and Sonar guidance
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Play a short beep/tone
    playTone(frequency = 440, type = 'sine', duration = 0.1, volume = 0.1) {
        if (!this.enabled) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    // Semantic UI Sounds
    playSuccess() { this.playTone(880, 'sine', 0.15, 0.2); setTimeout(() => this.playTone(1760, 'sine', 0.2, 0.2), 150); }
    playError() { this.playTone(300, 'square', 0.3, 0.2); }
    playClick() { this.playTone(600, 'triangle', 0.05, 0.1); }
    playScanTick() { this.playTone(1200, 'sine', 0.05, 0.05); } // Subtle tick indicating active camera
    
    playBrailleTick(hz, pan) {
        // Advanced stereo panning to guide user left/right
        if (!this.enabled) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        
        osc.type = 'sine';
        osc.frequency.value = hz;
        panner.pan.value = pan; // -1 to 1

        gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);

        osc.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stop();
        }
        return this.enabled;
    }

    stop() {
        this.synth.cancel();
        this.isSpeaking = false;
    }

    speak(text, isPriority = false, langCode = 'eng_Latn') {
        if (!this.enabled) return;

        if (isPriority) {
            this.stop(); // Interrupt anything currently playing
        } else if (this.synth.speaking) {
             return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Map NLLB lang codes to BCP-47
        const langMap = {
            'eng_Latn': 'en',
            'spa_Latn': 'es',
            'fra_Latn': 'fr',
            'slv_Latn': 'sl',
            'hin_Deva': 'hi',
            'zho_Hans': 'zh',
            'jpn_Jpan': 'ja',
            'deu_Latn': 'de',
            'ara_Arab': 'ar',
            'kor_Hang': 'ko'
        };
        
        const bcp47 = langMap[langCode] || 'en';
        utterance.lang = bcp47;

        // Try to find a native voice for this language
        const targetVoices = this.voices.filter(v => v.lang.startsWith(bcp47));
        if (targetVoices.length > 0) {
            const preferred = targetVoices.find(v => v.name.includes('Google') || v.default);
            utterance.voice = preferred || targetVoices[0];
        }

        // Visually impaired users often consume audio faster; speed up the baseline and priority rates
        utterance.rate = isPriority ? 1.4 : 1.15; 
        utterance.pitch = isPriority ? 1.2 : 1.0; 
        utterance.volume = 1.0;

        utterance.onstart = () => { this.isSpeaking = true; };
        utterance.onend = () => { this.isSpeaking = false; };
        utterance.onerror = () => { this.isSpeaking = false; };

        this.synth.speak(utterance);
    }
}
