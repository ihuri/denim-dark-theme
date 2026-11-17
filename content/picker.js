(function () {
  'use strict';

  if (window.DenimPicker) return;

  let active = false;
  let hostEl = null;
  let shadow = null;
  let highlightEl = null;
  let labelEl = null;
  let bannerEl = null;
  let currentTarget = null;
  let selectCallback = null;

  function isExtensionUi(el) {
    if (!el) return false;
    if (el.id === 'denim-dark-picker-host' || el.id === 'denim-dark-modal-host') return true;
    return Boolean(el.closest && (el.closest('#denim-dark-picker-host') || el.closest('#denim-dark-modal-host')));
  }

  function escapeCssIdent(str) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(str);
    return str.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function getCleanClasses(el) {
    if (!el || !el.classList) return [];
    return Array.from(el.classList).filter(
      (c) => c && !c.startsWith('denim-') && c.length < 48 && !/^(hover|focus|active)$/.test(c)
    );
  }

  function generateSpecificSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el === document.body) return 'body';
    if (el === document.documentElement) return 'html';

    if (el.id && !/^\d/.test(el.id)) {
      const idSel = `#${escapeCssIdent(el.id)}`;
      try {
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch {
        // ignore invalid selector
      }
    }

    const parts = [];
    let curr = el;
    let depth = 0;

    while (curr && curr.nodeType === 1 && curr !== document.documentElement && depth < 4) {
      let part = curr.tagName.toLowerCase();
      if (curr.id && !/^\d/.test(curr.id) && depth > 0) {
        part = `#${escapeCssIdent(curr.id)}`;
        parts.unshift(part);
        break;
      }

      const classes = getCleanClasses(curr).slice(0, 2);
      if (classes.length > 0) {
        part += classes.map((c) => `.${escapeCssIdent(c)}`).join('');
      } else if (curr.parentElement) {
        const siblings = Array.from(curr.parentElement.children).filter(
          (child) => child.tagName === curr.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(curr) + 1;
          part += `:nth-of-type(${index})`;
        }
      }

      parts.unshift(part);
      curr = curr.parentElement;
      depth++;
    }

    return parts.join(' > ');
  }

  function generateBroadSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    const tag = el.tagName.toLowerCase();
    const classes = getCleanClasses(el);
    if (classes.length > 0) {
      return `${tag}.${classes.slice(0, 2).map(escapeCssIdent).join('.')}`;
    }
    return generateSpecificSelector(el);
  }

  function formatElementLabel(el) {
    if (!el) return '';
    const tag = el.tagName.toLowerCase();
    const idPart = el.id ? `#${el.id}` : '';
    const classes = getCleanClasses(el).slice(0, 2).map((c) => `.${c}`).join('');
    return `${tag}${idPart}${classes}`;
  }

  function createUi() {
    if (hostEl) return;
    hostEl = document.createElement('div');
    hostEl.id = 'denim-dark-picker-host';
    hostEl.style.cssText = 'position: fixed; inset: 0; z-index: 2147483646; pointer-events: none;';

    shadow = hostEl.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .banner {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(14, 25, 46, 0.94);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          color: #f8fafc;
          border: 1px solid rgba(96, 165, 250, 0.45);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 0 18px rgba(59, 130, 246, 0.25);
          padding: 9px 16px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          pointer-events: auto;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px #60a5fa;
        }
        .cancel-btn {
          background: rgba(244, 63, 94, 0.16);
          color: #fda4af;
          border: 1px solid rgba(244, 63, 94, 0.4);
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .cancel-btn:hover {
          background: rgba(244, 63, 94, 0.3);
        }
        .highlight {
          position: fixed;
          border: 2px solid #3b82f6;
          background: rgba(59, 130, 246, 0.14);
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.35), 0 0 18px rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          pointer-events: none;
          display: none;
          transition: all 0.05s ease-out;
        }
        .tag-label {
          position: fixed;
          background: #070d19;
          color: #93c5fd;
          border: 1px solid rgba(96, 165, 250, 0.45);
          padding: 3px 8px;
          border-radius: 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          pointer-events: none;
          display: none;
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
        }
      </style>
      <div class="banner">
        <span class="dot"></span>
        <span><strong>Modo Seleção Denim Dark</strong> — Clique no elemento para personalizar cor (ESC cancela)</span>
        <button class="cancel-btn" type="button">Cancelar</button>
      </div>
      <div class="highlight"></div>
      <div class="tag-label"></div>
    `;

    highlightEl = shadow.querySelector('.highlight');
    labelEl = shadow.querySelector('.tag-label');
    bannerEl = shadow.querySelector('.banner');
    shadow.querySelector('.cancel-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
    });

    (document.body || document.documentElement).appendChild(hostEl);
  }

  function updateHighlight(el) {
    if (!highlightEl || !labelEl || !el) return;
    const rect = el.getBoundingClientRect();
    highlightEl.style.display = 'block';
    highlightEl.style.top = `${rect.top}px`;
    highlightEl.style.left = `${rect.left}px`;
    highlightEl.style.width = `${Math.max(rect.width, 4)}px`;
    highlightEl.style.height = `${Math.max(rect.height, 4)}px`;

    labelEl.textContent = formatElementLabel(el);
    labelEl.style.display = 'block';
    const labelTop = rect.top > 28 ? rect.top - 24 : Math.min(window.innerHeight - 26, rect.bottom + 4);
    const labelLeft = Math.max(8, Math.min(window.innerWidth - 260, rect.left));
    labelEl.style.top = `${labelTop}px`;
    labelEl.style.left = `${labelLeft}px`;
  }

  function onMouseMove(e) {
    if (!active) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isExtensionUi(el)) return;
    currentTarget = el;
    updateHighlight(el);
  }

  function onClick(e) {
    if (!active) return;
    const path = e.composedPath ? e.composedPath() : [e.target];
    if (path.some((node) => isExtensionUi(node))) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const chosen = currentTarget || e.target;
    const cb = selectCallback;
    stop();
    if (cb && chosen) {
      cb(chosen);
    }
  }

  function onKeyDown(e) {
    if (!active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stop();
    }
  }

  function onScrollOrResize() {
    if (active && currentTarget) {
      updateHighlight(currentTarget);
    }
  }

  function start(onSelect) {
    if (active) stop();
    selectCallback = onSelect;
    active = true;
    createUi();
    document.documentElement.style.cursor = 'crosshair';
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);
  }

  function stop() {
    active = false;
    currentTarget = null;
    selectCallback = null;
    document.documentElement.style.cursor = '';
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize, true);
    if (hostEl && hostEl.parentNode) {
      hostEl.parentNode.removeChild(hostEl);
    }
    hostEl = null;
    shadow = null;
    highlightEl = null;
    labelEl = null;
    bannerEl = null;
  }

  window.DenimPicker = {
    start,
    stop,
    isActive: () => active,
    generateSpecificSelector,
    generateBroadSelector
  };
})();
