// background service worker - supports both Flask and FastAPI servers
const FLASK_SERVER = 'http://localhost:5000';
const FASTAPI_SERVER = 'http://localhost:8000';

// Try Flask first, fallback to FastAPI
async function callServer(endpoint, data) {
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
    callServer('/classify', {type:'youtube', payload: msg.data})
      .then(json => {
        const html = `<h3>YouTube Analysis</h3><p>Verdict: <b>${json.verdict}</b></p><pre>${json.reason}</pre>`;
        sendResponse({html});
      })
      .catch(e => sendResponse({error:e.message}));
    return true;
  } 
  else if(msg.action === 'scan-tos-url'){
    fetch(msg.url)
      .then(response => response.text())
      .then(text => {
        chrome.runtime.sendMessage({action:'analyze-tos', text, url: msg.url}, (response) => {
          sendResponse(response);
        });
      })
      .catch(e => sendResponse({error: e.message}));
    return true;
  } 
  else if(msg.action === 'analyze-tos'){
    callServer('/classify', {type:'tos', payload: {text: msg.text, url: msg.url}})
      .then(json => {
        const html = `<h3>TOS Analysis</h3><p>Verdict: <b>${json.verdict}</b></p><pre>${json.reason}</pre>`;
        sendResponse({html});
      })
      .catch(e => sendResponse({error:e.message}));
    return true;
  } 
  else if(msg.action === 'show-modal'){
    sendResponse({});
  }
});
