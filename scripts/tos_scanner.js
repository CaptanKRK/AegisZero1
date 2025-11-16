// ToS Scanner shared class
class ToSScanner {
  constructor() {
    this.isToSPage = false;
    this.scanResults = null;
    this.analysisInProgress = false;
  }

  detectToSPage(url, title, bodyText) {
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

    url = url?.toLowerCase() || '';
    title = title?.toLowerCase() || '';
    bodyText = bodyText?.toLowerCase() || '';

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
    return this.isToSPage;
  }

  extractToSContent(doc) {
    if (!doc && typeof document !== 'undefined') doc = document;
    if (!doc) return '';
    
    let content = '';
    const contentSelectors = ['main','article','.content','.main-content','.terms-content','.legal-content','#content'];
    for (const selector of contentSelectors) {
      const el = doc.querySelector(selector);
      if (el?.innerText && el.innerText.length > content.length) content = el.innerText;
    }
    if (!content || content.length < 100) content = doc.body?.innerText || '';
    return content.substring(0, 50000);
  }

  performAnalysis(content) {
    if (!content) return null;
    
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
      } else {
        // Still add to max score even if no match
        riskScore.max += 10;
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
}

// Export for multiple environments: Node, window (page), and workers (self)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToSScanner;
} else if (typeof window !== 'undefined') {
  window.ToSScanner = ToSScanner;
} else if (typeof self !== 'undefined') {
  // service worker / worker global
  self.ToSScanner = ToSScanner;
}