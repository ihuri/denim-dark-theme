(function () {
  'use strict';

  const {
    DENIM_PALETTE,
    DEFAULT_SETTINGS,
    normalizeDomainInput
  } = window.DenimShared;

  let settings = Object.assign({}, DEFAULT_SETTINGS);

  const elListMode = document.getElementById('opt-list-mode');
  const elCustomBase = document.getElementById('opt-custom-base');
  const elPalettePreview = document.getElementById('palette-preview');
  const elWlList = document.getElementById('wl-list');
  const elBlList = document.getElementById('bl-list');
  const elWlCount = document.getElementById('wl-count');
  const elBlCount = document.getElementById('bl-count');
  const elWlInput = document.getElementById('wl-input');
  const elBlInput = document.getElementById('bl-input');
  const elRulesTotal = document.getElementById('rules-total');
  const elRulesContainer = document.getElementById('custom-rules-container');
  const elSiteModesList = document.getElementById('site-modes-list');

  async function loadSettings() {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    settings = Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  async function saveSettings(partial) {
    Object.assign(settings, partial);
    await chrome.storage.local.set(partial);
    render();
  }

  function renderPalettePreview() {
    elPalettePreview.innerHTML = '';
    for (const group of DENIM_PALETTE) {
      for (const item of group.items) {
        const chip = document.createElement('div');
        chip.className = 'token-chip';
        chip.title = `${item.token}: ${item.role}`;
        chip.innerHTML = `
          <span class="token-color" style="background: ${item.value};"></span>
          <div class="token-info">
            <div class="token-name">${item.alias}</div>
            <div class="token-val">${item.value}</div>
          </div>
        `;
        elPalettePreview.appendChild(chip);
      }
    }
  }

  function renderDomainList(listKey, ulEl, countEl, emptyText) {
    const items = Array.isArray(settings[listKey]) ? settings[listKey] : [];
    countEl.textContent = items.length;
    ulEl.innerHTML = '';

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-msg';
      li.textContent = emptyText;
      ulEl.appendChild(li);
      return;
    }

    for (const domain of items) {
      const li = document.createElement('li');
      li.className = 'list-item';

      const span = document.createElement('span');
      span.textContent = domain;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'remove-btn';
      btn.innerHTML = '&times;';
      btn.title = 'Remover';
      btn.addEventListener('click', () => {
        const next = (settings[listKey] || []).filter((d) => d !== domain);
        saveSettings({ [listKey]: next });
      });

      li.appendChild(span);
      li.appendChild(btn);
      ulEl.appendChild(li);
    }
  }

  function renderCustomRules() {
    const map = settings.customRules || {};
    const domains = Object.keys(map).filter((k) => Array.isArray(map[k]) && map[k].length > 0);
    let total = 0;
    elRulesContainer.innerHTML = '';

    if (domains.length === 0) {
      elRulesTotal.textContent = '0 regras';
      elRulesContainer.innerHTML =
        '<p class="empty-msg">Nenhuma customização salva ainda. Use "Selecionar Elemento na Página" para ajustar cores manualmente.</p>';
      return;
    }

    for (const domain of domains) {
      const rules = map[domain];
      total += rules.length;

      const box = document.createElement('div');
      box.className = 'domain-rules-box';

      const head = document.createElement('div');
      head.className = 'domain-rules-head';
      head.innerHTML = `<span>${domain === '*' ? 'Global (Todos os sites)' : domain}</span>`;

      const clearDomainBtn = document.createElement('button');
      clearDomainBtn.type = 'button';
      clearDomainBtn.className = 'btn-danger';
      clearDomainBtn.textContent = 'Remover todas deste site';
      clearDomainBtn.addEventListener('click', () => {
        const next = Object.assign({}, settings.customRules || {});
        delete next[domain];
        saveSettings({ customRules: next });
      });
      head.appendChild(clearDomainBtn);
      box.appendChild(head);

      for (const rule of rules) {
        const row = document.createElement('div');
        row.className = 'rule-row';

        const left = document.createElement('div');
        const selEl = document.createElement('div');
        selEl.className = 'rule-selector';
        selEl.textContent = rule.selector;
        left.appendChild(selEl);

        const swatches = document.createElement('div');
        swatches.className = 'rule-swatches';
        if (rule.backgroundColor) {
          swatches.innerHTML += `<span class="mini-swatch"><span class="mini-box" style="background:${rule.backgroundColor}"></span>Fundo: ${rule.backgroundColor}</span>`;
        }
        if (rule.color) {
          swatches.innerHTML += `<span class="mini-swatch"><span class="mini-box" style="background:${rule.color}"></span>Texto: ${rule.color}</span>`;
        }
        if (rule.borderColor) {
          swatches.innerHTML += `<span class="mini-swatch"><span class="mini-box" style="background:${rule.borderColor}"></span>Borda: ${rule.borderColor}</span>`;
        }
        if (rule.backdropBlur) {
          swatches.innerHTML += `<span class="mini-swatch">Blur 18px</span>`;
        }
        left.appendChild(swatches);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'remove-btn';
        delBtn.innerHTML = '&times;';
        delBtn.title = 'Excluir regra';
        delBtn.addEventListener('click', () => {
          const next = Object.assign({}, settings.customRules || {});
          next[domain] = (next[domain] || []).filter((r) => r.id !== rule.id);
          if (next[domain].length === 0) delete next[domain];
          saveSettings({ customRules: next });
        });

        row.appendChild(left);
        row.appendChild(delBtn);
        box.appendChild(row);
      }

      elRulesContainer.appendChild(box);
    }

    elRulesTotal.textContent = `${total} ${total === 1 ? 'regra' : 'regras'}`;
  }

  function renderSiteModes() {
    const map = settings.siteModes || {};
    const entries = Object.entries(map);
    elSiteModesList.innerHTML = '';

    if (entries.length === 0) {
      elSiteModesList.innerHTML = '<li class="empty-msg">Nenhum override específico por site configurado.</li>';
      return;
    }

    const modeName = {
      disabled: 'Desativado',
      active: 'Ativado',
      custom: 'Personalizado'
    };

    for (const [host, mode] of entries) {
      const li = document.createElement('li');
      li.className = 'list-item';

      const span = document.createElement('span');
      span.textContent = `${host} → ${modeName[mode] || mode}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'remove-btn';
      btn.innerHTML = '&times;';
      btn.title = 'Remover override';
      btn.addEventListener('click', () => {
        const next = Object.assign({}, settings.siteModes || {});
        delete next[host];
        saveSettings({ siteModes: next });
      });

      li.appendChild(span);
      li.appendChild(btn);
      elSiteModesList.appendChild(li);
    }
  }

  function render() {
    document.querySelectorAll('.mode-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.global === settings.globalMode);
    });
    elListMode.value = settings.listMode || 'blacklist';
    elCustomBase.checked = Boolean(settings.customBaseDark);

    renderDomainList(
      'whitelist',
      elWlList,
      elWlCount,
      'Nenhum site adicionado à lista de permitidos.'
    );
    renderDomainList(
      'blacklist',
      elBlList,
      elBlCount,
      'Nenhum site adicionado à lista de bloqueados.'
    );
    renderCustomRules();
    renderSiteModes();
  }

  async function addDomainsFromInput(listKey, rawValue) {
    const tokens = rawValue
      .split(/[\s,;]+/)
      .map(normalizeDomainInput)
      .filter(Boolean);
    if (tokens.length === 0) return;

    const otherKey = listKey === 'whitelist' ? 'blacklist' : 'whitelist';
    const nextList = Array.from(new Set([...(settings[listKey] || []), ...tokens]));
    const nextOther = (settings[otherKey] || []).filter(
      (d) => !tokens.includes(normalizeDomainInput(d))
    );

    await saveSettings({ [listKey]: nextList, [otherKey]: nextOther });
  }

  document.querySelectorAll('.mode-card').forEach((btn) => {
    btn.addEventListener('click', () => saveSettings({ globalMode: btn.dataset.global }));
  });

  elListMode.addEventListener('change', () => {
    saveSettings({ listMode: elListMode.value });
  });

  elCustomBase.addEventListener('change', () => {
    saveSettings({ customBaseDark: elCustomBase.checked });
  });

  document.getElementById('wl-add').addEventListener('click', async () => {
    await addDomainsFromInput('whitelist', elWlInput.value);
    elWlInput.value = '';
  });

  elWlInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await addDomainsFromInput('whitelist', elWlInput.value);
      elWlInput.value = '';
    }
  });

  document.getElementById('bl-add').addEventListener('click', async () => {
    await addDomainsFromInput('blacklist', elBlInput.value);
    elBlInput.value = '';
  });

  elBlInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await addDomainsFromInput('blacklist', elBlInput.value);
      elBlInput.value = '';
    }
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'denim-dark-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const sanitized = {};
        for (const k of Object.keys(DEFAULT_SETTINGS)) {
          if (parsed[k] !== undefined) sanitized[k] = parsed[k];
        }
        await saveSettings(sanitized);
      } catch {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (confirm('Deseja restaurar todas as configurações e apagar listas/regras?')) {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(DEFAULT_SETTINGS);
      await loadSettings();
      render();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [k, { newValue }] of Object.entries(changes)) {
      settings[k] = newValue;
    }
    render();
  });

  async function init() {
    renderPalettePreview();
    await loadSettings();
    render();
  }

  init();
})();
