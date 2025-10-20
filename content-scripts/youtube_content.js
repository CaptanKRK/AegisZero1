// YouTube content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg.action === 'extract-youtube'){
    try {
      const title = document.querySelector('h1.title')?.innerText || document.title;
      const channel = document.querySelector('#channel-name')?.innerText || document.querySelector('ytd-channel-name')?.innerText || '';
      const desc = document.querySelector('#description')?.innerText || '';
      const data = {title, channel, desc, url:location.href};
      chrome.runtime.sendMessage({action:'classify-youtube', data}, (response) => sendResponse(response));
      return true;
    } catch(e){ sendResponse({error:e.message}); }
  }
});
