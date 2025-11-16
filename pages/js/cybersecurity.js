// Cybersecurity page JavaScript
// Wrapped in IIFE to avoid global scope pollution
(function() {
  'use strict';
  
  console.log('Cybersecurity page script initializing...');

  // Email Checker functionality
  const checkEmailBtn = document.getElementById('check-email');
  if (checkEmailBtn) {
    checkEmailBtn.addEventListener('click', async () => {
      const emailEl = document.getElementById('email-input');
      const resultEl = document.getElementById('email-result');
      if (!emailEl || !resultEl) return;

      const email = (emailEl.value || '').trim();
      if (!email) {
        resultEl.innerText = 'Please enter an email address';
        return;
      }

      // Simple client-side validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        resultEl.innerText = 'Please enter a valid email address';
        return;
      }

      resultEl.innerText = 'Checking email breaches...';

      // Ask the background/service worker to perform the HIBP request
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resultEl.innerText = 'Extension messaging unavailable';
        return;
      }

      try {
        chrome.runtime.sendMessage({ action: 'checkEmailBreaches', email }, (response) => {
          if (!response) {
            resultEl.innerText = 'No response from background';
            return;
          }

          if (response.status === 'ok') {
            const count = response.result?.breachCount ?? 0;
            if (count === 0) {
              resultEl.innerText = 'No breach found for this email.';
            } else {
              resultEl.innerText = `Breaches found: ${count}`;
            }
          } else if (response.status === 'manual') {
            // No API key configured
            resultEl.innerText = response.message || 'No HIBP API key configured. Please check manually at haveibeenpwned.com.';
          } else if (response.status === 'error') {
            // Provide helpful messages for common errors
            if (response.error === 'unauthorized' || response.statusCode === 401) {
              resultEl.innerText = 'Error: Invalid or unauthorized HIBP API key (401). Please check your extension settings.';
            } else if (response.error === 'rate_limited' || response.statusCode === 429) {
              resultEl.innerText = 'Error: HIBP rate limit reached. Try again later.';
            } else {
              resultEl.innerText = 'Error checking email: ' + (response.message || response.error || 'Unknown error');
            }
          } else {
            resultEl.innerText = 'Unexpected response from background';
          }
        });
      } catch (err) {
        console.error('Email check messaging failed', err);
        resultEl.innerText = 'Failed to send request to background: ' + (err?.message || String(err));
      }
    });
  }

  // Website Checker functionality
  const checkWebsiteBtn = document.getElementById('check-website');
  if (checkWebsiteBtn) {
    checkWebsiteBtn.addEventListener('click', async () => {
      const url = document.getElementById('website-url').value;
      if(!url) return alert('Please enter a URL');
      
      chrome.runtime.sendMessage({action:'scan-website', url}, (response) => {
        if(response && response.resultHtml && window.showModal) {
          window.showModal(response.resultHtml);
        }
      });
    });
  }

  // Ad Blocker functionality
  chrome.storage.sync.get(['adBlockerEnabled', 'adRules', 'blockingStats'], (result) => {
    const adToggle = document.getElementById('ad-blocker-toggle');
    const adRules = document.getElementById('ad-rules');
    
    if (adToggle) {
      adToggle.checked = result.adBlockerEnabled || false;
    }
    if (adRules) {
      adRules.value = result.adRules || '';
    }
    
    updateStats(result.blockingStats || {ads: 0});
    updateStatus();
  });

  const adBlockerToggle = document.getElementById('ad-blocker-toggle');
  if (adBlockerToggle) {
    adBlockerToggle.addEventListener('change', (e) => {
      chrome.storage.sync.set({adBlockerEnabled: e.target.checked});
      updateStatus();
    });
  }

  const saveAdRulesBtn = document.getElementById('save-ad-rules');
  if (saveAdRulesBtn) {
    saveAdRulesBtn.addEventListener('click', () => {
      const rules = document.getElementById('ad-rules').value;
      chrome.storage.sync.set({adRules: rules});
      alert('Ad blocking rules saved!');
    });
  }

  const copyFiltersBtn = document.getElementById('copy-filters-btn');
  if (copyFiltersBtn) {
    copyFiltersBtn.addEventListener('click', () => {
      const filtersText = document.getElementById('ublock-filters').value;
      navigator.clipboard.writeText(filtersText).then(() => {
        const btn = document.getElementById('copy-filters-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    });
  }

  const resetStatsBtn = document.getElementById('reset-stats');
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      chrome.storage.sync.set({blockingStats: {ads: 0}});
      updateStats({ads: 0});
    });
  }

  function updateStatus() {
    const adEnabled = document.getElementById('ad-blocker-toggle')?.checked;
    const statusEl = document.getElementById('ad-status');
    if (statusEl) {
      statusEl.textContent = adEnabled ? 'Enabled' : 'Disabled';
    }
  }

  function updateStats(stats) {
    const adCountEl = document.getElementById('ad-count');
    if (adCountEl) {
      adCountEl.textContent = stats.ads || 0;
    }
  }

  // Favorites functionality
  document.querySelectorAll('.favorite-star').forEach(star => {
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const toolId = star.dataset.tool;
      console.log('Star clicked:', toolId);
      
      chrome.storage.sync.get(['favorites'], (result) => {
        let favorites = result.favorites || [];
        
        if (favorites.includes(toolId)) {
          // Remove from favorites
          favorites = favorites.filter(id => id !== toolId);
          star.classList.remove('active');
          console.log('Removed from favorites:', toolId);
        } else {
          // Add to favorites
          favorites.push(toolId);
          star.classList.add('active');
          console.log('Added to favorites:', toolId);
        }
        
        chrome.storage.sync.set({favorites: favorites}, () => {
          console.log('Favorites updated:', favorites);
        });
      });
    });
  });

  // Load favorite states
  chrome.storage.sync.get(['favorites'], (result) => {
    const favorites = result.favorites || [];
    console.log('Loading favorites:', favorites);
    favorites.forEach(toolId => {
      const star = document.querySelector(`.favorite-star[data-tool="${toolId}"]`);
      if (star) {
        star.classList.add('active');
      }
    });
  });

  // Listen for storage changes to update favorites in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.favorites) {
      const favorites = changes.favorites.newValue || [];
      console.log('Favorites changed:', favorites);
      document.querySelectorAll('.favorite-star').forEach(star => {
        const toolId = star.dataset.tool;
        if (favorites.includes(toolId)) {
          star.classList.add('active');
        } else {
          star.classList.remove('active');
        }
      });
    }
  });

  console.log('Cybersecurity page script loaded');
})();
