(function (root) {
  'use strict';

  if (root.DenimShared) return;

  const DENIM_PALETTE = [
    {
      group: '1. Backgrounds & Surfaces',
      items: [
        { token: '--denim-bg-deepest', alias: 'denimBase', value: '#070d19', hex: '#070d19', role: 'Deepest canvas background' },
        { token: '--denim-bg-main', alias: 'denimDark', value: '#0a1324', hex: '#0a1324', role: 'Main background fill' },
        { token: '--denim-bg-surface', alias: 'denimSurface', value: '#0f1c34', hex: '#0f1c34', role: 'Intermediate container surface' },
        { token: '--denim-bg-card', alias: 'denimCard', value: 'rgba(14, 25, 46, 0.88)', hex: '#0e192e', role: 'Translucent frosted cards (18px blur)' },
        { token: '--denim-bg-card-hover', alias: 'denimCardHover', value: 'rgba(18, 33, 62, 0.96)', hex: '#12213e', role: 'Card hover state' },
        { token: '--denim-bg-terminal', alias: 'Terminal / Code', value: '#050a14', hex: '#050a14', role: 'SQL query terminal code blocks' }
      ]
    },
    {
      group: '2. Accents & Blue Spectrum',
      items: [
        { token: '--denim-primary', alias: 'denimBlue', value: '#3b82f6', hex: '#3b82f6', role: 'Primary buttons, active elements, focus glow' },
        { token: '--denim-sky', alias: 'denimSky', value: '#60a5fa', hex: '#60a5fa', role: 'Secondary accents, active tab text' },
        { token: '--denim-ice', alias: 'denimIce', value: '#bfdbfe', hex: '#bfdbfe', role: 'Light contrast highlights & indicators' },
        { token: '--denim-code-highlight', alias: 'Code Highlight', value: '#93c5fd', hex: '#93c5fd', role: 'Monospace query font color' }
      ]
    },
    {
      group: '3. Borders & Dividers',
      items: [
        { token: '--denim-border-subtle', alias: 'denimBorder', value: 'rgba(70, 115, 185, 0.18)', hex: '#4673b9', role: 'Default card and panel outlines' },
        { token: '--denim-border-active', alias: 'denimBorderActive', value: 'rgba(96, 165, 250, 0.40)', hex: '#60a5fa', role: 'Hovered cards and active panels' },
        { token: '--denim-border-glow', alias: 'denimBorderGlow', value: 'rgba(59, 130, 246, 0.25)', hex: '#3b82f6', role: 'Outer glow effect' }
      ]
    },
    {
      group: '4. Text & Neutral Scales',
      items: [
        { token: '--denim-text-bright', alias: 'Text Bright', value: '#f8fafc', hex: '#f8fafc', role: 'Primary titles, metrics, high-emphasis text' },
        { token: '--denim-text-dim', alias: 'Text Dim', value: '#94a3b8', hex: '#94a3b8', role: 'Subtitles, labels, navigation items' },
        { token: '--denim-muted', alias: 'Muted', value: '#64748b', hex: '#64748b', role: 'Timestamps, inactive controls, secondary metadata' }
      ]
    },
    {
      group: '5. Status & Telemetry Indicators',
      items: [
        { token: '--kaspersky-green', alias: 'kGreen', value: '#00c774', hex: '#00c774', role: 'Healthy / Normal / Online' },
        { token: '--kaspersky-amber', alias: 'kAmber', value: '#f59e0b', hex: '#f59e0b', role: 'Warning / Medium Load' },
        { token: '--kaspersky-red', alias: 'kRed', value: '#f43f5e', hex: '#f43f5e', role: 'Critical / Database Locks / Alarm' }
      ]
    }
  ];

  const ICON_SETS = {
    disabled: {
      16: '/icons/stormtrooper-16.png',
      32: '/icons/stormtrooper-32.png',
      48: '/icons/stormtrooper-48.png',
      128: '/icons/stormtrooper-128.png'
    },
    active: {
      16: '/icons/vader-16.png',
      32: '/icons/vader-32.png',
      48: '/icons/vader-48.png',
      128: '/icons/vader-128.png'
    },
    custom: {
      16: '/icons/commando-16.png',
      32: '/icons/commando-32.png',
      48: '/icons/commando-48.png',
      128: '/icons/commando-128.png'
    }
  };

  const DEFAULT_SETTINGS = {
    globalMode: 'active',       // 'active' | 'disabled' | 'custom'
    listMode: 'blacklist',      // 'blacklist' (todos exceto lista) | 'whitelist' (apenas lista)
    whitelist: [],              // Sites que se aplicam
    blacklist: [],              // Sites que NÃO se aplicam
    siteModes: {},              // { [hostname]: 'active' | 'disabled' | 'custom' }
    customRules: {},            // { [hostname | '*']: Array<{ id, selector, backgroundColor, color, borderColor, backdropBlur, enabled }> }
    customBaseDark: true        // No modo Personalizado, manter fundo base Denim Dark além das cores selecionadas
  };

  function extractHostname(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function normalizeDomainInput(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let value = raw.trim().toLowerCase();
    if (!value) return '';
    if (value.includes('://')) {
      try {
        value = new URL(value).hostname.toLowerCase();
      } catch {
        // fallback below
      }
    }
    value = value.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
    value = value.replace(/:\d+$/, '').replace(/^\*\./, '').replace(/^www\./, '');
    return value;
  }

  function matchesDomainList(hostname, list) {
    if (!hostname || !Array.isArray(list) || list.length === 0) return false;
    const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
    return list.some((entry) => {
      const cleanEntry = normalizeDomainInput(entry);
      if (!cleanEntry) return false;
      return (
        cleanHost === cleanEntry ||
        cleanHost.endsWith('.' + cleanEntry) ||
        hostname.toLowerCase() === cleanEntry
      );
    });
  }

  function resolveEffectiveState(hostname, rawSettings) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, rawSettings || {});
    if (!hostname) return settings.globalMode || 'disabled';

    // 1. Lista de sites que NÃO se aplicam (Blacklist) sempre desativa
    if (matchesDomainList(hostname, settings.blacklist)) {
      return 'disabled';
    }

    // 2. Override específico por site (Ativado / Desativado / Personalizado)
    const cleanHost = hostname.toLowerCase();
    const noWwwHost = cleanHost.replace(/^www\./, '');
    const siteOverride =
      (settings.siteModes && (settings.siteModes[cleanHost] || settings.siteModes[noWwwHost])) || null;
    if (siteOverride) {
      return siteOverride;
    }

    // 3. Se estiver no modo "Apenas sites que se aplicam (Whitelist)"
    if (settings.listMode === 'whitelist') {
      if (!matchesDomainList(hostname, settings.whitelist)) {
        return 'disabled';
      }
      return settings.globalMode === 'disabled' ? 'active' : settings.globalMode;
    }

    // 4. Modo padrão "Todos exceto bloqueados (Blacklist)"
    // Se o global estiver desativado, mas o site está explicitamente na whitelist ("sites que se aplicam"), ativa!
    if (settings.globalMode === 'disabled') {
      if (matchesDomainList(hostname, settings.whitelist)) {
        return 'active';
      }
      return 'disabled';
    }

    return settings.globalMode || 'active';
  }

  function getRulesForHostname(hostname, customRulesMap) {
    if (!customRulesMap || typeof customRulesMap !== 'object') return [];
    const globalRules = Array.isArray(customRulesMap['*']) ? customRulesMap['*'] : [];
    const cleanHost = (hostname || '').toLowerCase();
    const noWww = cleanHost.replace(/^www\./, '');
    const exactRules = Array.isArray(customRulesMap[cleanHost]) ? customRulesMap[cleanHost] : [];
    const noWwwRules = noWww !== cleanHost && Array.isArray(customRulesMap[noWww]) ? customRulesMap[noWww] : [];
    return [...globalRules, ...noWwwRules, ...exactRules].filter((r) => r && r.enabled !== false);
  }

  function buildCustomCssText(rules) {
    if (!Array.isArray(rules) || rules.length === 0) return '';
    return rules
      .map((rule) => {
        if (!rule || !rule.selector) return '';
        const decls = [];
        if (rule.backgroundColor) {
          decls.push(`background-color: ${rule.backgroundColor} !important;`);
          decls.push(`background-image: none !important;`);
        }
        if (rule.color) {
          decls.push(`color: ${rule.color} !important;`);
        }
        if (rule.borderColor) {
          decls.push(`border-color: ${rule.borderColor} !important;`);
        }
        if (rule.backdropBlur) {
          decls.push(`backdrop-filter: blur(18px) !important;`);
          decls.push(`-webkit-backdrop-filter: blur(18px) !important;`);
        }
        if (decls.length === 0) return '';
        return `${rule.selector} {\n  ${decls.join('\n  ')}\n}`;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  root.DenimShared = {
    DENIM_PALETTE,
    ICON_SETS,
    DEFAULT_SETTINGS,
    extractHostname,
    normalizeDomainInput,
    matchesDomainList,
    resolveEffectiveState,
    getRulesForHostname,
    buildCustomCssText
  };
})(typeof self !== 'undefined' ? self : window);
