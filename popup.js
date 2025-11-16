const viewContainer = document.getElementById('view-container');
const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const modalTemplate = document.getElementById('modal-template');

hamburger.addEventListener('click', ()=> sidebar.classList.toggle('open'));

document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', async () => {
    const page = li.dataset.page;
    await loadPage(page);
    sidebar.classList.remove('open'); // Close sidebar after navigation
  });
});

// Settings button handler
document.getElementById('settings-btn').addEventListener('click', async () => {
  await loadPage('settings');
  sidebar.classList.remove('open');
});

async function loadPage(name){
  console.log('Loading page:', name);
  const res = await fetch(`pages/${name}.html`);
  const html = await res.text();
  
  // Parse the HTML to extract content without script tags
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove all script tags from the HTML
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(s => s.remove());
  
  // Insert HTML content without scripts
  viewContainer.innerHTML = doc.body.innerHTML;
  
  // Remove any existing page script BEFORE loading new one
  const existing = document.getElementById('page-script');
  if (existing) {
    existing.remove();
    console.log('Removed existing page script');
    // Wait a moment to ensure the script is fully unloaded
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Load external JavaScript file for this page
  const scriptUrl = `pages/js/${name}.js`;
  
  // Create and load the new script
  const script = document.createElement('script');
  script.src = scriptUrl + '?t=' + Date.now(); // Add timestamp to prevent caching
  script.id = 'page-script';
  script.onload = () => console.log(`Page ${name} script loaded successfully`);
  script.onerror = () => console.warn(`No external script found for ${name} (${scriptUrl})`);
  document.body.appendChild(script);
  
  console.log(`Page ${name} HTML loaded, loading script from ${scriptUrl}`);
}

// Expose loadPage globally for use in pages
window.loadPage = loadPage;

// Apply saved color scheme on load (support legacy `colorScheme` and new keys)
chrome.storage.sync.get(['colorScheme','backgroundColor','trim'], (result) => {
  const bg = result.backgroundColor || null;
  const trim = result.trim || null;
  const legacy = result.colorScheme || null;

  if (bg || trim) {
    applyColorScheme({background: bg, trim: trim});
    return;
  }

  // fallback to legacy single key
  const scheme = legacy || 'purple';
  applyColorScheme(scheme);
});

function applyColorScheme(scheme) {
  const root = document.documentElement;

  // If scheme is an object: {background, trim}
  if (scheme && typeof scheme === 'object') {
    const bg = scheme.background;
    const trim = scheme.trim;
    if (bg && typeof bg === 'string' && bg.startsWith('#')) {
      root.style.setProperty('--bg', bg);
    }
    if (trim && typeof trim === 'string') {
      switch(trim) {
        case 'blue':
          root.style.setProperty('--accent', '#3b82f6');
          break;
        case 'green':
          root.style.setProperty('--accent', '#10b981');
          break;
        case 'red':
          root.style.setProperty('--accent', '#ef4444');
          break;
        default:
          root.style.setProperty('--accent', '#7b4bff');
      }
    }
    return;
  }

  // If scheme looks like a hex color, treat it as a custom accent (legacy behavior)
  if (typeof scheme === 'string' && scheme.startsWith('#')) {
    root.style.setProperty('--accent', scheme);
    return;
  }

  // otherwise treat scheme as a preset name and set both accent and background
  switch(scheme) {
    case 'blue':
      root.style.setProperty('--accent', '#3b82f6');
      root.style.setProperty('--bg', '#0f172a');
      root.style.setProperty('--panel', '#1e293b');
      break;
    case 'green':
      root.style.setProperty('--accent', '#10b981');
      root.style.setProperty('--bg', '#064e3b');
      root.style.setProperty('--panel', '#065f46');
      break;
    case 'red':
      root.style.setProperty('--accent', '#ef4444');
      root.style.setProperty('--bg', '#7f1d1d');
      root.style.setProperty('--panel', '#991b1b');
      break;
    default:
      root.style.setProperty('--accent', '#7b4bff');
      root.style.setProperty('--bg', '#1b0b2a');
      root.style.setProperty('--panel', '#2b0f3d');
  }
}

// Expose applyColorScheme globally for use in pages
window.applyColorScheme = applyColorScheme;

// Listen for color scheme changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.backgroundColor) {
    applyColorScheme({background: changes.backgroundColor.newValue});
  }
  if (changes.trim) {
    applyColorScheme({trim: changes.trim.newValue});
  }
  if (changes.colorScheme) {
    // legacy key changed — preserve previous semantics
    const v = changes.colorScheme.newValue;
    applyColorScheme(v);
  }
});

// modal helper
function showModal(htmlContent){
  const node = modalTemplate.content.cloneNode(true);
  node.querySelector('.modal-body').innerHTML = htmlContent;
  const el = node.querySelector('.modal-overlay');
  el.querySelector('.modal-close').addEventListener('click', ()=> el.remove());
  document.body.appendChild(el);
}
// expose to pages
window.showModal = showModal;

// initially load home
loadPage('home');
