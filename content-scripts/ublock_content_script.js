// uBlock content script (adapted) - relies on ublock_integration.js being injected first
(function(){
  'use strict';

  // If UBlockIntegration is not available, create a minimal stub
  const Integration = typeof UBlockIntegration !== 'undefined' ? UBlockIntegration : class { constructor(){ this.filterLists = new Map(); } getStats(){ return {}; } };

  class UBlockContentScript {
    constructor(){
      this.integration = new Integration();
      this.cosmeticFilters = [];
      this.blockedElements = new Set();
      this.observer = null;
      this.setupDOMObserver();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>this.onPageLoad()); else this.onPageLoad();
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=> this.handleMessage(msg, sender, sendResponse));
    }
    handleMessage(message, sender, sendResponse){
      try{
        switch(message.type){
          case 'ublock_applyCosmeticFilters': this.applyCosmeticFilters(); sendResponse({success:true}); break;
          case 'ublock_blockElement': this.blockElement(message.selector); sendResponse({success:true}); break;
          case 'ublock_unblockElement': this.unblockElement(message.selector); sendResponse({success:true}); break;
          default: sendResponse({success:false, error:'Unknown message type'});
        }
      }catch(e){ console.error(e); sendResponse({success:false, error:e.message}); }
    }
    setupDOMObserver(){
      this.observer = new MutationObserver(muts=> muts.forEach(m=>{ if (m.type==='childList') m.addedNodes.forEach(n=>{ if (n.nodeType===1) this.checkElementForBlocking(n); }); }));
      try{ this.observer.observe(document.body, { childList:true, subtree:true }); }catch(e){}
    }
    onPageLoad(){ this.applyCosmeticFilters(); this.checkExistingElements(); }
    checkExistingElements(){ document.querySelectorAll('*').forEach(el=> this.checkElementForBlocking(el)); }
    checkElementForBlocking(el){ if (!el) return; for (const f of this.cosmeticFilters) { if (f.type==='cosmetic' && this.matchesSelector(el, f.pattern.substring(2))) { this.blockElementByFilter(el,f); return; } } }
    matchesSelector(el, selector){ try{ if (selector.includes(',')) return selector.split(',').some(s=> el.matches(s.trim())); return el.matches(selector); }catch(e){ return false; } }
    blockElementByFilter(el, filter){ if (filter.pattern.startsWith('#@#')) return; this.blockElement(el); }
    blockElement(elementOrSelector){ let el = typeof elementOrSelector==='string'? document.querySelector(elementOrSelector): elementOrSelector; if (!el) return; el.style.setProperty('display','none','important'); el.setAttribute('data-ublock-blocked','true'); this.blockedElements.add(el); }
    unblockElement(elementOrSelector){ let el = typeof elementOrSelector==='string'? document.querySelector(elementOrSelector): elementOrSelector; if (!el) return; el.style.removeProperty('display'); el.removeAttribute('data-ublock-blocked'); this.blockedElements.delete(el); }
    applyCosmeticFilters(){
      const allFilters = [];
      for (const [k, filters] of this.integration.filterLists) allFilters.push(...filters.filter(f=> f.type==='cosmetic'));
      this.cosmeticFilters = allFilters;
      this.checkExistingElements();
    }
    getStats(){ return { cosmeticFilters:this.cosmeticFilters.length, blockedElements:this.blockedElements.size, integrationStats: this.integration.getStats ? this.integration.getStats() : {} }; }
    destroy(){ if (this.observer) this.observer.disconnect(); }
  }

  const ublockContentScript = new UBlockContentScript();
  window.addEventListener('beforeunload', ()=> ublockContentScript.destroy());

})();
