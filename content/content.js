(function () {
  'use strict';

  if (window.__denimContentLoaded) {
    if (typeof window.__denimApplyNow === 'function') {
      window.__denimApplyNow();
    }
    return;
  }
  window.__denimContentLoaded = true;

  const {
    DEFAULT_SETTINGS,
    resolveEffectiveState,
    getRulesForHostname,
    buildCustomCssText
  } = window.DenimShared;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'HEAD', 'TITLE',
    'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'PICTURE', 'SOURCE',
    'IFRAME', 'EMBED', 'OBJECT', 'BR', 'WBR', 'PATH', 'RECT', 'CIRCLE'
  ]);

  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  let currentState = 'disabled';
  let observer = null;
  let scanScheduled = false;
  let pendingNodes = new Set();

  function getHostname() {
    return (window.location && window.location.hostname || '').toLowerCase();
  }

  function applyCustomStylesheet(rules) {
    const parent = document.head || document.documentElement;
    if (!parent) return;
    let styleEl = document.getElementById('denim-dark-custom-style');

    // Clear previous custom markers
    document.querySelectorAll('[data-denim-custom]').forEach((el) => {
      el.removeAttribute('data-denim-custom');
    });

    if (!rules || rules.length === 0) {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'denim-dark-custom-style';
      parent.appendChild(styleEl);
    }

    styleEl.textContent = buildCustomCssText(rules);

    // Mark matching elements so adaptive engine won't overwrite custom rules
    for (const rule of rules) {
      if (!rule || !rule.selector) continue;
      try {
        document.querySelectorAll(rule.selector).forEach((el) => {
          el.setAttribute('data-denim-custom', 'true');
        });
      } catch {
        // Ignore invalid custom CSS selector
      }
    }
  }

  function clearAdaptiveAttributes() {
    document.querySelectorAll('[data-denim-bg], [data-denim-text], [data-denim-border]').forEach((el) => {
      el.removeAttribute('data-denim-bg');
      el.removeAttribute('data-denim-text');
      el.removeAttribute('data-denim-border');
    });
  }

  function parseRgba(str) {
    if (!str || str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i);
    if (!m) return null;
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1
    };
  }

  function luminance(c) {
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }

  function analyzeElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.id === 'denim-dark-picker-host' || el.id === 'denim-dark-modal-host') return;
    if (el.hasAttribute('data-denim-custom')) return;
    if (el.closest && (el.closest('#denim-dark-picker-host') || el.closest('#denim-dark-modal-host') || el.closest('svg'))) {
      return;
    }

    const cs = window.getComputedStyle(el);
    if (!cs) return;

    // 1. Background luminance check
    const bg = parseRgba(cs.backgroundColor);
    const hasBgImage = cs.backgroundImage && cs.backgroundImage !== 'none';

    if (bg && bg.a > 0.15 && !hasBgImage) {
      const lum = luminance(bg);
      if (lum > 140) {
        const tag = el.tagName;
        const hasShadow = cs.boxShadow && cs.boxShadow !== 'none';
        const radius = parseFloat(cs.borderRadius) || 0;
        const role = el.getAttribute('role') || '';

        if (tag === 'BODY' || tag === 'MAIN') {
          el.setAttribute('data-denim-bg', 'main');
        } else if (tag === 'HEADER' || tag === 'NAV' || tag === 'ASIDE' || tag === 'FOOTER') {
          el.setAttribute('data-denim-bg', 'surface');
        } else if (hasShadow || radius >= 6 || role === 'dialog' || role === 'menu') {
          el.setAttribute('data-denim-bg', 'card');
        } else if (el.parentElement && el.parentElement.hasAttribute('data-denim-bg')) {
          el.setAttribute('data-denim-bg', 'surface');
        } else {
          el.setAttribute('data-denim-bg', 'main');
        }
      }
    }

    // 2. Text color luminance check
    const fg = parseRgba(cs.color);
    if (fg && fg.a > 0.15) {
      const lum = luminance(fg);
      if (lum < 115) {
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const size = parseFloat(cs.fontSize) || 14;
        if (/^H[1-6]$/.test(el.tagName) || weight >= 600) {
          el.setAttribute('data-denim-text', 'bright');
        } else if (size <= 11.5) {
          el.setAttribute('data-denim-text', 'dim');
        } else {
          el.setAttribute('data-denim-text', 'bright');
        }
      }
    }

    // 3. Harsh light border softening
    const borderW = parseFloat(cs.borderTopWidth) || parseFloat(cs.borderBottomWidth) || 0;
    if (borderW > 0) {
      const bc = parseRgba(cs.borderTopColor || cs.borderBottomColor);
      if (bc && bc.a > 0.2 && luminance(bc) > 135) {
        el.setAttribute('data-denim-border', 'subtle');
      }
    }
  }

  function scanSubtree(rootEl) {
    if (!rootEl || currentState !== 'active') return;
    if (rootEl.nodeType === 1) {
      analyzeElement(rootEl);
    }
    if (!rootEl.querySelectorAll) return;
    const elements = rootEl.querySelectorAll('*');
    const len = elements.length;
    for (let i = 0; i < len; i++) {
      analyzeElement(elements[i]);
    }
  }

  function schedulePendingScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.requestAnimationFrame(() => {
      scanScheduled = false;
      if (currentState !== 'active') {
        pendingNodes.clear();
        return;
      }
      const nodes = Array.from(pendingNodes);
      pendingNodes.clear();
      for (const node of nodes) {
        if (node && node.isConnected) {
          scanSubtree(node);
        }
      }
    });
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver((mutations) => {
      if (currentState !== 'active') return;
      for (const m of mutations) {
        for (const added of m.addedNodes) {
          if (added.nodeType === 1) {
            if (added.id === 'denim-dark-picker-host' || added.id === 'denim-dark-modal-host') continue;
            pendingNodes.add(added);
          }
        }
      }
      if (pendingNodes.size > 0) {
        schedulePendingScan();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    pendingNodes.clear();
  }

  function applyThemeState() {
    const hostname = getHostname();
    currentState = resolveEffectiveState(hostname, currentSettings);
    const rules = getRulesForHostname(hostname, currentSettings.customRules);

    if (currentState === 'disabled') {
      document.documentElement.removeAttribute('data-denim-theme');
      stopObserver();
      clearAdaptiveAttributes();
      applyCustomStylesheet([]);
      return;
    }

    if (currentState === 'active') {
      document.documentElement.setAttribute('data-denim-theme', 'active');
      applyCustomStylesheet(rules);
      if (document.body) {
        scanSubtree(document.body);
      }
      startObserver();
    } else if (currentState === 'custom') {
      const attrVal = currentSettings.customBaseDark ? 'custom-base' : 'custom';
      document.documentElement.setAttribute('data-denim-theme', attrVal);
      stopObserver();
      clearAdaptiveAttributes();
      applyCustomStylesheet(rules);
    }
  }

  async function loadAndApply() {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    currentSettings = Object.assign({}, DEFAULT_SETTINGS, stored);
    applyThemeState();
  }
  window.__denimApplyNow = loadAndApply;

  function openColorModalForElement(targetEl) {
    const hostname = getHostname();
    const existingRules = getRulesForHostname(hostname, currentSettings.customRules);

    window.DenimModal.open({
      targetEl,
      hostname,
      existingRules,
      onSave: async (newRule) => {
        const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
        const settings = Object.assign({}, DEFAULT_SETTINGS, stored);
        const customRules = Object.assign({}, settings.customRules || {});
        const scopeKey = newRule.globalScope ? '*' : hostname;
        const list = Array.isArray(customRules[scopeKey]) ? [...customRules[scopeKey]] : [];

        const cleanRule = {
          id: newRule.id,
          selector: newRule.selector,
          backgroundColor: newRule.backgroundColor,
          color: newRule.color,
          borderColor: newRule.borderColor,
          backdropBlur: Boolean(newRule.backdropBlur),
          enabled: true
        };

        const idx = list.findIndex((r) => r.selector === cleanRule.selector);
        if (idx >= 0) {
          list[idx] = cleanRule;
        } else {
          list.push(cleanRule);
        }

        customRules[scopeKey] = list;

        // Se o site estava desativado quando o usuário personalizou um elemento, ativa o modo Personalizado para esse site
        const siteModes = Object.assign({}, settings.siteModes || {});
        if (resolveEffectiveState(hostname, settings) === 'disabled') {
          siteModes[hostname] = 'custom';
        }

        await chrome.storage.local.set({ customRules, siteModes });
      },
      onDelete: async (selectorToRemove) => {
        const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
        const settings = Object.assign({}, DEFAULT_SETTINGS, stored);
        const customRules = Object.assign({}, settings.customRules || {});

        for (const key of [hostname, hostname.replace(/^www\./, ''), '*']) {
          if (Array.isArray(customRules[key])) {
            customRules[key] = customRules[key].filter((r) => r.selector !== selectorToRemove);
            if (customRules[key].length === 0) {
              delete customRules[key];
            }
          }
        }

        await chrome.storage.local.set({ customRules });
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [k, { newValue }] of Object.entries(changes)) {
      currentSettings[k] = newValue;
    }
    applyThemeState();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'DENIM_APPLY_STATE') {
      loadAndApply().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === 'DENIM_START_PICKER') {
      window.DenimPicker.start((targetEl) => {
        openColorModalForElement(targetEl);
      });
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'DENIM_STOP_PICKER') {
      window.DenimPicker.stop();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'DENIM_GET_STATUS') {
      const hostname = getHostname();
      const rules = getRulesForHostname(hostname, currentSettings.customRules);
      sendResponse({
        hostname,
        effectiveState: currentState,
        rulesCount: rules.length
      });
      return true;
    }

    return false;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyThemeState();
    });
  }

  loadAndApply();
})();
