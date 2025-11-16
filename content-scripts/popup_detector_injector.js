// Injector content script - injects page-context scripts into the main world
(function(){
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('content-scripts/popup_detector.js');
    s.onload = function(){ this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.error('Injector failed to inject popup_detector:', e);
  }
})();
