// Settings page JavaScript
// Wrapped in IIFE to avoid re-declaration errors
(function() {
  'use strict';
  
  console.log('Settings page script initializing...');

  // Attach helpers directly to window immediately so they're always available
  try {
    window.hexToRgb = function(hex) {
      if (!hex) return null;
      const m = hex.replace('#','');
      if (m.length !== 6) return null;
      const r = parseInt(m.substring(0,2),16);
      const g = parseInt(m.substring(2,4),16);
      const b = parseInt(m.substring(4,6),16);
      return {r,g,b};
    };

    window.componentToHex = function(c) {
      const h = Math.max(0, Math.min(255, Number(c))).toString(16);
      return h.length == 1 ? '0' + h : h;
    };

    window.rgbToHex = function(r,g,b) {
      return '#' + window.componentToHex(r) + window.componentToHex(g) + window.componentToHex(b);
    };
  } catch (e) {
    // ignore in restrictive contexts
  }

  console.log('[AEGIS] settings.js helpers attached to window', {hexToRgb: typeof window.hexToRgb, rgbToHex: typeof window.rgbToHex});

  // Safe wrappers that call the window-attached helpers
  function safeHexToRgb(hex) {
    try { return (window && typeof window.hexToRgb === 'function') ? window.hexToRgb(hex) : null; } catch(e) { return null; }
  }

  function safeRgbToHex(r,g,b) {
    try { return (window && typeof window.rgbToHex === 'function') ? window.rgbToHex(r,g,b) : null; } catch(e) { return null; }
  }

  // Preset to hex map (trim/accents)
  const presetMap = {
    purple: '#7b4bff',
    blue: '#3b82f6',
    green: '#10b981',
    red: '#ef4444'
  };

  const picker = document.getElementById('color-picker');
  const preview = document.getElementById('color-preview');
  const applyBtn = document.getElementById('apply-color-btn');

  // Load saved values (backgroundColor and trim). Fall back to legacy colorScheme.
  chrome.storage.sync.get(['backgroundColor','trim','colorScheme'], (result) => {
    let bg = result.backgroundColor || null;
    let trim = result.trim || null;
    const legacy = result.colorScheme;
    if (!bg && typeof legacy === 'string' && legacy.startsWith('#')) {
      bg = legacy;
    }
    if (!trim && typeof legacy === 'string' && !legacy.startsWith('#')) {
      trim = legacy;
    }

    if (bg && picker) picker.value = bg;
    if (preview) preview.style.background = bg || 'transparent';

    if (trim) {
      const radio = document.querySelector(`input[name="color-scheme"][value="${trim}"]`);
      if (radio) radio.checked = true;
    }

    // Apply immediately using the new combined API
    if (window.applyColorScheme) window.applyColorScheme({background: bg, trim: trim});
  });

  // Picker -> update preview
  if (picker) picker.addEventListener('input', (e) => {
    const hex = e.target.value;
    if (preview) preview.style.background = hex;
  });

  // Apply button: save backgroundColor to storage and apply
  if (applyBtn) applyBtn.addEventListener('click', () => {
    const hex = (picker && picker.value) ? picker.value : null;
    if (!hex) return;
    chrome.storage.sync.set({backgroundColor: hex});
    if (window.applyColorScheme) window.applyColorScheme({background: hex});
  });

  // Preset radios: set trim (accent) and apply
  document.querySelectorAll('input[name="color-scheme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const scheme = e.target.value;
      chrome.storage.sync.set({trim: scheme});
      if (window.applyColorScheme) window.applyColorScheme({trim: scheme});
    });
  });

  // Reset settings handler
  const resetBtn = document.getElementById('reset-settings-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      console.log('Reset settings clicked');
      showResetConfirmation();
    });
  }

  function showResetConfirmation() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Reset All Settings</h3>
        <p>Are you sure you want to reset all settings? This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn" id="confirm-reset" style="background: #f87171;">Reset</button>
          <button class="btn" id="cancel-reset" style="background: #6b7280;">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('confirm-reset').addEventListener('click', () => {
      console.log('Confirming reset');
      chrome.storage.sync.clear();
      location.reload();
    });
    
    document.getElementById('cancel-reset').addEventListener('click', () => {
      console.log('Cancelling reset');
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }

      // (no custom hex picker helpers needed when using preset radios)
    });
  }

  console.log('Settings page script loaded');


})();
