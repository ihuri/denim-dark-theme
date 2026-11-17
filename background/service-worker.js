importScripts('../shared/tokens.js');

const {
  ICON_SETS,
  DEFAULT_SETTINGS,
  extractHostname,
  resolveEffectiveState
} = self.DenimShared;

const STATE_TITLES = {
  disabled: 'Denim Dark: Desativado (Stormtrooper)',
  active: 'Denim Dark: Ativado (Darth Vader)',
  custom: 'Denim Dark: Personalizado (Comando)'
};

const CONTENT_CSS = ['styles/tokens.css', 'styles/universal-engine.css'];
const CONTENT_JS = [
  'shared/tokens.js',
  'content/picker.js',
  'content/modal.js',
  'content/content.js'
];

function isInjectableUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

async function ensureTabInjectedAndApplied(tabId, url) {
  if (typeof tabId !== 'number' || tabId < 0 || !isInjectableUrl(url)) return false;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'DENIM_APPLY_STATE' });
    return true;
  } catch {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: CONTENT_CSS
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: CONTENT_JS
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function ensureInjectedInAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null && isInjectableUrl(tab.url)) {
        await ensureTabInjectedAndApplied(tab.id, tab.url);
      }
    }
  } catch {
    // Ignore
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return Object.assign({}, DEFAULT_SETTINGS, stored);
}

async function updateIconForTab(tabId, url) {
  if (typeof tabId !== 'number' || tabId < 0) return;
  try {
    const settings = await getSettings();
    const hostname = extractHostname(url);
    const state = hostname
      ? resolveEffectiveState(hostname, settings)
      : (settings.globalMode || 'disabled');

    const iconPath = ICON_SETS[state] || ICON_SETS.disabled;
    await chrome.action.setIcon({ tabId, path: iconPath });
    await chrome.action.setTitle({
      tabId,
      title: STATE_TITLES[state] || STATE_TITLES.disabled
    });
  } catch {
    // Tab may have closed before update completed
  }
}

async function refreshAllTabsIcons() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) {
        await updateIconForTab(tab.id, tab.url || '');
      }
    }
  } catch {
    // Ignore errors on restricted tabs
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[k] === undefined) {
      toSet[k] = v;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'denim-pick-element',
        title: 'Personalizar cor deste elemento (Denim Dark)',
        contexts: ['all']
      });
    });
  } catch {
    // Ignore context menu creation errors
  }

  await refreshAllTabsIcons();
  await ensureInjectedInAllTabs();
});

chrome.runtime.onStartup.addListener(() => {
  refreshAllTabsIcons();
  ensureInjectedInAllTabs();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await updateIconForTab(tabId, tab.url || '');
  } catch {
    // Ignore
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    updateIconForTab(tabId, changeInfo.url || tab.url || '');
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    refreshAllTabsIcons();
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id != null && isInjectableUrl(activeTab.url)) {
        await ensureTabInjectedAndApplied(activeTab.id, activeTab.url);
      }
    } catch {
      // Ignore
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'denim-pick-element' && tab && tab.id != null) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'DENIM_START_PICKER' });
    } catch {
      const ok = await ensureTabInjectedAndApplied(tab.id, tab.url || '');
      if (ok) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'DENIM_START_PICKER' });
        } catch {
          // Ignore
        }
      }
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || activeTab.id == null) return;

  if (command === 'toggle-picker') {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'DENIM_START_PICKER' });
    } catch {
      const ok = await ensureTabInjectedAndApplied(activeTab.id, activeTab.url || '');
      if (ok) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: 'DENIM_START_PICKER' });
        } catch {
          // Ignore
        }
      }
    }
  } else if (command === 'cycle-mode') {
    const settings = await getSettings();
    const order = ['active', 'custom', 'disabled'];
    const currentIdx = order.indexOf(settings.globalMode || 'active');
    const nextMode = order[(currentIdx + 1) % order.length];
    await chrome.storage.local.set({ globalMode: nextMode });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === 'DENIM_ENSURE_TAB') {
    ensureTabInjectedAndApplied(message.tabId, message.url || '').then((ok) => {
      sendResponse({ ok });
    });
    return true;
  }

  if (message.type === 'DENIM_REFRESH_ICON') {
    if (sender && sender.tab && sender.tab.id != null) {
      updateIconForTab(sender.tab.id, sender.tab.url || '').then(() => sendResponse({ ok: true }));
      return true;
    }
    refreshAllTabsIcons().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
