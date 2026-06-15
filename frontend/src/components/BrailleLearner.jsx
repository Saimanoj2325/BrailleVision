import React from 'react';

const brailleDictionary = [
    { char: 'A', dots: [1] }, { char: 'B', dots: [1, 2] },
    { char: 'C', dots: [1, 4] }, { char: 'D', dots: [1, 4, 5] },
    { char: 'E', dots: [1, 5] }, { char: 'F', dots: [1, 2, 4] },
    { char: 'G', dots: [1, 2, 4, 5] }, { char: 'H', dots: [1, 2, 5] },
    { char: 'I', dots: [2, 4] }, { char: 'J', dots: [2, 4, 5] },
    { char: 'K', dots: [1, 3] }, { char: 'L', dots: [1, 2, 3] },
    { char: 'M', dots: [1, 3, 4] }, { char: 'N', dots: [1, 3, 4, 5] },
    { char: 'O', dots: [1, 3, 5] }, { char: 'P', dots: [1, 2, 3, 4] },
    { char: 'Q', dots: [1, 2, 3, 4, 5] }, { char: 'R', dots: [1, 2, 3, 5] },
    { char: 'S', dots: [2, 3, 4] }, { char: 'T', dots: [2, 3, 4, 5] },
    { char: 'U', dots: [1, 3, 6] }, { char: 'V', dots: [1, 2, 3, 6] },
    { char: 'W', dots: [2, 4, 5, 6] }, { char: 'X', dots: [1, 3, 4, 6] },
    { char: 'Y', dots: [1, 3, 4, 5, 6] }, { char: 'Z', dots: [1, 3, 5, 6] }
];

function BrailleLearner({ engines, lang }) {
  const handleItemClick = (item) => {
    if (engines?.tts) {
        engines.tts.speak(`Letter ${item.char}. Dots ${item.dots.join(', ')}`, false, lang);
    }
    if ('vibrate' in navigator) {
        const pattern = [];
        for (let i = 0; i < item.dots.length; i++) {
            pattern.push(100);
            if (i < item.dots.length - 1) pattern.push(150);
        }
        navigator.vibrate(pattern);
    }
  };

  return (
    <main style={{ padding: '1rem', flex: 1 }}>
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', height: '100%', padding: '2rem' }}>
            <h2><i className="ph-fill ph-student"></i> Interactive Braille Dictionary</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Tap any character below. The application will speak the letter, enumerate the required dots, and provide haptic feedback.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
                {brailleDictionary.map((item) => (
                    <button 
                      key={item.char}
                      className="dict-item" 
                      style={{ 
                          padding: '1.25rem 0.5rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          background: 'var(--bg-color-alt, #2d3748)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                      }}
                      onClick={() => handleItemClick(item)}
                    >
                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{item.char}</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 6px)', gridTemplateRows: 'repeat(3, 6px)', gap: '4px' }}>
                            {[1, 4, 2, 5, 3, 6].map(dot => (
                                <div key={dot} style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: item.dots.includes(dot) ? 'var(--text-primary)' : 'rgba(255,255,255,0.1)'
                                }} />
                            ))}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </main>
  );
}

export default BrailleLearner;
