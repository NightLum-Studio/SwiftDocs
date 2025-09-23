// SwiftDocs Core Functionality
// Provides dynamic documentation system capabilities including:
// - Language management and switching
// - Markdown content loading and rendering
// - UI localization
// - YAML-based configuration
// Supports deployment both locally and on GitHub Pages

// Global state variables
let currentLang = "en";       // Current selected language code
let currentPath = "md/en";    // Path to Markdown files for the current language
let baseURL = "";             // Base URL to support GitHub Pages deployment
  
// === Detect environment and set base URL dynamically ===
// If running on GitHub Pages, the repository name becomes the base URL
if (window.location.hostname.endsWith("github.io")) {
  const parts = window.location.pathname.split('/');
  if (parts.length > 1) baseURL = parts[1];
} else {
  // For local environment, leave baseURL empty
  baseURL = "";
}

/**
 * Fetches a YAML file and parses its contents
 * @param {string} file - Relative path to the YAML file
 * @returns {Promise<Object>} - Parsed YAML object
 * Uses cache-busting to prevent stale data from being loaded
 */
async function fetchYaml(file) {
  const res = await fetch(`${baseURL}/${file}?v=${Date.now()}`);
  return jsyaml.load(await res.text());
}

/**
 * Parses a detail string with inline styling for color, bold, italic, underline
 * Syntax: @[prefix?#color;style1;style2[Text]]
 * @param {string} detailText - Input string containing styling markers
 * @returns {string} HTML string with inline styling
 */
function parseDetailContent(detailText) {
  if (!detailText) return '';

  let result = detailText;

  // Regex to match style markers
  result = result.replace(
      /@\[([^#;]*)?(#[0-9a-fA-F]{3,6})?;?([^\]]*)\[([^\]]+)\]\]/g,
      function(match, prefix, color, styles, text) {
        let styleString = '';

        if (color) styleString += `color: ${color};`;

        if (styles) {
          const styleCommands = styles.split(';').map(cmd => cmd.trim());
          if (styleCommands.includes('bold')) styleString += 'font-weight: bold;';
          if (styleCommands.includes('italic')) styleString += 'font-style: italic;';
          if (styleCommands.includes('underline')) styleString += 'text-decoration: underline;';
        }

        // Wrap styled text in a span, otherwise return plain text
        return styleString
            ? `<span style="${styleString}">${text}</span>`
            : text;
      }
  );

  // Convert newline characters to HTML <br>
  return result.replace(/\n/g, '<br>');
}

/**
 * Loads the documentation menu from docs.yaml and renders it
 * Supports nested hierarchy and dynamic detail panels
 */
async function loadMenu() {
  const docs = await fetchYaml("docs.yaml");
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  // Map to store document references for hierarchy
  const docMap = new Map();
  const rootItems = [];

  // First pass: initialize map with all documents
  docs.forEach(item => {
    docMap.set(item.key, { ...item, children: [] });
  });

  // Second pass: construct hierarchy based on "branch" property
  docs.forEach(item => {
    if (item.branch && docMap.has(item.branch)) {
      docMap.get(item.branch).children.push(docMap.get(item.key));
    } else {
      rootItems.push(docMap.get(item.key));
    }
  });

  let currentFile = '';

  // Updates the detail panel based on selected item
  function updateDetailPanel(detailContent) {
    const detailPanel = document.querySelector('.detail-panel');
    if (detailPanel && detailContent) {
      detailPanel.innerHTML = `<h2>Details</h2><p>${parseDetailContent(detailContent)}</p>`;
    } else if (detailPanel) {
      detailPanel.innerHTML = `<h2>Details</h2><p>No information available</p>`;
    }
  }

  // Recursively render menu items including nested children
  function renderMenuItems(items, level = 0) {
    items.forEach(item => {
      const a = document.createElement("a");
      a.textContent = item.titles[currentLang] || item.file;
      a.dataset.key = item.key;
      a.dataset.file = item.file;
      a.dataset.detail = item.detail || '';

      a.onclick = () => {
        loadPage(`${currentPath}/${item.file}`);
        setActiveMenuItem(item.file);
        updateDetailPanel(item.detail);
      };

      // Visual indentation for nested levels
      if (level > 0) {
        a.style.paddingLeft = (level * 20) + "px";
        a.style.fontSize = (16 - level * 2) + "px";
        a.style.opacity = 1 - (level * 0.2);
      }

      menuDiv.appendChild(a);

      if (item.children && item.children.length > 0) {
        renderMenuItems(item.children, level + 1);
      }
    });
  }

  renderMenuItems(rootItems);

  // Highlight the currently active menu item
  function setActiveMenuItem(file) {
    currentFile = file;
    const menuItems = menuDiv.querySelectorAll('a');
    menuItems.forEach(item => {
      if (item.dataset.file === file) {
        item.classList.add('active');
        updateDetailPanel(item.dataset.detail);
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Load the first document by default
  if (docs.length) {
    const firstFile = `${currentPath}/${docs[0].file}`;
    loadPage(firstFile);
    setActiveMenuItem(docs[0].file);
  }

  // Expose utility functions globally
  window.setActiveMenuItem = setActiveMenuItem;
  window.updateDetailPanel = updateDetailPanel;
}

/**
 * Loads and renders Markdown content using marked.js
 * Adds cache-busting to avoid stale content
 * @param {string} file - Path to Markdown file
 */
async function loadPage(file) {
  try {
    const res = await fetch(`${baseURL}/${file}?v=${Date.now()}`);
    document.getElementById("content").innerHTML = res.ok
        ? marked.parse(await res.text())
        : "<p>Failed to load file.</p>";
  } catch {
    document.getElementById("content").innerHTML = "<p>Error loading page.</p>";
  }
}

/**
 * Loads supported languages from languages.yaml and populates a dropdown
 * Handles dynamic switching of language and content paths
 */
async function loadLanguages() {
  const langs = await fetchYaml("languages.yaml");
  const select = document.getElementById("lang-select");

  langs.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.dataset.path = l.path;
    opt.textContent = l.name;
    select.appendChild(opt);
  });

  select.onchange = () => {
    const sel = select.selectedOptions[0];
    currentLang = sel.value;
    currentPath = sel.dataset.path;
    reloadAll();
  };

  // Initialize default language
  if (langs.length) {
    currentLang = langs[0].code;
    currentPath = langs[0].path;
    reloadAll();
  }
}

/**
 * Loads UI translations from ui.yaml
 * Updates navigation and sidebar elements dynamically
 */
async function loadUI() {
  const ui = await fetchYaml("ui.yaml");
  document.getElementById("sidebar-title").textContent = ui.ui.documentation[currentLang];
  document.getElementById("nav-home").textContent = ui.ui.home[currentLang];
  document.getElementById("nav-examples").textContent = ui.ui.examples[currentLang];
}

/**
 * Reloads all dynamic content (menu and UI)
 * Should be called after language change
 */
function reloadAll() {
  loadMenu();
  loadUI();
}

/**
 * Initializes the application
 * - Sets up theme toggle
 * - Loads language resources
 */
async function initApp() {
  const toggle = document.getElementById("theme-toggle");
  const themeLink = document.getElementById("theme-style");

  if (!themeLink || !toggle) {
    await loadLanguages();
    return;
  }

  function applyTheme(themeName, persist = false) {
    const href = `css/${themeName}.css?v=${Date.now()}`;
    themeLink.setAttribute("href", href);
    if (persist) localStorage.setItem("theme", themeName);
    console.log("[Theme] applied:", themeName, "->", href);
  }

  let saved = localStorage.getItem("theme");
  if (saved !== "dark" && saved !== "light") saved = null;
  const initialTheme = saved || "dark";

  applyTheme(initialTheme, false);
  toggle.checked = (initialTheme === "dark");

  toggle.addEventListener("change", () => {
    const theme = toggle.checked ? "dark" : "light";
    applyTheme(theme, true);
  });

  await loadLanguages();
}

// Initialize app after DOM is fully loaded
document.addEventListener("DOMContentLoaded", initApp);
