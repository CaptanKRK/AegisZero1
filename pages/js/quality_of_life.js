// Quality of Life page JavaScript
// Wrapped in IIFE to avoid global scope pollution
(function() {
  'use strict';
  
  console.log('Quality of Life page script initializing...');

  // ToS Scanner functionality
  function updateToSUI(analysis) {
    console.log('QualityOfLife: updateToSUI called with analysis:', analysis);
    
    const status = document.getElementById('tos-status');
    const analysisDiv = document.getElementById('tos-analysis');
    const riskLevel = analysisDiv.querySelector('.risk-level');
    const details = analysisDiv.querySelector('pre');

    if (!analysis) {
      status.textContent = 'No ToS detected on current page';
      analysisDiv.style.display = 'none';
      return;
    }

    // Calculate risk level based on score
    let riskLevelText = 'Low';
    if (analysis.riskScore >= 70) riskLevelText = 'High';
    else if (analysis.riskScore >= 40) riskLevelText = 'Medium';

    status.textContent = `ToS Analysis Complete - ${riskLevelText} Risk`;
    analysisDiv.style.display = 'block';
    
    // Update risk meter
    riskLevel.style.width = `${analysis.riskScore}%`;
    riskLevel.style.backgroundColor = analysis.riskScore >= 70 ? '#ff4b4b' : 
                                    analysis.riskScore >= 40 ? '#ffbb4b' : 
                                    '#4bff7b';
    
    // Update details with categorized summary
    let summary = '';
    if (analysis.categories) {
      const categoryNames = {
        dataPrivacy: 'Data Privacy Risks',
        unfairObligations: 'Unfair Obligations',
        securityConcerns: 'Security Concerns',
        suspiciousLanguage: 'Suspicious Language'
      };

      for (const [category, flags] of Object.entries(analysis.categories)) {
        if (flags.length > 0) {
          summary += `\n${categoryNames[category]}:\n`;
          flags.forEach(flag => {
            summary += `- ${flag.description} (Risk: ${flag.risk}/10)\n`;
          });
        }
      }
    }

    details.textContent = summary || 'No specific issues detected';
  }
  
  // Handle showing analysis results in a modal
  window.showModal = function(html) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 5px 10px;
    `;
    closeBtn.onclick = () => modal.remove();

    content.innerHTML = html;
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  };

  // Get current tab's ToS analysis if available
  function checkCurrentTabAnalysis() {
    console.log('QualityOfLife: checking current tab analysis');
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs || !tabs[0]) {
        console.warn('QualityOfLife: no active tab found');
        return;
      }
      const currentTab = tabs[0];
      chrome.storage.local.get(['tosAnalysis', 'tosAnalysisUrl', 'tosAnalysisTimestamp'], (result) => {
        console.log('QualityOfLife: got stored analysis', result);
        if (result.tosAnalysis && result.tosAnalysisUrl === currentTab.url) {
          console.log('QualityOfLife: found matching analysis for current URL');
          updateToSUI(result.tosAnalysis);
        } else {
          console.log('QualityOfLife: no matching analysis found');
          updateToSUI(null);
        }
      });
    });
  }

  // Initial check
  checkCurrentTabAnalysis();

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(checkCurrentTabAnalysis);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) checkCurrentTabAnalysis();
  });

  // Listen for changes to stored ToS analysis and update UI in real-time
  chrome.storage.onChanged.addListener((changes, area) => {
    console.log('QualityOfLife: storage changed', changes);
    if (area === 'local' && changes.tosAnalysis) {
      checkCurrentTabAnalysis();
    }
  });

  // Also listen for runtime messages from content scripts for immediate updates
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      console.log('QualityOfLife: got message', msg);
      if (msg && msg.action === 'tos-analysis-updated' && msg.analysis) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs && tabs[0] && (!msg.url || msg.url === tabs[0].url)) {
            console.log('QualityOfLife: updating UI from message');
            updateToSUI(msg.analysis);
          }
        });
      }
    } catch (e) {
      console.warn('quality_of_life: error handling runtime message', e);
    }
  });

  // Popup Blocker functionality
  chrome.storage.sync.get(['popupBlockerEnabled', 'blockingStats'], (result) => {
    const popupToggle = document.getElementById('popup-blocker-toggle');
    
    if (popupToggle) {
      popupToggle.checked = result.popupBlockerEnabled || false;
    }
    updatePopupStats(result.blockingStats || {popups: 0});
    updatePopupStatus();
  });

  const popupBlockerToggle = document.getElementById('popup-blocker-toggle');
  if (popupBlockerToggle) {
    popupBlockerToggle.addEventListener('change', (e) => {
      chrome.storage.sync.set({popupBlockerEnabled: e.target.checked});
      updatePopupStatus();
    });
  }

  const resetPopupStatsBtn = document.getElementById('reset-popup-stats');
  if (resetPopupStatsBtn) {
    resetPopupStatsBtn.addEventListener('click', () => {
      chrome.storage.sync.set({blockingStats: {popups: 0}});
      updatePopupStats({popups: 0});
    });
  }

  function updatePopupStatus() {
    const popupEnabled = document.getElementById('popup-blocker-toggle')?.checked;
    const statusEl = document.getElementById('popup-status');
    if (statusEl) {
      statusEl.textContent = popupEnabled ? 'Enabled' : 'Disabled';
    }
  }

  function updatePopupStats(stats) {
    const popupCountEl = document.getElementById('popup-count');
    if (popupCountEl) {
      popupCountEl.textContent = stats.popups || 0;
    }
  }

  // eBay Checker functionality
  const analyzeEbayBtn = document.getElementById('analyze-ebay');
  if (analyzeEbayBtn) {
    analyzeEbayBtn.addEventListener('click', async ()=>{
      chrome.tabs.query({active:true,currentWindow:true}, (tabs)=>{
        chrome.tabs.sendMessage(tabs[0].id, {action:'extract-ebay'}, (res)=>{
          if(res && res.html && window.showModal) {
            window.showModal(res.html);
          }
        });
      });
    });
  }

  // TOS Scanner functionality
  const scanTosBtn = document.getElementById('scan-tos');
  if (scanTosBtn) {
    scanTosBtn.addEventListener('click', async () => {
      const url = document.getElementById('tos-url').value;
      console.log('QualityOfLife: scanTos clicked, url=', url);
      
      // Update button state
      scanTosBtn.disabled = true;
      scanTosBtn.textContent = 'Scanning...';
      
      const handleError = (error) => {
        console.error('QualityOfLife: scan error', error);
        scanTosBtn.disabled = false;
        scanTosBtn.textContent = 'Scan ToS';
        if (window.showModal) {
          window.showModal(`
            <div style="color:#e53e3e;padding:20px;text-align:center">
              <h3 style="margin:0 0 10px 0">Scan Failed</h3>
              <p style="margin:0">${error.message || 'Failed to analyze Terms of Service'}</p>
            </div>
          `);
        }
      };

      // Set a shorter timeout for the initial response
      let initialTimeoutId = setTimeout(() => {
        handleError(new Error('No response from scanner. Please try again.'));
      }, 5000); // 5 second timeout for initial response
      
      // Set a longer timeout for the complete analysis
      let analysisTimeoutId = setTimeout(() => {
        handleError(new Error('Analysis timed out. Please try again.'));
      }, 30000); // 30 second timeout for complete analysis

      try {
        // Set up one-time message listener for extracted text
        const messageListener = (msg) => {
          if (msg.action === 'tos-analysis-updated') {
            clearTimeout(analysisTimeoutId);
            chrome.runtime.onMessage.removeListener(messageListener);
            
            scanTosBtn.disabled = false;
            scanTosBtn.textContent = 'Scan ToS';
            
            if (msg.analysis) {
              updateToSUI(msg.analysis);
              if (window.showModal) {
                // Format results for modal
                let html = `
                  <div style="padding:20px">
                    <h2 style="margin:0 0 15px 0">Terms of Service Analysis</h2>
                    <div style="margin-bottom:20px">
                      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                        <div style="font-weight:600">Risk Score:</div>
                        <div style="flex:1;background:#eee;height:8px;border-radius:4px">
                          <div style="width:${msg.analysis.riskScore}%;height:100%;background:${
                            msg.analysis.riskScore >= 70 ? '#ff4b4b' :
                            msg.analysis.riskScore >= 40 ? '#ffbb4b' :
                            '#4bff7b'};border-radius:4px"></div>
                        </div>
                        <div>${msg.analysis.riskScore}%</div>
                      </div>
                    </div>`;

                const categoryNames = {
                  dataPrivacy: 'Data Privacy Issues',
                  unfairObligations: 'Unfair Terms',
                  securityConcerns: 'Security Concerns',
                  suspiciousLanguage: 'Concerning Language'
                };

                for (const [category, flags] of Object.entries(msg.analysis.categories)) {
                  if (flags.length > 0) {
                    html += `
                      <div style="margin-bottom:20px">
                        <h3 style="margin:0 0 10px 0;font-size:16px">${categoryNames[category]}</h3>
                        ${flags.map(flag => `
                          <div style="margin-bottom:10px;padding:10px;background:#f5f5f5;border-radius:4px">
                            <div style="font-weight:500;margin-bottom:5px">${flag.description}</div>
                            <div style="font-size:13px;color:#666">Risk Level: ${flag.risk}/10</div>
                            ${flag.context ? `<div style="font-size:13px;color:#444;margin-top:5px;padding:5px;background:#fff;border-radius:2px">"${flag.context}"</div>` : ''}
                          </div>
                        `).join('')}
                      </div>`;
                  }
                }

                html += '</div>';
                window.showModal(html);
              }
            } else {
              handleError(new Error('No analysis results received'));
            }
          }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        chrome.runtime.sendMessage({
          action: 'scan-tos-url',
          url: url || null // null will trigger current page scan
        }, (response) => {
          // Clear initial timeout since we got a response
          clearTimeout(initialTimeoutId);
          
          if (response?.error) {
            clearTimeout(analysisTimeoutId);
            chrome.runtime.onMessage.removeListener(messageListener);
            handleError(new Error(response.error));
          } else if (response?.analysis) {
            // If we got immediate results
            clearTimeout(analysisTimeoutId);
            chrome.runtime.onMessage.removeListener(messageListener);
            updateToSUI(response.analysis);
            if (response.html && window.showModal) {
              window.showModal(response.html);
            }
          }
          // Otherwise wait for the messageListener to handle the results
        });

      } catch (e) {
        clearTimeout(timeoutId);
        handleError(e);
      }
    });
  }

  // YouTube Checker functionality
  const analyzeYoutubeBtn = document.getElementById('analyze-youtube');
  if (analyzeYoutubeBtn) {
    analyzeYoutubeBtn.addEventListener('click', async () => {
      analyzeYoutubeBtn.disabled = true;
      analyzeYoutubeBtn.textContent = 'Analyzing...';

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab?.url?.includes('youtube.com/watch')) {
          throw new Error('Please open a YouTube video first');
        }

        // Get stored analysis if available
        const stored = await new Promise(resolve => {
          chrome.storage.local.get(['currentYouTubeAnalysis'], resolve);
        });

        if (stored.currentYouTubeAnalysis) {
    const rawStored = stored.currentYouTubeAnalysis || {};
    const metadata = rawStored.metadata || {};
    // Support both old (quickVerdict/fullAnalysis) and new (verdict/reason/raw) shapes
    const quickVerdict = rawStored.quickVerdict || rawStored.verdict || 'UNVERIFIED';
    const fullAnalysis = rawStored.fullAnalysis || rawStored.reason || (rawStored.raw ? JSON.stringify(rawStored.raw, null, 2) : '');
    const timestamp = rawStored.timestamp || Date.now();
          
          // Format analysis for display
          // Ensure quickVerdict is a string before using includes()
          const quickVerdictStr = String(quickVerdict || 'UNVERIFIED');

          let html = `
            <div style="padding: 20px">
              <h2 style="margin: 0 0 15px 0">Video Analysis Results</h2>
              <div style="margin-bottom: 20px">
                <div style="font-weight: 600; font-size: 16px; margin-bottom: 10px">${metadata.title}</div>
                <div style="color: #666; margin-bottom: 15px">Channel: ${metadata.channel}</div>
                <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 20px">
                  <div style="font-weight: 500; margin-bottom: 5px">Quick Verdict:</div>
                  <div style="font-size: 18px; color: ${
                    quickVerdictStr.includes('FACTUAL') ? '#10b981' : 
                    quickVerdictStr.includes('SATIRE') ? '#6366f1' :
                    quickVerdictStr.includes('MISLEADING') ? '#ef4444' :
                    quickVerdictStr.includes('OPINION') ? '#f59e0b' : '#71717a'
                  }">${quickVerdict}</div>
                </div>
                ${fullAnalysis ? `
                  <div style="border-top: 1px solid #e5e7eb; padding-top: 15px">
                    <div style="font-weight: 500; margin-bottom: 10px">Detailed Analysis:</div>
                    <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.5">${String(fullAnalysis)}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;

          window.showModal(html);
        } else {
          // If no stored analysis, trigger new analysis
          chrome.tabs.sendMessage(tab.id, { action: 'extract-youtube' });
          throw new Error('Analysis in progress... Please wait for the banner results and try again.');
        }
      } catch (error) {
        if (window.showModal) {
          window.showModal(`
            <div style="color: #e53e3e; padding: 20px; text-align: center">
              <h3 style="margin: 0 0 10px 0">Analysis Status</h3>
              <p style="margin: 0">${error.message}</p>
            </div>
          `);
        }
      } finally {
        analyzeYoutubeBtn.disabled = false;
        analyzeYoutubeBtn.textContent = 'Analyze Video';
      }
    });
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

  // ===== AUTOCLICKER =====
  let isRunning = false;
  let runInterval = null;

  function getSettings() {
    return {
      interval: parseInt(document.getElementById('ac-interval').value, 10) || 100,
      highlight: document.getElementById('ac-highlight').checked
    };
  }

  function updateResult(message, type = 'info') {
    const resultEl = document.getElementById('ac-result');
    if (!resultEl) return;
    resultEl.textContent = message;
    resultEl.style.color = type === 'error' ? '#d32f2f' : type === 'success' ? '#388e3c' : '#1976d2';
  }

  async function sendClickMessage(action, settings) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        updateResult('No active tab', 'error');
        return false;
      }

      return new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action, highlight: settings.highlight },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[AC] Error:', chrome.runtime.lastError.message);
              resolve(false);
              return;
            }
            resolve(response?.success === true);
          }
        );
      });
    } catch (err) {
      console.error('[AC] Error:', err);
      updateResult('Error: ' + err.message, 'error');
      return false;
    }
  }

  async function testClick() {
    const settings = getSettings();
    updateResult('Testing...', 'info');
    const success = await sendClickMessage('autoclick_test', settings);
    updateResult(success ? 'Clicked!' : 'Failed', success ? 'success' : 'error');
  }

  async function startAutoclick() {
    if (isRunning) {
      updateResult('Already running', 'error');
      return;
    }
    const settings = getSettings();
    isRunning = true;
    updateResult(`Running (${settings.interval}ms)`, 'success');
    runInterval = setInterval(async () => {
      await sendClickMessage('autoclick', settings);
    }, settings.interval);
  }

  function stopAutoclick() {
    if (!isRunning) {
      updateResult('Not running', 'error');
      return;
    }
    clearInterval(runInterval);
    isRunning = false;
    updateResult('Stopped', 'info');
  }

  setTimeout(() => {
    document.getElementById('ac-start')?.addEventListener('click', startAutoclick);
    document.getElementById('ac-stop')?.addEventListener('click', stopAutoclick);
    document.getElementById('ac-test')?.addEventListener('click', testClick);
  }, 100);

  console.log('Quality of Life page script loaded');
})();
