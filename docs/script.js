/*
 * Static front‑end JavaScript for the Duurzame Kennisbank on GitHub Pages.
 *
 * Instead of talking to a backend API, this script fetches the JSON data
 * directly from the GitHub repository's raw data file. It provides the
 * same search and filter functionality as the dynamic version but can run
 * entirely on GitHub Pages.
 */

// URL of the data.json file in the repository. Using raw.githubusercontent.com
const DATA_URL = 'https://raw.githubusercontent.com/FabianB88/duurzame-kennisbank/main/data.json';

let cachedData = null;

async function getData() {
  if (cachedData) return cachedData;
  const response = await fetch(DATA_URL);
  const data = await response.json();
  cachedData = data;
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  // Remove leading slashes for relative comparisons
  const page = path.split('/').pop() || 'index.html';
  if (page === 'index.html' || page === '') {
    initHome();
  } else if (page === 'resources.html') {
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
    fetchResources(q, type)
      .then((resources) => {
        renderResourceList(resources, resultsDiv);
      })
      .catch((err) => {
        console.error(err);
        resultsDiv.innerHTML = '<p>Er ging iets mis bij het zoeken.</p>';
      });
  });
}

function initResources() {
  const listDiv = document.getElementById('resource-list');
  const filterDiv = document.getElementById('tag-filter');
  getData()
    .then((resources) => {
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
    })
    .catch((err) => {
      console.error(err);
      listDiv.innerHTML = '<p>Kan bronnen niet laden.</p>';
    });
}

function fetchResources(q, type) {
  return getData().then((resources) => {
    let filtered = resources;
    if (q) {
      const term = q.toLowerCase();
      filtered = filtered.filter((r) => (r.title || '').toLowerCase().includes(term) || (r.description || '').toLowerCase().includes(term));
    }
    if (type) {
      const t = type.toLowerCase();
      filtered = filtered.filter((r) => (r.type || '').toLowerCase() === t);
    }
    return filtered;
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
      // On GitHub Pages there is no uploads folder, so file links are not supported
      linkHtml = '';
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
     return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
    .replace(/'/g, '&#39;');
