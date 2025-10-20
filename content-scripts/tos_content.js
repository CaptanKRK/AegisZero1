// TOS content script - Passive scanner: extract large text content for TOS scanning
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg.action === 'extract-page-text'){
    const text = document.body.innerText || '';
    sendResponse({text, url:location.href});
  }
});
