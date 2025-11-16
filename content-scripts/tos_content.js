// Terms and Conditions Scanner (adapted from HackTheNest)
// Runs in page context as a content script: detects ToS pages, shows a notification,
// performs lightweight regex analysis, and responds to extraction messages from the popup.

(function(){
  'use strict';

  class ToSScanner {
    constructor() {
      this.isToSPage = false;
      this.scanResults = null;
      this.analysisInProgress = false;
      this.init();
    }

    init() {
      try {
        this.detectToSPage();
        if (this.isToSPage) {
          this.showToSNotification();
          this.analyzeContent();
        }
      } catch (e) {
        console.error('ToSScanner init failed', e);
      }
    }

    detectToSPage() {
      const url = window.location.href.toLowerCase();
      const title = document.title.toLowerCase();
      const bodyText = (document.body && document.body.innerText || '').toLowerCase();

      const tosIndicators = [
        'terms of service', 'terms and conditions', 'terms of use',
        'user agreement', 'service agreement', 'legal terms',
        'terms', 'conditions', 'agreement', 'policy'
      ];

      const tosUrlPatterns = [
        '/terms', '/tos', '/terms-of-service', '/terms-and-conditions',
        '/legal', '/agreement', '/user-agreement', '/service-agreement',
        '/terms-of-use', '/conditions', '/policy'
      ];

      const urlMatch = tosUrlPatterns.some(pattern => url.includes(pattern));
      const titleMatch = tosIndicators.some(indicator => title.includes(indicator));
      const contentMatch = tosIndicators.some(indicator => bodyText.includes(indicator));

      const legalPatterns = [
        'by using this service', 'you agree to', 'you consent to',
        'binding arbitration', 'governing law', 'jurisdiction',
        'limitation of liability', 'disclaimer', 'warranty'
      ];
      const legalMatch = legalPatterns.some(pattern => bodyText.includes(pattern));

      this.isToSPage = urlMatch || titleMatch || (contentMatch && legalMatch);
      // keep debug log small
      console.log('ToSScanner: isToSPage=', this.isToSPage, 'urlMatch=', urlMatch, 'titleMatch=', titleMatch);
    }

    showToSNotification() {
      try {
        const notification = document.createElement('div');
        notification.id = 'tos-scanner-notification';
        notification.style.cssText = `
          position: fixed;
          top: 0; left: 0; right: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; padding: 12px 20px; z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px; font-weight: 500; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          display:flex; align-items:center; justify-content:space-between;
        `;

        notification.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:24px;height:24px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">📋</div>
            <div>
              <div style="font-weight:600;">Terms & Conditions Detected</div>
              <div style="font-size:12px;opacity:0.9;">Analyzing for potential risks...</div>
            </div>
          </div>
          <button id="tos-scanner-close" style="background:none;border:none;color:white;cursor:pointer;padding:4px;border-radius:4px;opacity:0.8;">✕</button>
        `;

        document.body.insertBefore(notification, document.body.firstChild);
        const closeBtn = document.getElementById('tos-scanner-close');
        if (closeBtn) closeBtn.addEventListener('click', () => notification.remove());
        setTimeout(() => { if (notification.parentNode) notification.remove(); }, 10000);
      } catch (e) { console.warn('ToSScanner notification failed', e); }
    }

    async analyzeContent() {
      if (this.analysisInProgress) return;
      this.analysisInProgress = true;
      try {
        const content = this.extractToSContent();
        const analysis = this.performAnalysis(content);
        this.scanResults = analysis;
        this.showAnalysisResults(analysis);
        // Persist the analysis so the popup/quality_of_life page can read it
        try {
          console.log('ToSScanner: storing analysis', analysis);
          // First send message to ensure UI updates immediately
          try { 
            chrome.runtime.sendMessage({ 
              action: 'tos-analysis-updated', 
              analysis,
              url: window.location.href 
            });
          } catch(e){
            console.warn('ToSScanner: failed to send runtime message', e);
          }
          // Then store in local storage as backup
          if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ 
              tosAnalysis: analysis,
              tosAnalysisUrl: window.location.href,
              tosAnalysisTimestamp: Date.now()
            }, () => {
              console.log('ToSScanner: analysis stored in local storage');
            });
          }
        } catch (e) {
          console.warn('ToSScanner: failed to store/send analysis', e);
        }
      } catch (e) {
        console.error('ToSScanner analyze failed', e);
      } finally { this.analysisInProgress = false; }
    }

    extractToSContent() {
      let content = '';
      const contentSelectors = ['main','article','.content','.main-content','.terms-content','.legal-content','#content'];
      for (const selector of contentSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText && el.innerText.length > content.length) content = el.innerText;
      }
      if (!content || content.length < 100) content = document.body.innerText || '';
      return content.substring(0, 50000);
    }

    performAnalysis(content) {
      const redFlags = [];
      const riskScore = { total: 0, max: 0 };
      const categories = { dataPrivacy: [], unfairObligations: [], securityConcerns: [], suspiciousLanguage: [] };

      const dataPrivacyPatterns = [
        { pattern: /collect.*personal.*information|gather.*data|store.*information/i, risk:8, category:'dataPrivacy', description:'Excessive data collection mentioned' },
        { pattern: /share.*third.*party|sell.*data|transfer.*information/i, risk:9, category:'dataPrivacy', description:'Data sharing with third parties' },
        { pattern: /retain.*data|keep.*information|store.*permanently/i, risk:6, category:'dataPrivacy', description:'Long-term data retention' },
        { pattern: /cookies.*tracking|analytics.*data|behavioral.*tracking/i, risk:7, category:'dataPrivacy', description:'User tracking and analytics' }
      ];

      const unfairObligationsPatterns = [
        { pattern: /binding.*arbitration|mandatory.*arbitration|waive.*jury.*trial/i, risk:9, category:'unfairObligations', description:'Binding arbitration clause' },
        { pattern: /hidden.*fees|additional.*charges|automatic.*renewal/i, risk:8, category:'unfairObligations', description:'Hidden fees or automatic charges' },
        { pattern: /waive.*rights|limit.*liability|disclaim.*warranty/i, risk:7, category:'unfairObligations', description:'Waiver of user rights or liability limitations' },
        { pattern: /modify.*terms|change.*agreement|update.*policy/i, risk:6, category:'unfairObligations', description:'Unilateral terms modification' }
      ];

      const securityPatterns = [
        { pattern: /access.*account|monitor.*activity|review.*content/i, risk:8, category:'securityConcerns', description:'Broad access to user accounts or content' },
        { pattern: /disclose.*information|report.*authorities|cooperate.*investigation/i, risk:7, category:'securityConcerns', description:'Information disclosure requirements' },
        { pattern: /security.*breach|data.*breach|unauthorized.*access/i, risk:5, category:'securityConcerns', description:'Security breach acknowledgment' }
      ];

      const suspiciousLanguagePatterns = [
        { pattern: /reasonable.*discretion|sole.*discretion|at.*our.*discretion/i, risk:6, category:'suspiciousLanguage', description:'Vague discretionary language' },
        { pattern: /may.*change|reserve.*right|without.*notice/i, risk:5, category:'suspiciousLanguage', description:'Unilateral change rights' },
        { pattern: /interpretation.*final|our.*decision.*final|binding.*interpretation/i, risk:7, category:'suspiciousLanguage', description:'One-sided interpretation rights' }
      ];

      const allPatterns = [...dataPrivacyPatterns, ...unfairObligationsPatterns, ...securityPatterns, ...suspiciousLanguagePatterns];
      for (const p of allPatterns) {
        const matches = content.match(p.pattern);
        if (matches) {
          riskScore.total += p.risk;
          riskScore.max += 10;
          const flag = { pattern: p.pattern.source, risk: p.risk, category: p.category, description: p.description, matches: matches.length, context: this.getContext(content, matches[0], 100) };
          redFlags.push(flag);
          categories[p.category].push(flag);
        }
      }

      const riskPercentage = riskScore.max > 0 ? Math.round((riskScore.total / riskScore.max) * 100) : 0;
      return { riskScore: riskPercentage, redFlags, categories, totalFlags: redFlags.length, contentLength: content.length, analysisDate: new Date().toISOString() };
    }

    getContext(text, match, contextLength) {
      const index = text.indexOf(match);
      const start = Math.max(0, index - contextLength);
      const end = Math.min(text.length, index + match.length + contextLength);
      return text.substring(start, end).trim();
    }

    showAnalysisResults(analysis) {
      try {
        const existing = document.getElementById('tos-scanner-results');
        if (existing) existing.remove();

        const resultsPanel = document.createElement('div');
        resultsPanel.id = 'tos-scanner-results';
        resultsPanel.style.cssText = `position:fixed;top:60px;right:20px;width:360px;max-height:80vh;background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999998;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;overflow-y:auto;border:1px solid #e2e8f0;`;

        const riskColor = analysis.riskScore >= 70 ? '#e53e3e' : analysis.riskScore >= 40 ? '#d69e2e' : '#38a169';

        resultsPanel.innerHTML = `
          <div style="padding:16px;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div style="width:32px;height:32px;background:${riskColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${analysis.riskScore>=70?'!':analysis.riskScore>=40?'?':'✓'}</div>
              <div>
                <div style="font-weight:600;font-size:15px;">ToS Risk Analysis</div>
                <div style="font-size:12px;color:#666;">${analysis.totalFlags} potential issues found</div>
              </div>
            </div>
            <div style="background:#f7fafc;padding:10px;border-radius:8px;margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"></div>
              <div style="background:#e2e8f0;height:6px;border-radius:3px;overflow:hidden;"><div style="background:${riskColor};height:100%;width:${analysis.riskScore}%;transition:width 0.3s ease;"></div></div>
            </div>
            <div style="display:flex;gap:8px;">
              <button id="tos-scanner-details" style="flex:1;padding:8px 12px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">View Details</button>
              <button id="tos-scanner-close-results" style="padding:8px 12px;background:#e2e8f0;color:#4a5568;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Close</button>
            </div>
          </div>
        `;

        document.body.appendChild(resultsPanel);

        document.getElementById('tos-scanner-close-results').addEventListener('click', () => resultsPanel.remove());
        document.getElementById('tos-scanner-details').addEventListener('click', () => this.showDetailedResults(analysis));

        setTimeout(()=>{ if (resultsPanel.parentNode && !resultsPanel.matches(':hover')) resultsPanel.remove(); }, 30000);
      } catch (e) { console.warn('ToSScanner showAnalysisResults failed', e); }
    }

    showDetailedResults(analysis) {
      const modal = document.createElement('div');
      modal.id = 'tos-scanner-modal';
      modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;`;
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `background:white;border-radius:12px;max-width:800px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);`;

      const categoryNames = { dataPrivacy:'Data Privacy Risks', unfairObligations:'Unfair Obligations', securityConcerns:'Security Concerns', suspiciousLanguage:'Suspicious Language' };

      modalContent.innerHTML = `
        <div style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <h2 style="margin:0;font-size:18px;font-weight:600;">Detailed ToS Analysis</h2>
          <button id="tos-scanner-close-modal" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;">×</button>
        </div>
        <div style="padding:20px;">${Object.entries(analysis.categories).map(([key, flags]) => `
          ${flags.length>0?`<div style="margin-bottom:18px;"><h3 style="margin:0 0 8px 0;font-size:15px;font-weight:600;">${categoryNames[key]}</h3>${flags.map(flag => `<div style="background:#fef5e7;border-left:3px solid #d69e2e;padding:10px;margin-bottom:8px;border-radius:0 6px 6px 0;"><div style="font-weight:500;margin-bottom:6px;">${flag.description}</div><div style="font-size:12px;color:#666;margin-bottom:6px;">Risk Level: ${flag.risk}/10</div><div style="font-size:12px;color:#4a5568;background:#f7fafc;padding:8px;border-radius:4px;font-family:monospace;">"${flag.context}"</div></div>`).join('')}</div>`:''}`).join('')}
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      document.getElementById('tos-scanner-close-modal').addEventListener('click', ()=> modal.remove());
      modal.addEventListener('click', (e)=> { if (e.target === modal) modal.remove(); });
    }
  }

  // Signal that the content script is ready
  console.log('tos_content: script loaded, signaling ready state');
  chrome.runtime.sendMessage({ action: 'tos-scanner-ready' });

  // Listen for messages from popup to extract page text
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('tos_content: received message', msg);
    
    if (msg && msg.action === 'extract-page-text') {
      console.log('tos_content: handling extract-page-text');
      
      const extractAndRespond = () => {
        try {
          console.log('tos_content: starting extraction');
          
          // Try multiple methods to get text content
          const getTextContent = (el) => {
            if (!el) return '';
            // Try innerText first as it respects visual formatting
            const text = el.innerText || el.textContent || '';
            return text.trim();
          };

          // Get main content sections
          const mainContentElements = Array.from(document.querySelectorAll(
            'main, article, [role="main"], .content, .main-content, .article-content, .post-content'
          ));

          let text = '';
          
          // If we found main content sections, use those
          if (mainContentElements.length > 0) {
            text = mainContentElements
              .map(el => getTextContent(el))
              .filter(t => t.length > 100) // Only keep substantial sections
              .join('\n\n');
          }
          
          // Fallback to body if no main content or main content is too short
          if (!text || text.length < 200) {
            text = getTextContent(document.body);
          }

          console.log('tos_content: extracted text length:', text.length);
          
          if (!text || text.length < 100) {
            sendResponse({
              success: false,
              error: 'No substantial text content found on page'
            });
          } else {
            sendResponse({
              success: true,
              text: text,
              url: window.location.href
            });
          }
        } catch (e) {
          console.error('tos_content: extraction failed', e);
          sendResponse({
            success: false,
            error: e.message || 'Failed to extract page content'
          });
        }
      };

      // Wait for page to be ready
      if (document.readyState === 'complete') {
        extractAndRespond();
      } else {
        console.log('tos_content: waiting for page load');
        window.addEventListener('load', extractAndRespond);
      }
      
      return true; // keep message channel open for async response
    }
  });

  // Run a passive scanner on page load (does not block page)
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => new ToSScanner());
    } else {
      new ToSScanner();
    }
  } catch (e) { console.warn('ToSScanner init error', e); }

})();
