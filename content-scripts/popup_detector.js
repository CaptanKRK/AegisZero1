// MAXIMUM AGGRESSION POPUP BLOCKER - Injected script intended to run in page context
(function() {
    'use strict';
    // This file is intended to run in the page's main world. It will be injected by the
    // injector content script which appends it as a script tag into the page.

    let blockedCount = 0;
    const originalWindowOpen = window.open;
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;

    function blockedWindowOpen(url, name, features) {
        blockedCount++;
        console.log('🚫 POPUP BLOCKED by Security Scanner:', { url, name, features, blockedCount });
        showBlockedNotification('Popup blocked', url || 'about:blank');

        const event = new CustomEvent('securityScannerPopupBlocked', {
            detail: { url: url || 'about:blank', name: name || '_blank', features: features || 'none', source: 'window.open', domain: window.location.hostname, blockedCount }
        });
        document.dispatchEvent(event);
        return null;
    }

    function blockedAlert(message) {
        blockedCount++;
        showBlockedNotification('Alert blocked', 'JavaScript alert attempt');
        const event = new CustomEvent('securityScannerPopupBlocked', { detail: { type: 'alert', message, source: 'alert', domain: window.location.hostname, blockedCount } });
        document.dispatchEvent(event);
        return undefined;
    }

    function blockedConfirm(message) {
        blockedCount++;
        showBlockedNotification('Confirm blocked', 'JavaScript confirm attempt');
        const event = new CustomEvent('securityScannerPopupBlocked', { detail: { type: 'confirm', message, source: 'confirm', domain: window.location.hostname, blockedCount } });
        document.dispatchEvent(event);
        return false;
    }

    function blockedPrompt(message, defaultText) {
        blockedCount++;
        showBlockedNotification('Prompt blocked', 'JavaScript prompt attempt');
        const event = new CustomEvent('securityScannerPopupBlocked', { detail: { type: 'prompt', message, source: 'prompt', domain: window.location.hostname, blockedCount } });
        document.dispatchEvent(event);
        return null;
    }

    function showBlockedNotification(title, details) {
        try {
            const existing = document.getElementById('securityScannerNotification');
            if (existing) existing.remove();
            const n = document.createElement('div');
            n.id = 'securityScannerNotification';
            n.style.cssText = 'position:fixed;top:20px;right:20px;background:#dc3545;color:white;padding:12px 16px;border-radius:8px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:600;max-width:320px;';
            n.innerHTML = `<div style="display:flex;gap:8px;align-items:center;"><span>🚫</span><div><div>${title}</div><div style="font-size:12px;opacity:0.9;margin-top:4px;">${details||'Blocked by Security Scanner'}</div></div></div>`;
            document.documentElement.appendChild(n);
            setTimeout(() => { n.remove(); }, 3500);
        } catch (e) { /* ignore */ }
    }

    try {
        Object.defineProperty(window, 'open', { value: blockedWindowOpen, writable: false, configurable: false });
        Object.defineProperty(window, 'alert', { value: blockedAlert, writable: false, configurable: false });
        Object.defineProperty(window, 'confirm', { value: blockedConfirm, writable: false, configurable: false });
        Object.defineProperty(window, 'prompt', { value: blockedPrompt, writable: false, configurable: false });
    } catch (err) {
        console.error('Security Scanner: failed to override popup functions', err);
    }

    document.addEventListener('click', function(event) {
        const target = event.target.closest && event.target.closest('a');
        if (target && target.target === '_blank') {
            const href = target.href;
            if (href && !href.startsWith(window.location.origin)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                blockedCount++;
                showBlockedNotification('Link blocked', 'Suspicious external link');
                const blockEvent = new CustomEvent('securityScannerPopupBlocked', { detail: { type: 'link', url: href, source: 'target_blank', domain: window.location.hostname, blockedCount } });
                document.dispatchEvent(blockEvent);
            }
        }
    }, true);

    document.addEventListener('securityScannerExecutePopup', function(event) {
        const { url, name, features } = event.detail || {};
        try { return originalWindowOpen.call(window, url, name, features); } catch (e) { console.error(e); }
    });

})();
