(function () {
  'use strict';

  if (window.DenimModal) return;

  const { DENIM_PALETTE } = window.DenimShared;

  let modalHost = null;
  let previewStyleEl = null;
  let dragCleanup = null;

  function removeModal() {
    if (dragCleanup) {
      dragCleanup();
      dragCleanup = null;
    }
    if (modalHost && modalHost.parentNode) {
      modalHost.parentNode.removeChild(modalHost);
    }
    modalHost = null;
    if (previewStyleEl && previewStyleEl.parentNode) {
      previewStyleEl.parentNode.removeChild(previewStyleEl);
    }
    previewStyleEl = null;
  }

  function applyLivePreview(rule) {
    if (!previewStyleEl) {
      previewStyleEl = document.createElement('style');
      previewStyleEl.id = 'denim-dark-live-preview';
      (document.head || document.documentElement).appendChild(previewStyleEl);
    }
    const css = window.DenimShared.buildCustomCssText([rule]);
    previewStyleEl.textContent = css;
  }

  function rgbStringToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#0a1324';
    if (rgb.startsWith('#')) return rgb.slice(0, 7);
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#0a1324';
    const [r, g, b] = match.slice(0, 3).map((n) => Math.max(0, Math.min(255, parseInt(n, 10))));
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  function openModal({ targetEl, hostname, existingRules, onSave, onDelete }) {
    removeModal();

    const specificSelector = window.DenimPicker.generateSpecificSelector(targetEl);
    const broadSelector = window.DenimPicker.generateBroadSelector(targetEl);
    const computed = window.getComputedStyle(targetEl);

    const matchedExisting = (existingRules || []).find(
      (r) => r.selector === specificSelector || r.selector === broadSelector
    );

    const state = {
      selector: matchedExisting ? matchedExisting.selector : specificSelector,
      activeProp: 'backgroundColor', // 'backgroundColor' | 'color' | 'borderColor'
      backgroundColor: matchedExisting ? matchedExisting.backgroundColor || '' : '',
      color: matchedExisting ? matchedExisting.color || '' : '',
      borderColor: matchedExisting ? matchedExisting.borderColor || '' : '',
      backdropBlur: matchedExisting ? Boolean(matchedExisting.backdropBlur) : false,
      globalScope: false
    };

    modalHost = document.createElement('div');
    modalHost.id = 'denim-dark-modal-host';
    modalHost.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';

    const shadow = modalHost.attachShadow({ mode: 'open' });

    const paletteHtml = DENIM_PALETTE.map(
      (group) => `
      <div class="palette-group">
        <div class="group-title">${group.group}</div>
        <div class="swatch-grid">
          ${group.items
            .map(
              (item) => `
            <button
              type="button"
              class="swatch-btn"
              data-value="${item.value}"
              title="${item.alias} (${item.token}): ${item.role}"
            >
              <span class="swatch-dot" style="background: ${item.value};"></span>
              <span class="swatch-meta">
                <span class="swatch-name">${item.alias}</span>
                <span class="swatch-hex">${item.value}</span>
              </span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `
    ).join('');

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(5, 10, 20, 0.35);
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal {
          width: 480px;
          max-width: 100%;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          background: rgba(10, 19, 36, 0.96);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(96, 165, 250, 0.40);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), 0 0 28px rgba(59, 130, 246, 0.25);
          border-radius: 14px;
          color: #f8fafc;
          overflow: hidden;
          position: relative;
        }
        .header {
          padding: 14px 16px;
          background: #070d19;
          border-bottom: 1px solid rgba(70, 115, 185, 0.18);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: move;
          user-select: none;
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
        }
        .badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
          border: 1px solid rgba(96, 165, 250, 0.35);
        }
        .close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .close-btn:hover { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
        .body {
          padding: 14px 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .body::-webkit-scrollbar { width: 6px; }
        .body::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        .field-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #94a3b8;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .selector-row {
          display: flex;
          gap: 6px;
          margin-bottom: 6px;
        }
        .chip-btn {
          background: #0f1c34;
          border: 1px solid rgba(70, 115, 185, 0.25);
          color: #94a3b8;
          font-size: 11px;
          padding: 4px 9px;
          border-radius: 6px;
          cursor: pointer;
        }
        .chip-btn.active {
          background: rgba(59, 130, 246, 0.22);
          border-color: #3b82f6;
          color: #bfdbfe;
        }
        .input {
          width: 100%;
          background: #050a14;
          border: 1px solid rgba(70, 115, 185, 0.28);
          color: #93c5fd;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 8px;
          outline: none;
        }
        .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
        .prop-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .prop-tab {
          background: #0f1c34;
          border: 1px solid rgba(70, 115, 185, 0.2);
          color: #94a3b8;
          padding: 8px 6px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .prop-tab.active {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
          color: #f8fafc;
        }
        .prop-preview-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.35);
        }
        .custom-color-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0f1c34;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid rgba(70, 115, 185, 0.22);
        }
        input[type="color"] {
          width: 34px;
          height: 30px;
          padding: 0;
          border: 1px solid rgba(96, 165, 250, 0.4);
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
        }
        .mini-btn {
          background: rgba(14, 25, 46, 0.9);
          border: 1px solid rgba(70, 115, 185, 0.28);
          color: #94a3b8;
          font-size: 11px;
          padding: 6px 9px;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
        }
        .mini-btn:hover { color: #f8fafc; border-color: #60a5fa; }
        .palette-group { margin-bottom: 10px; }
        .group-title {
          font-size: 11px;
          font-weight: 600;
          color: #60a5fa;
          margin-bottom: 6px;
        }
        .swatch-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }
        .swatch-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 28, 52, 0.78);
          border: 1px solid rgba(70, 115, 185, 0.2);
          border-radius: 8px;
          padding: 6px 8px;
          cursor: pointer;
          text-align: left;
          color: #f8fafc;
          transition: border-color 0.12s, background 0.12s;
        }
        .swatch-btn:hover, .swatch-btn.selected {
          background: rgba(18, 33, 62, 0.96);
          border-color: #60a5fa;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35);
        }
        .swatch-dot {
          width: 20px;
          height: 20px;
          border-radius: 5px;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.22);
        }
        .swatch-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .swatch-name {
          font-size: 11px;
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .swatch-hex {
          font-size: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .options-row {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding-top: 2px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #cbd5e1;
          cursor: pointer;
        }
        .footer {
          padding: 12px 16px;
          background: #070d19;
          border-top: 1px solid rgba(70, 115, 185, 0.18);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .footer-right { display: flex; gap: 8px; }
        .btn {
          padding: 8px 13px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: #3b82f6;
          color: #f8fafc;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.35);
        }
        .btn-primary:hover { background: #2563eb; }
        .btn-ghost {
          background: #0f1c34;
          border-color: rgba(70, 115, 185, 0.25);
          color: #94a3b8;
        }
        .btn-ghost:hover { color: #f8fafc; border-color: #60a5fa; }
        .btn-danger {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.35);
          color: #fda4af;
        }
        .btn-danger:hover { background: rgba(244, 63, 94, 0.28); }
      </style>

      <div class="backdrop">
        <div class="modal" role="dialog" aria-label="Personalizar cor Denim Dark">
          <div class="header" id="drag-handle">
            <div class="header-title">
              <span>Personalizar Elemento</span>
              <span class="badge">${hostname || 'site'}</span>
            </div>
            <button type="button" class="close-btn" id="close-modal" title="Fechar">&times;</button>
          </div>

          <div class="body">
            <div>
              <div class="field-label">
                <span>Seletor CSS Alvo</span>
              </div>
              <div class="selector-row">
                <button type="button" class="chip-btn active" id="sel-specific">Apenas este elemento</button>
                <button type="button" class="chip-btn" id="sel-broad">Todos semelhantes</button>
              </div>
              <input type="text" class="input" id="selector-input" value="${state.selector.replace(/"/g, '&quot;')}" />
            </div>

            <div>
              <div class="field-label">Propriedade para alterar</div>
              <div class="prop-tabs">
                <button type="button" class="prop-tab active" data-prop="backgroundColor">
                  <span class="prop-preview-dot" id="dot-bg"></span>
                  Fundo
                </button>
                <button type="button" class="prop-tab" data-prop="color">
                  <span class="prop-preview-dot" id="dot-color"></span>
                  Texto
                </button>
                <button type="button" class="prop-tab" data-prop="borderColor">
                  <span class="prop-preview-dot" id="dot-border"></span>
                  Borda
                </button>
              </div>
            </div>

            <div>
              <div class="field-label">Cor Personalizada (Livre)</div>
              <div class="custom-color-bar">
                <input type="color" id="native-color" value="${rgbStringToHex(computed.backgroundColor)}" />
                <input type="text" class="input" id="custom-hex" placeholder="#0a1324 ou rgba(...)" />
                <button type="button" class="mini-btn" id="btn-transparent">Transparente</button>
                <button type="button" class="mini-btn" id="btn-clear-prop">Limpar</button>
              </div>
            </div>

            <div>
              <div class="field-label">Sugestões Denim Dark</div>
              <div id="palette-container">${paletteHtml}</div>
            </div>

            <div class="options-row">
              <label class="checkbox-label">
                <input type="checkbox" id="chk-blur" ${state.backdropBlur ? 'checked' : ''} />
                Aplicar efeito Frosted (Blur 18px)
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="chk-global" />
                Aplicar em todos os sites (*)
              </label>
            </div>
          </div>

          <div class="footer">
            <div>
              ${matchedExisting ? '<button type="button" class="btn btn-danger" id="btn-delete">Remover</button>' : ''}
            </div>
            <div class="footer-right">
              <button type="button" class="btn btn-ghost" id="btn-cancel">Cancelar</button>
              <button type="button" class="btn btn-primary" id="btn-save">Salvar Cor</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const modalEl = shadow.querySelector('.modal');
    const selectorInput = shadow.querySelector('#selector-input');
    const btnSpecific = shadow.querySelector('#sel-specific');
    const btnBroad = shadow.querySelector('#sel-broad');
    const propTabs = shadow.querySelectorAll('.prop-tab');
    const nativeColor = shadow.querySelector('#native-color');
    const customHex = shadow.querySelector('#custom-hex');
    const chkBlur = shadow.querySelector('#chk-blur');
    const chkGlobal = shadow.querySelector('#chk-global');
    const dotBg = shadow.querySelector('#dot-bg');
    const dotColor = shadow.querySelector('#dot-color');
    const dotBorder = shadow.querySelector('#dot-border');

    function refreshUi() {
      dotBg.style.background = state.backgroundColor || computed.backgroundColor || 'transparent';
      dotColor.style.background = state.color || computed.color || '#f8fafc';
      dotBorder.style.background = state.borderColor || computed.borderColor || 'transparent';

      const currentVal = state[state.activeProp] || '';
      customHex.value = currentVal;
      if (/^#[0-9a-fA-F]{6}$/.test(currentVal)) {
        nativeColor.value = currentVal;
      }

      shadow.querySelectorAll('.swatch-btn').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.value === currentVal);
      });

      applyLivePreview({
        selector: state.selector,
        backgroundColor: state.backgroundColor,
        color: state.color,
        borderColor: state.borderColor,
        backdropBlur: state.backdropBlur
      });
    }

    btnSpecific.addEventListener('click', () => {
      btnSpecific.classList.add('active');
      btnBroad.classList.remove('active');
      state.selector = specificSelector;
      selectorInput.value = specificSelector;
      refreshUi();
    });

    btnBroad.addEventListener('click', () => {
      btnBroad.classList.add('active');
      btnSpecific.classList.remove('active');
      state.selector = broadSelector;
      selectorInput.value = broadSelector;
      refreshUi();
    });

    selectorInput.addEventListener('input', () => {
      state.selector = selectorInput.value.trim();
      refreshUi();
    });

    propTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        propTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeProp = tab.dataset.prop;
        refreshUi();
      });
    });

    shadow.querySelectorAll('.swatch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state[state.activeProp] = btn.dataset.value;
        refreshUi();
      });
    });

    nativeColor.addEventListener('input', () => {
      state[state.activeProp] = nativeColor.value;
      refreshUi();
    });

    customHex.addEventListener('input', () => {
      state[state.activeProp] = customHex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(state[state.activeProp])) {
        nativeColor.value = state[state.activeProp];
      }
      applyLivePreview({
        selector: state.selector,
        backgroundColor: state.backgroundColor,
        color: state.color,
        borderColor: state.borderColor,
        backdropBlur: state.backdropBlur
      });
    });

    shadow.querySelector('#btn-transparent').addEventListener('click', () => {
      state[state.activeProp] = 'transparent';
      refreshUi();
    });

    shadow.querySelector('#btn-clear-prop').addEventListener('click', () => {
      state[state.activeProp] = '';
      refreshUi();
    });

    chkBlur.addEventListener('change', () => {
      state.backdropBlur = chkBlur.checked;
      refreshUi();
    });

    chkGlobal.addEventListener('change', () => {
      state.globalScope = chkGlobal.checked;
    });

    // Dragging support
    const dragHandle = shadow.querySelector('#drag-handle');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX - offsetX;
      startY = e.clientY - offsetY;
    });

    const onDragMove = (e) => {
      if (!dragging) return;
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;
      modalEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };

    const onDragEnd = () => {
      dragging = false;
    };

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    dragCleanup = () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
    };

    shadow.querySelector('#close-modal').addEventListener('click', removeModal);
    shadow.querySelector('#btn-cancel').addEventListener('click', removeModal);
    shadow.querySelector('.backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('backdrop')) removeModal();
    });

    const delBtn = shadow.querySelector('#btn-delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const sel = matchedExisting.selector;
        removeModal();
        if (onDelete) onDelete(sel);
      });
    }

    shadow.querySelector('#btn-save').addEventListener('click', () => {
      if (!state.selector) return;
      const payload = {
        id: (matchedExisting && matchedExisting.id) || `rule-${Date.now()}`,
        selector: state.selector,
        backgroundColor: state.backgroundColor,
        color: state.color,
        borderColor: state.borderColor,
        backdropBlur: state.backdropBlur,
        enabled: true,
        globalScope: state.globalScope
      };
      removeModal();
      if (onSave) onSave(payload);
    });

    refreshUi();
    (document.body || document.documentElement).appendChild(modalHost);
  }

  window.DenimModal = {
    open: openModal,
    close: removeModal
  };
})();
