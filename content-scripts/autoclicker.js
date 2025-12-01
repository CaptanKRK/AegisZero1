/**
 * Autoclicker Content Script
 * Executes clicks at the user's last mouse position
 */

let lastMousePos = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  lastMousePos = { x: e.clientX, y: e.clientY };
}, true);

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autoclick' || message.action === 'autoclick_test') {
    const element = document.elementFromPoint(lastMousePos.x, lastMousePos.y);
    
    if (!element) {
      sendResponse({ success: false });
      return;
    }

    // Highlight if requested
    if (message.highlight) {
      const highlight = document.createElement('div');
      highlight.style.cssText = `
        position: fixed;
        width: 40px;
        height: 40px;
        border: 3px solid red;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        left: ${lastMousePos.x - 20}px;
        top: ${lastMousePos.y - 20}px;
      `;
      document.body.appendChild(highlight);
      setTimeout(() => highlight.remove(), 300);
    }

    // Dispatch click
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    sendResponse({ success: true });
  }

  return false;
});


