// eBay content script - listens for message to extract eBay info
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg.action === 'extract-ebay'){
    try {
      const title = document.querySelector('#itemTitle')?.innerText || document.title;
      // pricing selectors may vary
      const price = document.querySelector('.notranslate[itemprop="price"]')?.textContent
                 || document.querySelector('.display-price')?.textContent || '';
      const seller = document.querySelector('.mbg-nw')?.innerText || '';
      const desc = document.querySelector('#desc_ifr') ? document.querySelector('#desc_ifr').contentDocument.body.innerText : (document.querySelector('#viTabs_0_is')?.innerText || '');
      const data = {title, price, seller, desc, url:location.href};
      // send to background for classification
      chrome.runtime.sendMessage({action:'classify-ebay', data}, (response) => {
        sendResponse(response);
      });
      // return true to indicate async response
      return true;
    } catch(e){
      sendResponse({error:e.message});
    }
  }
});
