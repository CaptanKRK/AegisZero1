// YouTube content script

// Configuration
// NOTE: Using a Google Fact Check API key directly in the content script is insecure
// but requested. This key will be used only in this file as requested.
const FACT_CHECK_API_KEY = 'AIzaSyCCqYfmg22aiRT0vwWe27-ZJUbjCy3vsao';

// Cache for analysis results
const analysisCache = new Map();

// Create analysis banner
function createAnalysisBanner() {
  const banner = document.createElement('div');
  banner.id = 'aegis-analysis-banner';
  // Make banner visible and resilient against page CSS
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(33, 33, 33, 0.98);
    color: #fff;
    padding: 8px 16px;
    z-index: 2147483647; /* maximum z-index to avoid being hidden */
    font-family: Roboto, Arial, sans-serif;
    display: flex; /* show by default when created */
    justify-content: center;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: transform 180ms ease, opacity 180ms ease;
  `;

  const statusText = document.createElement('span');
  statusText.id = 'aegis-status-text';
  statusText.textContent = 'Loading...';
  statusText.style.cssText = 'font-size: 14px;';

  const verdictText = document.createElement('span');
  verdictText.id = 'aegis-verdict-text';
  verdictText.style.cssText = 'font-weight: 600; font-size: 14px;';

  // Add a small dismiss button so user can hide the bar if needed
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.title = 'Hide Aegis bar';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    margin-left: 12px;
    background: transparent;
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    padding: 0 6px;
    line-height: 1;
  `;
  closeBtn.addEventListener('click', () => {
    banner.style.display = 'none';
    try { sessionStorage.setItem('aegis_banner_dismissed', '1'); } catch(e){}
  });

  banner.appendChild(statusText);
  banner.appendChild(verdictText);
  banner.appendChild(closeBtn);

  // Append to body when available, otherwise fallback to documentElement
  const target = document.body || document.documentElement || document;
  try { target.appendChild(banner); } catch (e) { document.documentElement.appendChild(banner); }

  // If user previously dismissed in this session, hide initially
  try {
    if (sessionStorage.getItem('aegis_banner_dismissed') === '1') {
      banner.style.display = 'none';
    }
  } catch (e) {}

  return banner;
}

// Extract video metadata with improved selectors
function extractVideoMetadata() {
  // Multiple selectors for title to handle YouTube's different layouts
  const titleSelectors = [
    'h1.ytd-video-primary-info-renderer',
    'h1.title.style-scope.ytd-video-primary-info-renderer',
    '#container > h1',
    '#above-the-fold #title h1',
    '#title > h1',
    'yt-formatted-string.ytd-watch-metadata'
  ];

  // Multiple selectors for channel name
  const channelSelectors = [
    'ytd-channel-name a',
    '#channel-name a',
    '#channel-name',
    '#owner #channel-name',
    '#upload-info ytd-channel-name',
    '#owner-text a'
  ];

  // Multiple selectors for description
  const descriptionSelectors = [
    'ytd-expander#description',
    '#description ytd-expander',
    '#description-inner',
    '#description yt-formatted-string',
    'ytd-expander.ytd-video-secondary-info-renderer',
    '#description > yt-formatted-string'
  ];

  // Try each selector until we find content
  const getContent = (selectors) => {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const content = element?.textContent?.trim();
        if (content) return content;
      }
    }
    return '';
  };

  // Enhanced metadata extraction
  const title = getContent(titleSelectors) || document.title.split(' - YouTube')[0];
  const channel = getContent(channelSelectors);
  const description = getContent(descriptionSelectors);
  const url = window.location.href;

  // Additional metadata
  const tags = Array.from(document.querySelectorAll('meta[property="og:video:tag"]')).map(tag => tag.content);
  const category = document.querySelector('meta[itemprop="genre"]')?.content || '';
  const publishDate = document.querySelector('meta[itemprop="datePublished"]')?.content || '';

  // Get view count and like count if available
  const viewCount = document.querySelector('#count .view-count')?.textContent?.trim() || '';
  const likeCount = document.querySelector('#top-level-buttons-computed yt-formatted-string')?.textContent?.trim() || '';

  // Enhanced metadata object
  return {
    title,
    channel,
    description,
    url,
    metadata: {
      tags,
      category,
      publishDate,
      viewCount,
      likeCount
    }
  };
}

// Pattern-based content analysis
function analyzeContentPatterns(data) {
  // Defensive coercion to avoid undefined/null values causing `.includes` errors
  data = data || {};
  const titleStr = String(data.title || '');
  const descStr = String(data.description || '');
  const text = (titleStr + ' ' + descStr).toLowerCase();
  const tags = Array.isArray(data.metadata?.tags) ? data.metadata.tags : [];
  const category = String(data.metadata?.category || '').toLowerCase();
  
  // Initialize scores
  const scores = {
    factual: 0,
    misleading: 0,
    satire: 0,
    opinion: 0
  };

  // Pattern matching with context
  const patterns = {
    factual: [
      'documentary', 'report', 'research', 'study', 'evidence', 'analysis', 
      'investigation', 'facts', 'data', 'findings', 'scientific', 'expert',
      'peer-reviewed', 'journal', 'official', 'statistics'
    ],
    misleading: [
      'conspiracy', 'exposed', 'they dont want you to know', 'secret truth',
      'what they hide', 'shocking truth', 'cover up', 'hoax', 'real truth',
      'wake up', 'mainstream media lies', 'banned', 'censored', 'illuminati'
    ],
    satire: [
      'parody', 'satire', 'comedy', 'humor', 'funny', 'joke', 'spoof', 'skit',
      'meme', 'entertainment', 'prank', 'laugh', 'ridiculous', 'hilarious'
    ],
    opinion: [
      'opinion', 'review', 'reaction', 'thoughts', 'perspective', 'commentary',
      'my take', 'i think', 'personal', 'subjective', 'viewpoint', 'reaction',
      'breakdown', 'analysis'
    ]
  };

  // Score based on patterns with null checks
  for (const [catKey, words] of Object.entries(patterns)) {
    for (const word of words) {
      if (titleStr.toLowerCase().includes(word)) scores[catKey] += 3;
      if (descStr.toLowerCase().includes(word)) scores[catKey] += 2;
      if (Array.isArray(tags) && tags.some(tag => String(tag || '').toLowerCase().includes(word))) scores[catKey] += 1;
    }
  }

  // Channel context scoring with safe string checks
  const channelLower = String(data.channel || '').toLowerCase();
  if (channelLower) {
    if (channelLower.includes('news') || channelLower.includes('edu') || channelLower.includes('science')) {
      scores.factual += 3;
    }
    if (channelLower.includes('comedy') || channelLower.includes('entertainment')) {
      scores.satire += 3;
    }
    if (channelLower.includes('vlog') || channelLower.includes('review')) {
      scores.opinion += 3;
    }
  }

  // Category-based scoring
  if (category) {
    if (['news', 'education', 'science', 'documentary'].includes(category)) {
      scores.factual += 3;
    }
    if (['comedy', 'entertainment'].includes(category)) {
      scores.satire += 3;
    }
    if (['people', 'blogs'].includes(category)) {
      scores.opinion += 3;
    }
  }

  // Additional context checks
  const clickbaitPatterns = [
    'you won\'t believe', '!!!!', 'gone wrong', 'must see', '100% proof',
    'shocking', 'mind blowing', 'they don\'t want you to know',
    'watch this before', 'share this before', 'wake up'
  ];
  
  const academicPatterns = [
    'study shows', 'research indicates', 'according to research',
    'evidence suggests', 'data shows', 'scientists found',
    'experts say', 'published in', 'peer reviewed'
  ];

  if (text && clickbaitPatterns.some(p => text.includes(p))) {
    scores.misleading += 3;
  }

  if (text && academicPatterns.some(p => text.includes(p))) {
    scores.factual += 3;
  }

  return scores;
}

// Gemini API analysis
async function analyzeWithGemini(data, apiKey) {
  const prompt = `Analyze this YouTube video content and classify it as FACTUAL, MISLEADING, SATIRE, or OPINION.
  Title: ${data.title}
  Channel: ${data.channel}
  Description: ${data.description}
  Category: ${data.metadata?.category || 'Unknown'}
  Tags: ${data.metadata?.tags?.join(', ') || 'None'}
  
  Provide your analysis in JSON format only:
  {
    "verdict": "FACTUAL|MISLEADING|SATIRE|OPINION",
    "confidence": "high|medium|low",
    "reason": "Brief explanation",
    "scores": {
      "factual": 0-10,
      "misleading": 0-10,
      "satire": 0-10,
      "opinion": 0-10
    }
  }`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  });

  if (!response.ok) {
    throw new Error('Gemini API request failed');
  }

  const result = await response.json();
  return JSON.parse(result.candidates[0].content.parts[0].text);
}

// Google Fact Check API integration
// Uses the Fact Check Tools API: claims:search
async function analyzeWithFactCheck(data, apiKey) {
  if (!apiKey) throw new Error('No Fact Check API key provided');

  // Build a focused query: title + channel
  const query = encodeURIComponent(`${data.title || ''} ${data.channel || ''}`.trim());
  const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${query}&key=${apiKey}`;

  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Fact Check API request failed: ${resp.status} ${txt}`);
  }

  const result = await resp.json();
  const claims = result.claims || [];
  if (!claims.length) return null;

  // Pick the most relevant claim (first result)
  const claim = claims[0];
  const review = (claim.claimReview && claim.claimReview[0]) || null;
  const textualRating = review?.textualRating || review?.textual_rating || '';
  const publisher = review?.publisher?.name || review?.publisher?.site || '';
  const reviewUrl = review?.url || review?.reviewURL || '';

  // Map textualRating to a simple verdict
  const tr = String(textualRating).toLowerCase();
  let verdict = 'UNVERIFIED';
  if (tr.includes('true') || tr.includes('correct') || tr.includes('mostly true')) verdict = 'FACTUAL';
  else if (tr.includes('false') || tr.includes('incorrect') || tr.includes('mostly false')) verdict = 'MISLEADING';
  else if (tr.includes('mixture') || tr.includes('partly') || tr.includes('mixed')) verdict = 'OPINION';
  else if (tr.includes('satire') || tr.includes('parody')) verdict = 'SATIRE';

  // Build a simple scores object using heuristic mapping
  const scores = { factual: 0, misleading: 0, satire: 0, opinion: 0 };
  if (verdict === 'FACTUAL') scores.factual = 9;
  else if (verdict === 'MISLEADING') scores.misleading = 9;
  else if (verdict === 'SATIRE') scores.satire = 9;
  else if (verdict === 'OPINION') scores.opinion = 6;

  return {
    verdict,
    confidence: review ? 'high' : 'low',
    reason: `Fact Check: ${textualRating || 'No rating'} by ${publisher || 'unknown'}${reviewUrl ? ` (${reviewUrl})` : ''}`,
    scores,
    raw: claim
  };
}

// Helper function to get verdict color
function getVerdictColor(verdict) {
  switch (verdict) {
    case 'FACTUAL': return '#4bff7b';
    case 'MISLEADING': return '#ff4b4b';
    case 'SATIRE': return '#ffbb4b';
    case 'OPINION': return '#4bbaff';
    default: return '#fff';
  }
}

// Convert pattern scores to analysis result
function getAnalysisFromScores(scores) {
  const maxScore = Math.max(...Object.values(scores));
  const found = Object.entries(scores).find(([_, score]) => score === maxScore);
  const verdict = found && found[0] ? String(found[0]).toUpperCase() : 'UNVERIFIED';

  return {
    verdict,
    confidence: maxScore > 8 ? 'high' : maxScore > 5 ? 'medium' : 'low',
    reason: `Analysis based on content patterns and metadata`,
    scores
  };
}

// Analyze current video with retry logic
async function analyzeCurrentVideo(retryCount = 0) {
  const banner = document.getElementById('aegis-analysis-banner') || createAnalysisBanner();
  const statusText = document.getElementById('aegis-status-text');
  const verdictText = document.getElementById('aegis-verdict-text');
  
  banner.style.display = 'flex';
  statusText.textContent = 'Analyzing video...';
  verdictText.textContent = '';

  try {
    const metadata = extractVideoMetadata();
    
    // Check cache first
    const cached = analysisCache.get(metadata.url);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      statusText.textContent = 'Analysis complete:';
      verdictText.textContent = cached.verdict;
      verdictText.style.color = getVerdictColor(cached.verdict);
      return;
    }

    // If we don't have enough metadata, wait and retry
    if (!metadata.title || !metadata.channel) {
      if (retryCount < 2) {
        statusText.textContent = 'Waiting for video data...';
        await new Promise(resolve => setTimeout(resolve, 2000));
        return analyzeCurrentVideo(retryCount + 1);
      } else {
        throw new Error('Could not load video data');
      }
    }

    // Get pattern-based scores
    const scores = analyzeContentPatterns(metadata);
    
    // Try Google Fact Check analysis using provided API key
    let finalAnalysis;
    try {
      finalAnalysis = await analyzeWithFactCheck(metadata, FACT_CHECK_API_KEY);
      if (!finalAnalysis) throw new Error('No relevant fact-check found');
    } catch (error) {
      console.log('Falling back to pattern analysis:', error);
      finalAnalysis = getAnalysisFromScores(scores);
    }

    // Update UI with results
    statusText.textContent = 'Analysis complete:';
    verdictText.textContent = finalAnalysis.verdict;
    verdictText.style.color = getVerdictColor(finalAnalysis.verdict);

    // Store in cache and extension storage
    analysisCache.set(metadata.url, {
      timestamp: Date.now(),
      ...finalAnalysis
    });

    chrome.storage.local.set({
      currentYouTubeAnalysis: {
        metadata,
        // keep compatibility fields expected by popup
        quickVerdict: finalAnalysis.verdict,
        fullAnalysis: finalAnalysis.reason || JSON.stringify(finalAnalysis.raw || {}),
        // preserve other data
        verdict: finalAnalysis.verdict,
        reason: finalAnalysis.reason,
        scores: finalAnalysis.scores,
        raw: finalAnalysis.raw,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    statusText.textContent = 'Analysis failed:';
    verdictText.textContent = error.message || 'Unknown error';
    verdictText.style.color = '#ff4b4b';
  }
}

// Watch for video changes
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (location.href.includes('youtube.com/watch')) {
      setTimeout(analyzeCurrentVideo, 1000);
    } else {
      const banner = document.getElementById('aegis-analysis-banner');
      if (banner) banner.style.display = 'none';
    }
  }
}).observe(document, { subtree: true, childList: true });

// Handle extension messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract-youtube') {
    try {
      const metadata = extractVideoMetadata();
      const scores = analyzeContentPatterns(metadata);
      sendResponse({ 
        success: true, 
        metadata,
        analysis: getAnalysisFromScores(scores)
      });
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    return true;
  }
});

// Initial check for video page
if (location.href.includes('youtube.com/watch')) {
  setTimeout(analyzeCurrentVideo, 1000);
}
