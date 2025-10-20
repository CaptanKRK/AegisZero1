// Ad Blocker Content Script
// This is where you put your ad blocking code

// Common ad selectors and patterns
const AD_SELECTORS = [
  // Common ad containers
  '[id*="ad-"]', '[class*="ad-"]', '[id*="advertisement"]', '[class*="advertisement"]',
  '[id*="banner"]', '[class*="banner"]', '[id*="sponsor"]', '[class*="sponsor"]',
  '[id*="promo"]', '[class*="promo"]', '[id*="popup"]', '[class*="popup"]',
  
  // Google AdSense
  '.adsbygoogle', '.google-ads', '.adsense',
  
  // Facebook/Meta ads
  '[data-testid*="ad"]', '[aria-label*="ad"]',
  
  // Common ad networks
  '.doubleclick', '.googlesyndication', '.amazon-ads',
  
  // Video ads
  '.video-ad', '.pre-roll', '.mid-roll', '.post-roll',
  
  // Popup/overlay ads
  '.modal-ad', '.overlay-ad', '.lightbox-ad',
  
  // Social media ads
  '.twitter-ad', '.facebook-ad', '.instagram-ad'
];

// Popup blocking patterns
const POPUP_PATTERNS = [
  'window.open',
  'showModal',
  'alert',
  'confirm',
  'prompt'
];

let blockedCount = 0;
let adBlockedCount = 0;

// Initialize ad blocker
function initAdBlocker() {
  chrome.storage.sync.get(['adBlockerEnabled', 'adRules'], (result) => {
    if (result.adBlockerEnabled) {
      startAdBlocking(result.adRules || '');
    }
  });
}

// Start ad blocking
function startAdBlocking(customRules = '') {
  console.log('AEGIS Ad Blocker: Starting ad blocking...');
  
  // Block existing ads
  blockExistingAds();
  
  // Set up mutation observer for dynamic content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          checkAndBlockAd(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Block popups
  blockPopups();
  
  // Apply custom rules
  if (customRules) {
    applyCustomRules(customRules);
  }
}

// Block existing ads on page load
function blockExistingAds() {
  AD_SELECTORS.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      blockAdElement(element);
    });
  });
}

// Check and block individual elements
function checkAndBlockAd(element) {
  // Check against standard selectors
  AD_SELECTORS.forEach(selector => {
    if (element.matches && element.matches(selector)) {
      blockAdElement(element);
      return;
    }
  });
  
  // Check children
  AD_SELECTORS.forEach(selector => {
    const children = element.querySelectorAll(selector);
    children.forEach(child => {
      blockAdElement(child);
    });
  });
  
  // Check for ad-like attributes
  if (isAdLikeElement(element)) {
    blockAdElement(element);
  }
}

// Determine if element looks like an ad
function isAdLikeElement(element) {
  const text = element.textContent.toLowerCase();
  const src = element.src ? element.src.toLowerCase() : '';
  const href = element.href ? element.href.toLowerCase() : '';
  
  const adKeywords = [
    'advertisement', 'ad', 'sponsor', 'promo', 'banner',
    'click here', 'buy now', 'limited time', 'special offer',
    'doubleclick', 'googlesyndication', 'amazon-ads'
  ];
  
  return adKeywords.some(keyword => 
    text.includes(keyword) || src.includes(keyword) || href.includes(keyword)
  );
}

// Block an ad element
function blockAdElement(element) {
  if (element && !element.hasAttribute('data-aegis-blocked')) {
    element.style.display = 'none';
    element.setAttribute('data-aegis-blocked', 'true');
    adBlockedCount++;
    updateBlockingStats();
    console.log('AEGIS Ad Blocker: Blocked ad element', element);
  }
}

// Block popups
function blockPopups() {
  // Override window.open
  const originalOpen = window.open;
  window.open = function(url, name, specs) {
    chrome.storage.sync.get(['popupBlockerEnabled'], (result) => {
      if (result.popupBlockerEnabled) {
        blockedCount++;
        updateBlockingStats();
        console.log('AEGIS Ad Blocker: Blocked popup to', url);
        return null; // Block the popup
      } else {
        return originalOpen.call(window, url, name, specs);
      }
    });
  };
  
  // Block alert/confirm/prompt
  const originalAlert = window.alert;
  const originalConfirm = window.confirm;
  const originalPrompt = window.prompt;
  
  window.alert = function(message) {
    chrome.storage.sync.get(['popupBlockerEnabled'], (result) => {
      if (result.popupBlockerEnabled) {
        console.log('AEGIS Ad Blocker: Blocked alert:', message);
        return;
      } else {
        return originalAlert.call(window, message);
      }
    });
  };
  
  window.confirm = function(message) {
    chrome.storage.sync.get(['popupBlockerEnabled'], (result) => {
      if (result.popupBlockerEnabled) {
        console.log('AEGIS Ad Blocker: Blocked confirm:', message);
        return false;
      } else {
        return originalConfirm.call(window, message);
      }
    });
  };
  
  window.prompt = function(message, defaultText) {
    chrome.storage.sync.get(['popupBlockerEnabled'], (result) => {
      if (result.popupBlockerEnabled) {
        console.log('AEGIS Ad Blocker: Blocked prompt:', message);
        return null;
      } else {
        return originalPrompt.call(window, message, defaultText);
      }
    });
  };
}

// Apply custom blocking rules
function applyCustomRules(rules) {
  const ruleLines = rules.split('\n').filter(line => line.trim());
  
  ruleLines.forEach(rule => {
    try {
      if (rule.startsWith('#')) {
        // CSS selector rule
        const elements = document.querySelectorAll(rule);
        elements.forEach(element => {
          blockAdElement(element);
        });
      } else if (rule.startsWith('@')) {
        // URL pattern rule
        const pattern = rule.substring(1);
        if (window.location.href.includes(pattern)) {
          // Block all ads on this page
          blockExistingAds();
        }
      }
    } catch (e) {
      console.warn('AEGIS Ad Blocker: Invalid rule:', rule, e);
    }
  });
}

// Update blocking statistics
function updateBlockingStats() {
  chrome.storage.sync.get(['blockingStats'], (result) => {
    const stats = result.blockingStats || {popups: 0, ads: 0};
    stats.popups = blockedCount;
    stats.ads = adBlockedCount;
    chrome.storage.sync.set({blockingStats: stats});
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'toggle-ad-blocker') {
    if (msg.enabled) {
      startAdBlocking();
    } else {
      // Re-enable blocked elements
      document.querySelectorAll('[data-aegis-blocked]').forEach(element => {
        element.style.display = '';
        element.removeAttribute('data-aegis-blocked');
      });
    }
  }
});

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdBlocker);
} else {
  initAdBlocker();
}

// YOUR CUSTOM AD BLOCKER CODE GOES HERE
// ======================================
// 
// This is where you can add your specific ad blocking logic:
// 
// 1. Custom ad detection algorithms
// 2. Machine learning-based ad detection
// 3. Specific website ad blocking rules
// 4. Advanced popup detection
// 5. Video ad blocking
// 6. Social media ad blocking
// 
// Example custom code:
// 
// function customAdDetection(element) {
//   // Your custom ad detection logic here
//   // Return true if element is an ad
// }
// 
// function blockVideoAds() {
//   // Your video ad blocking logic here
// }
// 
// function blockSocialMediaAds() {
//   // Your social media ad blocking logic here
// }
