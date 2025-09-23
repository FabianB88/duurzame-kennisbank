/*
 * Front‑end JavaScript for the Duurzame Kennisbank.
 *
 * This script binds event listeners on the different pages and performs
 * fetch requests to the server's JSON API. It also contains a few helper
 * functions for rendering resources and escaping HTML.
 */

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    initHome();
  } else if (path.startsWith('/upload')) {
    initUpload();
  } else if (path.startsWith('/resources')) {
    initResources();
  }
});

function initHome() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-button');
  const typeSelect = document.getElementById('type-select');
  const resultsDiv = document.getElementById('search-results');
  if (!searchInput || !searchBtn) return;
  searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (!q) {
      resultsDiv.innerHTML = '<p>Vul eerst een zoekterm in.</p>';
      return;
    }
    typeSelect.classList.remove('hidden');
    resultsDiv.innerHTML = '';
  });
  // Delegate event to type buttons
  typeSelect.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const q = searchInput.value.trim();
    const type = btn.dataset.type || '';
    fetchResources(q, type).then((resources) => {
      renderResourceList(resources, resultsDiv);
    }).catch((err) => {
      console.error(err);
      resultsDiv.innerHTML = '<p>Er ging iets mis bij het zoeken.</p>';
    });
  });
}

function initUpload() {
  const form = document.getElementById('upload-form');
  const msg = document.getElementById('upload-message');
  if (!form) return;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    msg.textContent = '';
    const formData = new FormData(form);
    fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
      })
      .then((data) => {
        msg.textContent = 'Upload succesvol!';
        msg.style.color = 'green';
        form.reset();
      })
      .catch((err) => {
        console.error(err);
        msg.textContent = 'Er ging iets mis bij het uploaden.';
        msg.style.color = 'red';
      });
  });
}

function initResources() {
  const listDiv = document.getElementById('resource-list');
  const filterDiv = document.getElementById('tag-filter');
  fetchResources('', '').then((resources) => {
    // Compute unique tags
    const tags = new Set();
    resources.forEach((r) => {
      (r.tags || []).forEach((t) => tags.add(t));
    });
    // Create filter buttons
    const allBtn = document.createElement('button');
    allBtn.textContent = 'Alle';
    allBtn.classList.add('active');
    filterDiv.appendChild(allBtn);
    tags.forEach((tag) => {
      const btn = document.createElement('button');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      filterDiv.appendChild(btn);
    });
    // Display all resources initially
    renderResourceList(resources, listDiv);
    // Filter handler
    filterDiv.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      // Update active states
      Array.from(filterDiv.querySelectorAll('button')).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tag = btn.dataset.tag || '';
      if (!tag) {
        renderResourceList(resources, listDiv);
      } else {
        const filtered = resources.filter((r) => (r.tags || []).map((t) => t.toLowerCase()).includes(tag.toLowerCase()));
        renderResourceList(filtered, listDiv);
      }
    });
  }).catch((err) => {
    console.error(err);
    listDiv.innerHTML = '<p>Kan bronnen niet laden.</p>';
  });
}

function fetchResources(q, type) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  return fetch('/api/resources?' + params.toString())
    .then((r) => {
      if (!r.ok) throw new Error('Request failed');
      return r.json();
    });
}

function renderResourceList(items, container) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<p>Geen resultaten gevonden.</p>';
    return;
  }
  items.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'resource';
    const title = escapeHtml(item.title || '');
    const desc = escapeHtml(item.description || '');
    let linkHtml = '';
    if (item.url) {
      const safeUrl = escapeHtml(item.url);
      linkHtml = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Bekijk bron</a>`;
    } else if (item.file) {
      const safeFile = encodeURIComponent(item.file);
      linkHtml = `<a href="/uploads/${safeFile}" target="_blank" rel="noopener noreferrer">Download</a>`;
    }
    let tagsHtml = '';
    if (item.tags && item.tags.length) {
      tagsHtml = '<p class="tags">Tags: ' + item.tags.map((t) => escapeHtml(t)).join(', ') + '</p>';
    }
    div.innerHTML = `<h3>${title}</h3><p>${desc}</p>${tagsHtml}${linkHtml ? '<p>' + linkHtml + '</p>' : ''}`;
    container.appendChild(div);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}