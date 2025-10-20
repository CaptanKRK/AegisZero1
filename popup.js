const viewContainer = document.getElementById('view-container');
const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const modalTemplate = document.getElementById('modal-template');

hamburger.addEventListener('click', ()=> sidebar.classList.toggle('open'));

document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', async () => {
    const page = li.dataset.page;
    await loadPage(page);
  });
});

async function loadPage(name){
  const res = await fetch(`pages/${name}.html`);
  const html = await res.text();
  viewContainer.innerHTML = html;
  // Load page-specific script if present
  const scriptUrl = `pages/js/${name}.js`;
  const existing = document.getElementById('page-script');
  if(existing) existing.remove();
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.id = 'page-script';
  document.body.appendChild(script);
}

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
