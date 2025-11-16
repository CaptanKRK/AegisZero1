// background service worker - supports both Flask and FastAPI servers
// import the shared ToS scanner; try a couple of paths and guard failures
try {
  // prefer explicit path
  importScripts('scripts/tos_scanner.js');
} catch (e1) {
  try {
    importScripts('tos_scanner.js');
  } catch (e2) {
    console.warn('background: failed to import tos_scanner.js via importScripts', e1, e2);
  }
}

// If import failed and ToSScanner isn't available, provide a minimal shim so the
// rest of the service worker can run without throwing. This avoids crashes when
// the script can't be fetched in some environments (packaging/CSP issues).
if (typeof ToSScanner === 'undefined') {
  console.warn('background: ToSScanner not available after import; installing minimal shim.');
  class ToSScanner {
    constructor() {
      this.isToSPage = false;
      this.scanResults = null;
      this.analysisInProgress = false;
    }
    detectToSPage(url, title, bodyText) {
      // conservative default: look for simple URL patterns
      try {
        url = (url || '').toLowerCase();
        const patterns = ['/terms', '/tos', '/terms-of-service', '/privacy', '/policy'];
        this.isToSPage = patterns.some(p => url.includes(p));
      } catch (e) { this.isToSPage = false; }
      return this.isToSPage;
    }
    extractToSContent(doc) {
      try {
        if (!doc && typeof document !== 'undefined') doc = document;
        if (!doc) return '';
        const el = doc.querySelector && (doc.querySelector('main') || doc.querySelector('article'));
        return (el && (el.innerText || el.textContent) ) ? (el.innerText || el.textContent).substring(0,50000) : (doc.body && doc.body.innerText ? doc.body.innerText.substring(0,50000) : '');
      } catch (e) { return ''; }
    }
    performAnalysis(content) {
      // minimal analysis: return low-risk empty result
      return { riskScore: 0, redFlags: [], categories: { dataPrivacy: [], unfairObligations: [], securityConcerns: [], suspiciousLanguage: [] }, totalFlags: 0, contentLength: content ? content.length : 0, analysisDate: new Date().toISOString() };
    }
    getContext(text, match, contextLength) {
      try {
        const index = (text || '').indexOf(match || '');
        if (index === -1) return '';
        const start = Math.max(0, index - (contextLength||100));
        const end = Math.min((text||'').length, index + (match?match.length:0) + (contextLength||100));
        return (text||'').substring(start, end).trim();
      } catch (e) { return ''; }
    }
  }
  // attach to worker global
  try { self.ToSScanner = ToSScanner; } catch (e) { /* ignore */ }
}

// Format YouTube verdict for banner display
function formatYouTubeVerdict(analysis) {
  if (!analysis || !analysis.verdict) return 'UNVERIFIED';
  
  const text = analysis.verdict.toLowerCase();
  let verdict = 'UNVERIFIED';
  
  if (text.includes('factual') || text.includes('accurate')) {
    verdict = 'FACTUAL';
  } else if (text.includes('satire') || text.includes('parody')) {
    verdict = 'SATIRE';
  } else if (text.includes('misleading') || text.includes('false')) {
    verdict = 'MISLEADING';
  } else if (text.includes('opinion') || text.includes('editorial')) {
    verdict = 'OPINION';
  }

  return verdict;
}

// Video content analysis with LLM support
async function analyzeVideoContent(data) {
  try {
    // Try LLM analysis first
    const llmResult = await analyzeLLMContent(data);
    return llmResult;
  } catch (error) {
    console.log('LLM analysis failed, falling back to pattern matching:', error);
    // Fallback to pattern matching
    return analyzePatternMatching(data);
  }
}

// Pattern matching analysis function (original logic)
async function analyzePatternMatching(data) {
}

function formatAnalysisResults(analysis) {
  let html = `
    <div style="padding:20px">
      <h2 style="margin:0 0 15px 0">Terms of Service Analysis</h2>
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="font-weight:600">Risk Score:</div>
          <div style="flex:1;background:#eee;height:8px;border-radius:4px">
            <div style="width:${analysis.riskScore}%;height:100%;background:${
              analysis.riskScore >= 70 ? '#ff4b4b' :
              analysis.riskScore >= 40 ? '#ffbb4b' :
              '#4bff7b'};border-radius:4px"></div>
          </div>
          <div>${analysis.riskScore}%</div>
        </div>
      </div>`;

  const categoryNames = {
    dataPrivacy: 'Data Privacy Issues',
    unfairObligations: 'Unfair Terms',
    securityConcerns: 'Security Concerns',
    suspiciousLanguage: 'Concerning Language'
  };

  for (const [category, flags] of Object.entries(analysis.categories)) {
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
  return {html, analysis};
}

function handleAnalysisResults(analysis, url) {
  // Store analysis results
  chrome.storage.local.set({
    tosAnalysis: analysis,
    tosAnalysisUrl: url,
    tosAnalysisTimestamp: Date.now()
  }, () => {
    console.log('background: stored analysis');
    // Notify all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, {
            action: 'tos-analysis-updated',
            analysis: analysis,
            url: url
          });
        } catch(e) {
          console.warn('background: failed to notify tab', tab.id, e);
        }
      });
    });
  });
}
const FLASK_SERVER = 'http://localhost:5000';
const FASTAPI_SERVER = 'http://localhost:8000';

// Try Flask first, fallback to FastAPI
async function callServer(endpoint, data) {
  let modelAvailable = false;
  
  // Check if server and model are available
  try {
    const healthResponse = await fetch(`${FLASK_SERVER}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      modelAvailable = health.model_loaded;
      console.log('Server health check:', health);
    }
  } catch (e) {
    console.log('Server health check failed:', e);
  }

  // For YouTube analysis, only use server if model is available
  if (data.type === 'youtube' && !modelAvailable) {
    throw new Error('local_analysis');
  }

  try {
    // Try Flask server first
    const response = await fetch(`${FLASK_SERVER}${endpoint}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Flask server not available, trying FastAPI...');
  }
  
  try {
    // Try FastAPI server
    const response = await fetch(`${FASTAPI_SERVER}${endpoint}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('FastAPI server not available');
  }
  
  throw new Error('No server available');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(msg.action === 'classify-ebay'){
    callServer('/classify', {type:'ebay', payload: msg.data})
      .then(json => {
        const html = `<h3>eBay Analysis</h3><p>Verdict: <b>${json.verdict}</b></p><pre>${json.reason || ''}</pre>`;
        sendResponse({html});
      })
      .catch(err => sendResponse({error:err.message}));
    return true;
  } 
  else if(msg.action === 'scan-website'){
    callServer('/classify', {type:'url', payload: {url: msg.url}})
      .then(json => {
        const html = `<h3>Website Scan</h3><p>Verdict: <b>${json.verdict}</b></p><pre>${json.reason}</pre>`;
        sendResponse({resultHtml: html});
      })
      .catch(e => sendResponse({error:e.message}));
    return true;
  } 
  else if(msg.action === 'classify-youtube'){
    // Function to perform local analysis
    async function analyzeLocally(data) {
      // First, try LLM analysis
      try {
        const prompt = `Analyze this YouTube video content and classify it as FACTUAL, SATIRE, MISLEADING, or OPINION. Provide a one-line explanation.
        
Title: ${data.title}
Channel: ${data.channel}
Description: ${data.description}
Category: ${data.metadata?.category || 'Unknown'}
Tags: ${data.metadata?.tags?.join(', ') || 'None'}
`;

        const llmResponse = await chrome.runtime.sendMessage({
          action: 'callGemini',
          prompt: prompt
        });

        if (llmResponse && !llmResponse.error) {
          // Parse LLM response for verdict
          const text = llmResponse.toLowerCase();
          if (text.includes('factual')) return { verdict: 'FACTUAL', reason: llmResponse, confidence: 'high', method: 'llm' };
          if (text.includes('satire')) return { verdict: 'SATIRE', reason: llmResponse, confidence: 'high', method: 'llm' };
          if (text.includes('misleading')) return { verdict: 'MISLEADING', reason: llmResponse, confidence: 'high', method: 'llm' };
          if (text.includes('opinion')) return { verdict: 'OPINION', reason: llmResponse, confidence: 'high', method: 'llm' };
        }
      } catch (e) {
        console.log('LLM analysis failed, falling back to pattern matching:', e);
      }

      // Fallback to pattern matching if LLM fails
      const text = `${data.title} ${data.description}`.toLowerCase();
      const tags = data.metadata?.tags?.join(' ').toLowerCase() || '';
      const category = data.metadata?.category?.toLowerCase() || '';
      
      // Enhanced patterns for better classification
      const patterns = {
        satire: ['satire', 'parody', 'joke', 'humor', 'comedy', 'funny', 'spoof', 'skit', 'meme', 'prank'],
        factual: ['documentary', 'news report', 'educational', 'official', 'research', 'analysis', 'facts', 'evidence', 'report', 'investigation'],
        misleading: ['conspiracy', 'hoax', 'exposed', 'they dont want you to know', 'secret truth', 'what they hide', 'shocking truth', 'cover up', 'illuminati'],
        opinion: ['opinion', 'review', 'reaction', 'thoughts on', 'i think', 'commentary', 'my take', 'perspective', 'reaction', 'reacting to']
      };

      // Enhanced analysis with weighted scoring
      const scores = {
        satire: 0,
        factual: 0,
        misleading: 0,
        opinion: 0
      };

      // Calculate scores with context
      for (const [category, words] of Object.entries(patterns)) {
        for (const word of words) {
          // Check title (highest weight)
          if (data.title.toLowerCase().includes(word)) {
            scores[category] += 3;
          }
          // Check description
          if (data.description.toLowerCase().includes(word)) {
            scores[category] += 1;
          }
          // Check tags
          if (tags.includes(word)) {
            scores[category] += 2;
          }
        }
      }

      // Category-based scoring
      if (category) {
        if (['comedy', 'entertainment'].includes(category)) scores.satire += 2;
        if (['news', 'education', 'science'].includes(category)) scores.factual += 2;
        if (['people', 'blogs'].includes(category)) scores.opinion += 2;
      }

      // Additional context analysis
      const clickbaitPatterns = [
        'you won\'t believe', '!!!!', 'gone wrong', 'must see', '100%',
        'shocking', 'mind blowing', 'they don\'t want you to know',
        'watch this before it\'s deleted', 'share this before'
      ];
      if (clickbaitPatterns.some(p => text.includes(p))) {
        scores.misleading += 2;
      }

      const academicPatterns = [
        'study shows', 'research indicates', 'according to', 'evidence suggests',
        'data shows', 'scientists found', 'experts say', 'published in',
        'peer reviewed', 'scientific study'
      ];
      if (academicPatterns.some(p => text.includes(p))) {
        scores.factual += 2;
      }

      // Channel-based scoring
      if (data.channel) {
        const channelLower = data.channel.toLowerCase();
        if (channelLower.includes('news') || channelLower.includes('edu') || channelLower.includes('science')) {
          scores.factual += 2;
        }
        if (channelLower.includes('comedy') || channelLower.includes('meme') || channelLower.includes('funny')) {
          scores.satire += 2;
        }
        if (channelLower.includes('vlog') || channelLower.includes('review')) {
          scores.opinion += 2;
        }
      }

      // Get highest scoring category
      let maxScore = 0;
      let verdict = 'UNVERIFIED';
      for (const [category, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          verdict = category.toUpperCase();
        }
      }

      // Require a minimum score to make a verdict
      if (maxScore < 2) {
        verdict = 'UNVERIFIED';
      }

      const confidenceLevel = maxScore > 5 ? 'high' : maxScore > 3 ? 'medium' : 'low';

      return {
        verdict,
        reason: `Content analysis suggests this is ${verdict.toLowerCase()} content based on:\n` +
                `- Title and description analysis\n` +
                `- Channel context: ${data.channel}\n` +
                `- Content category: ${category || 'Unknown'}\n` +
                `- Pattern matching confidence: ${confidenceLevel}`,
        scores,
        confidence: confidenceLevel,
        method: 'pattern'
      };
    }

    try {
      callServer('/classify', {type:'youtube', payload: msg.data})
        .then(json => {
          // Format the verdict for the banner
          const verdict = formatYouTubeVerdict(json);
          sendResponse({
            verdict: verdict,
            details: json.reason,
            html: `<h3>YouTube Analysis</h3><p>Verdict: <b>${verdict}</b></p><pre>${json.reason}</pre>`
          });
        })
        .catch(e => {
          if (e.message === 'local_analysis') {
            // Fallback to local analysis if server/model isn't available
            const analysis = analyzeLocally(msg.data);
            sendResponse({
              verdict: analysis.verdict,
              details: `${analysis.reason}\nConfidence: ${analysis.confidence}\n\nChannel: ${msg.data.channel}\nTitle: ${msg.data.title}`,
              html: `<h3>YouTube Analysis</h3>
                    <p>Verdict: <b>${analysis.verdict}</b></p>
                    <p>Confidence: ${analysis.confidence}</p>
                    <pre>${analysis.reason}\n\nChannel: ${msg.data.channel}\nTitle: ${msg.data.title}</pre>`
            });
          } else {
            throw e;
          }
        });
    } catch (e) {
      console.error('YouTube analysis error:', e);
      const analysis = analyzeLocally(msg.data);
      sendResponse({
        verdict: analysis.verdict,
        details: `${analysis.reason}\nConfidence: ${analysis.confidence}\n\nChannel: ${msg.data.channel}\nTitle: ${msg.data.title}`,
        html: `<h3>YouTube Analysis</h3>
              <p>Verdict: <b>${analysis.verdict}</b></p>
              <p>Confidence: ${analysis.confidence}</p>
              <pre>${analysis.reason}\n\nChannel: ${msg.data.channel}\nTitle: ${msg.data.title}</pre>`
      });
    }
    return true;
  } 
  else if(msg.action === 'scan-tos-url'){
    console.log('background: received scan-tos-url request', msg);
    
    if (!msg.url) {
      // For current page scan, we need to get the active tab
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs || !tabs[0]) {
          sendResponse({error: 'No active tab found'});
          return;
        }
        const tab = tabs[0];
        
        try {
          console.log('background: scanning tab', tab.id);
          
          // Directly execute scanning code in the page context
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Get text content using multiple methods
              const getTextContent = (el) => {
                if (!el) return '';
                return (el.innerText || el.textContent || '').trim();
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
                  .filter(t => t.length > 100)
                  .join('\n\n');
              }
              
              // Fallback to body if no main content or main content is too short
              if (!text || text.length < 200) {
                text = getTextContent(document.body);
              }

              return { text, url: window.location.href };
            }
          });

          if (!results || !results[0] || !results[0].result) {
            throw new Error('Failed to extract page content');
          }

          const { text, url } = results[0].result;
          
          if (!text || text.length < 100) {
            throw new Error('No substantial text content found on page');
          }

          console.log('background: analyzing extracted text:', text.length, 'chars');
          
          // Analyze the extracted text
          const scanner = new ToSScanner();
          const analysis = scanner.performAnalysis(text);
          const formatted = formatAnalysisResults(analysis);
          
          console.log('background: analysis complete, risk score:', analysis.riskScore);
          
          // Store results and notify UI
          handleAnalysisResults(analysis, url || tab.url);
          
          sendResponse(formatted);
        } catch (e) {
          console.error('background: scanning failed', e);
          sendResponse({error: e.message || 'Failed to scan page'});
        }
      });
    } else {
      // For URL scan, fetch directly
      fetch(msg.url)
        .then(response => response.text())
        .then(text => {
          const scanner = new ToSScanner();
          const analysis = scanner.performAnalysis(text);
          const formatted = formatAnalysisResults(analysis);
          handleAnalysisResults(analysis, msg.url);
          sendResponse(formatted);
        })
        .catch(e => {
          console.error('background: scan-tos-url failed', e);
          sendResponse({error: e.message});
        });
    }
    return true;
  } 
  else if(msg.action === 'analyze-tos'){
    console.log('background: received analyze-tos request', msg);
    try {
      // Create ToSScanner from content script
      const scanner = new ToSScanner();
      const analysis = scanner.performAnalysis(msg.text);

      // Format results similar to scan-tos-url
      let html = `
        <div style="padding:20px">
          <h2 style="margin:0 0 15px 0">Terms of Service Analysis</h2>
          <div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="font-weight:600">Risk Score:</div>
              <div style="flex:1;background:#eee;height:8px;border-radius:4px">
                <div style="width:${analysis.riskScore}%;height:100%;background:${
                  analysis.riskScore >= 70 ? '#ff4b4b' :
                  analysis.riskScore >= 40 ? '#ffbb4b' :
                  '#4bff7b'};border-radius:4px"></div>
              </div>
              <div>${analysis.riskScore}%</div>
            </div>
          </div>`;

      const categoryNames = {
        dataPrivacy: 'Data Privacy Issues',
        unfairObligations: 'Unfair Terms',
        securityConcerns: 'Security Concerns',
        suspiciousLanguage: 'Concerning Language'
      };

      for (const [category, flags] of Object.entries(analysis.categories)) {
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

      // Store analysis and notify UI
      chrome.storage.local.set({
        tosAnalysis: analysis,
        tosAnalysisUrl: msg.url,
        tosAnalysisTimestamp: Date.now()
      }, () => {
        console.log('background: stored analysis');
        // Notify all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, {
                action: 'tos-analysis-updated',
                analysis: analysis,
                url: msg.url
              });
            } catch(e) {
              console.warn('background: failed to notify tab', tab.id, e);
            }
          });
        });
      });

      sendResponse({html, analysis});
    } catch(e) {
      console.error('background: analyze-tos failed', e);
      sendResponse({error: e.message});
    }
    return true;
  } 
  else if(msg.action === 'show-modal'){
    sendResponse({});
  }
});

// Handler for email breach checks via HaveIBeenPwned
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'checkEmailBreaches') return;

  const email = msg.email;
  if (!email || typeof email !== 'string') {
    sendResponse({ status: 'error', error: 'invalid_email', message: 'Email is required' });
    return;
  }

  // Read stored API key from local storage
  chrome.storage.local.get(['hibpApiKey'], async (items) => {
    const apiKey = items?.hibpApiKey || null;
    const normalized = email.trim().toLowerCase();
    if (!apiKey) {
      // No API key configured — attempt a best-effort HTML scrape via a CORS proxy (used by HackTheNest)
      try {
        const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://haveibeenpwned.com/account/' + normalized);
        const proxyResp = await fetch(proxy, { method: 'GET' });
        if (!proxyResp.ok) {
          sendResponse({ status: 'manual', message: 'Unable to fetch HIBP page via proxy. Please check manually at haveibeenpwned.com.' });
          return;
        }

        const html = await proxyResp.text();

        // Normalize for case-insensitive checks
        const htmlLower = html.toLowerCase();

        // Heuristics to detect no-breach phrases (broader and case-insensitive)
        const noBreachRegex = /(good\s+news).*no\s+(pwnage|breach(?:es)?|results)?|no\s+(pwnage|breach(?:es)?|results)\s+found|this\s+account\s+has\s+not\s+been\s+found|no\s+results\s+found/i;
        if (noBreachRegex.test(htmlLower)) {
          sendResponse({ status: 'ok', result: { breachCount: 0, breaches: [] }, source: 'scraped' });
          return;
        }

        // Try to extract breach names from multiple HTML patterns
        const matches = [];

  // 1) Links to /breach/<name> — only accept if near a breach-related heading to reduce false positives
  const breachLinkRegex = /<a[^>]+href="\/breach\/[^\"]+"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = breachLinkRegex.exec(html)) !== null) {
          const name = (m[1] || '').replace(/<[^>]+>/g, '').trim();
          if (!name) continue;
          // proximity check: look backwards/forwards a small window to see if 'breach' keyword exists nearby
          const idx = m.index;
          const windowStart = Math.max(0, idx - 500);
          const windowEnd = Math.min(html.length, idx + 500);
          const windowText = htmlLower.slice(windowStart, windowEnd);
          if (/breach|breached|compromis|pwned|breaches?/i.test(windowText)) {
            matches.push({ Name: name });
          }
        }

        // 2) Headings that often contain breach names (h3, h2 with 'breach' context)
        if (matches.length === 0) {
          const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
          while ((m = headingRegex.exec(html)) !== null) {
            const txt = (m[1] || '').replace(/<[^>]+>/g, '').trim();
            if (txt && /breach|breached|compromis/i.test(txt)) {
              // Attempt to extract a service name
              const nameMatch = txt.replace(/(breach(ed)?|compromis(ed)?|security incident)/gi, '').trim();
              if (nameMatch) matches.push({ Name: nameMatch });
            }
          }
        }

        // 3) Look for JSON-like snippets referencing 'Name' or 'BreachDate'
        if (matches.length === 0) {
          const jsonNameRegex = /"Name"\s*:\s*"([^"]+)"/g;
          while ((m = jsonNameRegex.exec(html)) !== null) {
            const name = (m[1] || '').trim();
            if (name) matches.push({ Name: name });
          }
        }

        if (matches.length > 0) {
          // dedupe names
          const seen = new Set();
          const dedup = [];
          for (const b of matches) {
            const n = (b.Name || '').trim();
            if (!seen.has(n)) {
              seen.add(n);
              dedup.push(b);
            }
          }
          sendResponse({ status: 'ok', result: { breachCount: dedup.length, breaches: dedup }, source: 'scraped' });
          return;
        }

        // As a last resort, if the page contains indicators of breaches, return manual-check suggestion with a snippet
        if (/breach|breached|compromis|pwned|pwnage/i.test(htmlLower)) {
          sendResponse({ status: 'manual', message: 'Possible breaches detected — please review on haveibeenpwned.com', rawHtmlSnippet: html.slice(0, 2000) });
          return;
        }

        // Couldn't determine — fall back to manual instructions
        sendResponse({ status: 'manual', message: 'Unable to determine breach status automatically. Please check haveibeenpwned.com.' });
        return;
      } catch (err) {
        sendResponse({ status: 'manual', message: 'Error fetching HIBP page: ' + (err?.message || String(err)) });
        return;
      }
    }

  const endpoint = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(normalized)}?truncateResponse=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'hibp-api-key': apiKey,
          'User-Agent': 'AEGIS-Extension/1.0 (contact@example.com)'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.status === 404) {
        sendResponse({ status: 'ok', result: { breachCount: 0, breaches: [] } });
        return;
      }

      if (resp.status === 401) {
        sendResponse({ status: 'error', error: 'unauthorized', statusCode: 401, message: 'HIBP API key unauthorized (401)' });
        return;
      }

      if (resp.status === 429) {
        sendResponse({ status: 'error', error: 'rate_limited', statusCode: 429, message: 'Rate limited by HIBP (429)' });
        return;
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        sendResponse({ status: 'error', error: 'http_error', statusCode: resp.status, message: text || resp.statusText });
        return;
      }

      const data = await resp.json().catch(() => null);
      const breaches = Array.isArray(data) ? data : [];
      sendResponse({ status: 'ok', result: { breachCount: breaches.length, breaches } });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err && err.name === 'AbortError') {
        sendResponse({ status: 'error', error: 'timeout', message: 'HIBP request timed out' });
      } else {
        sendResponse({ status: 'error', error: 'fetch_error', message: err?.message || String(err) });
      }
    }
  });

  // Indicate async response
  return true;
});

// Handler to list all known breaches (uses API if key present, else scrapes public page via proxy)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'listAllBreaches') return;

  chrome.storage.local.get(['hibpApiKey'], async (items) => {
    const apiKey = items?.hibpApiKey || null;

    if (apiKey) {
      // Call HIBP breaches endpoint
      try {
        const endpoint = 'https://haveibeenpwned.com/api/v3/breaches';
        const resp = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'hibp-api-key': apiKey,
            'User-Agent': 'AEGIS-Extension/1.0 (contact@example.com)'
          }
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          sendResponse({ status: 'error', error: 'http_error', statusCode: resp.status, message: txt || resp.statusText });
          return;
        }

        const data = await resp.json().catch(() => null);
        if (!Array.isArray(data)) {
          sendResponse({ status: 'error', error: 'invalid_response', message: 'Unexpected response from HIBP' });
          return;
        }

        // Return array of breaches (Name, Domain, BreachDate, Description optional)
        const breaches = data.map(b => ({ Name: b.Name, Domain: b.Domain, BreachDate: b.BreachDate, Description: b.Description }));
        sendResponse({ status: 'ok', breaches });
        return;
      } catch (err) {
        sendResponse({ status: 'error', error: 'fetch_error', message: err?.message || String(err) });
        return;
      }
    }

    // No API key: try scraping the public breaches page via api.allorigins.win
    try {
      const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://haveibeenpwned.com/breaches');
      const proxyResp = await fetch(proxy, { method: 'GET' });
      if (!proxyResp.ok) {
        sendResponse({ status: 'error', error: 'proxy_error', statusCode: proxyResp.status, message: 'Unable to fetch breaches page via proxy' });
        return;
      }

      const html = await proxyResp.text();
      const htmlLower = html.toLowerCase();

      const breaches = [];

      // Extract links to /breach/<name>
      const breachLinkRegex = /<a[^>]+href="\/breach\/[^\"]+"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = breachLinkRegex.exec(html)) !== null) {
        const name = (m[1] || '').replace(/<[^>]+>/g, '').trim();
        if (name) breaches.push({ Name: name });
      }

      // If none found, try headings or JSON snippets
      if (breaches.length === 0) {
        const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
        while ((m = headingRegex.exec(html)) !== null) {
          const txt = (m[1] || '').replace(/<[^>]+>/g, '').trim();
          if (txt && txt.length > 1) breaches.push({ Name: txt });
        }
      }

      // Dedupe
      const seen = new Set();
      const dedup = [];
      for (const b of breaches) {
        const n = (b.Name || '').trim();
        if (n && !seen.has(n)) {
          seen.add(n);
          dedup.push(b);
        }
      }

      if (dedup.length > 0) {
        sendResponse({ status: 'ok', breaches: dedup, source: 'scraped' });
        return;
      }

      sendResponse({ status: 'error', error: 'no_data', message: 'No breaches found on scraped page' });
      return;
    } catch (err) {
      sendResponse({ status: 'error', error: 'scrape_error', message: err?.message || String(err) });
      return;
    }
  });

  return true; // async
});
