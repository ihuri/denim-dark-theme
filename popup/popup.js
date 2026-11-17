(function () {
  'use strict';

  const {
    DEFAULT_SETTINGS,
    ICON_SETS,
    extractHostname,
    normalizeDomainInput,
    matchesDomainList,
    resolveEffectiveState,
    getRulesForHostname
  } = window.DenimShared;

  let activeTab = null;
  let currentHost = '';
  let activeListTab = 'whitelist';
  let settings = Object.assign({}, DEFAULT_SETTINGS);

  const elHelmetImg = document.getElementById('state-helmet-img');
  const elStatusDot = document.getElementById('status-dot');
  const elStatusText = document.getElementById('status-text');
  const elCurrentHost = document.getElementById('current-host');
  const elClearOverride = document.getElementById('btn-clear-site-override');
  const elChkCustomBase = document.getElementById('chk-custom-base');
  const elBtnPick = document.getElementById('btn-pick-element');
  const elRulesCountText = document.getElementById('rules-count-text');
  const elListModeSelect = document.getElementById('list-mode-select');
  const elCountWhitelist = document.getElementById('count-whitelist');
  const elCountBlacklist = document.getElementById('count-blacklist');
  const elDomainInput = document.getElementById('domain-input');
  const elDomainList = document.getElementById('domain-list');
  const elBtnAddCurrent = document.getElementById('btn-add-current');

  const STATE_LABELS = {
    disabled: 'Desativado — Stormtrooper',
    active: 'Ativado — Darth Vader',
    custom: 'Personalizado — Capacete Comando'
  };

  async function loadSettings() {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    settings = Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  async function syncActiveTabNow() {
    if (!activeTab || activeTab.id == null || !currentHost) return false;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'DENIM_APPLY_STATE' });
      return true;
    } catch {
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'DENIM_ENSURE_TAB',
          tabId: activeTab.id,
          url: activeTab.url || ''
        });
        return Boolean(res && res.ok);
      } catch {
        return false;
      }
    }
  }

  async function saveSettings(partial) {
    Object.assign(settings, partial);
    await chrome.storage.local.set(partial);
    render();
    await syncActiveTabNow();
  }

  function renderDomainList() {
    const list = Array.isArray(settings[activeListTab]) ? settings[activeListTab] : [];
    elDomainList.innerHTML = '';

    if (list.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-list';
      empty.textContent =
        activeListTab === 'whitelist'
          ? 'Nenhum site na lista de permitidos.'
          : 'Nenhum site na lista de ignorados.';
      elDomainList.appendChild(empty);
      return;
    }

    for (const domain of list) {
      const li = document.createElement('li');
      const isMatch = currentHost && matchesDomainList(currentHost, [domain]);
      li.className = `domain-item${isMatch ? ' current-match' : ''}`;

      const span = document.createElement('span');
      span.textContent = domain;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'remove-btn';
      btn.title = 'Remover';
      btn.innerHTML = '&times;';
      btn.addEventListener('click', () => removeDomain(activeListTab, domain));

      li.appendChild(span);
      li.appendChild(btn);
      elDomainList.appendChild(li);
    }
  }

  function render() {
    const effectiveState = currentHost
      ? resolveEffectiveState(currentHost, settings)
      : (settings.globalMode || 'disabled');

    // Header Icon & Status
    const SVG_MAP = {
      disabled: '../icons/stormtrooper.svg',
      active: '../icons/vader.svg',
      custom: '../icons/commando.svg'
    };
    elHelmetImg.src = SVG_MAP[effectiveState] || SVG_MAP.disabled;
    elStatusDot.className = `status-dot ${effectiveState}`;
    elStatusText.textContent = STATE_LABELS[effectiveState];

    elCurrentHost.textContent = currentHost || 'Página interna';
    elBtnPick.disabled = !currentHost;
    elBtnAddCurrent.disabled = !currentHost;

    // Site override indicator
    const hasOverride =
      currentHost &&
      settings.siteModes &&
      Boolean(settings.siteModes[currentHost] || settings.siteModes[currentHost.replace(/^www\./, '')]);
    elClearOverride.classList.toggle('hidden', !hasOverride);

    // Site segmented buttons reflect effectiveState
    document.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === effectiveState);
      btn.disabled = !currentHost;
    });

    // Global segmented buttons
    document.querySelectorAll('.mini-seg').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.global === settings.globalMode);
    });

    elChkCustomBase.checked = Boolean(settings.customBaseDark);

    // Custom rules count for current host
    const rules = getRulesForHostname(currentHost, settings.customRules);
    elRulesCountText.textContent = `${rules.length} ${rules.length === 1 ? 'customização' : 'customizações'} neste site`;

    // List controls
    elListModeSelect.value = settings.listMode || 'blacklist';
    elCountWhitelist.textContent = (settings.whitelist || []).length;
    elCountBlacklist.textContent = (settings.blacklist || []).length;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === activeListTab);
    });

    renderDomainList();
  }

  async function setSiteMode(mode) {
    if (!currentHost) return;
    const siteModes = Object.assign({}, settings.siteModes || {});
    siteModes[currentHost] = mode;

    // Se usuário ativou ou personalizou explicitamente, remove da blacklist caso esteja lá
    let blacklist = Array.isArray(settings.blacklist) ? [...settings.blacklist] : [];
    if (mode !== 'disabled' && matchesDomainList(currentHost, blacklist)) {
      blacklist = blacklist.filter((d) => !matchesDomainList(currentHost, [d]));
    }

    await saveSettings({ siteModes, blacklist });
  }

  async function clearSiteOverride() {
    if (!currentHost) return;
    const siteModes = Object.assign({}, settings.siteModes || {});
    delete siteModes[currentHost];
    delete siteModes[currentHost.replace(/^www\./, '')];
    await saveSettings({ siteModes });
  }

  async function addDomain(targetList, rawDomain) {
    const clean = normalizeDomainInput(rawDomain);
    if (!clean) return;

    const otherList = targetList === 'whitelist' ? 'blacklist' : 'whitelist';
    const nextTarget = Array.from(new Set([...(settings[targetList] || []), clean]));
    const nextOther = (settings[otherList] || []).filter((d) => normalizeDomainInput(d) !== clean);

    const siteModes = Object.assign({}, settings.siteModes || {});
    if (targetList === 'blacklist') {
      delete siteModes[clean];
      delete siteModes[`www.${clean}`];
    }

    await saveSettings({
      [targetList]: nextTarget,
      [otherList]: nextOther,
      siteModes
    });
  }

  async function removeDomain(targetList, domain) {
    const nextList = (settings[targetList] || []).filter((d) => d !== domain);
    await saveSettings({ [targetList]: nextList });
  }

  // Event Listeners
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => setSiteMode(btn.dataset.mode));
  });

  document.querySelectorAll('.mini-seg').forEach((btn) => {
    btn.addEventListener('click', () => saveSettings({ globalMode: btn.dataset.global }));
  });

  elClearOverride.addEventListener('click', clearSiteOverride);

  elChkCustomBase.addEventListener('change', () => {
    saveSettings({ customBaseDark: elChkCustomBase.checked });
  });

  elListModeSelect.addEventListener('change', () => {
    saveSettings({ listMode: elListModeSelect.value });
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeListTab = btn.dataset.tab;
      render();
    });
  });

  document.getElementById('btn-add-domain').addEventListener('click', async () => {
    await addDomain(activeListTab, elDomainInput.value);
    elDomainInput.value = '';
  });

  elDomainInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await addDomain(activeListTab, elDomainInput.value);
      elDomainInput.value = '';
    }
  });

  elBtnAddCurrent.addEventListener('click', () => {
    if (currentHost) {
      addDomain(activeListTab, currentHost);
    }
  });

  elBtnPick.addEventListener('click', async () => {
    if (!activeTab || activeTab.id == null) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'DENIM_START_PICKER' });
      window.close();
    } catch {
      const ok = await syncActiveTabNow();
      if (ok) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: 'DENIM_START_PICKER' });
          window.close();
          return;
        } catch {
          // fallback message below
        }
      }
      elStatusText.textContent = 'Não foi possível iniciar o seletor nesta página.';
    }
  });

  document.getElementById('btn-open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('btn-manage-rules').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [k, { newValue }] of Object.entries(changes)) {
      settings[k] = newValue;
    }
    render();
  });

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab || null;
    currentHost = activeTab ? extractHostname(activeTab.url) : '';
    await loadSettings();
    render();
  }

  init();
})();
