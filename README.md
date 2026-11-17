# Denim Dark Theme — Star Wars Edition

Extensão de navegador (Manifest V3) que aplica o tema **Denim Dark** em qualquer site, com inspetor visual de elementos, modal de personalização de cores, gerenciamento de listas de sites e ícones temáticos de Star Wars.

## Funcionalidades

- **Três modos de operação** (configuração global padrão ou por site):
  - **Ativado** (*Darth Vader Preto*): aplica o tema Denim Dark completo na página.
  - **Personalizado** (*Capacete Comando*): aplica suas regras de cores customizadas por elemento, com opção de manter o fundo escuro base.
  - **Desativado** (*Capacete Stormtrooper Branco*): mantém o site com a aparência original.
- **Inspetor visual de elementos**: selecione qualquer elemento diretamente na página e personalize suas cores por meio do modal integrado com a paleta oficial Denim Dark.
- **Listas de sites (Whitelist e Blacklist)**:
  - *Aplicar em todos os sites, exceto na lista "Não se Aplicam"* (Blacklist).
  - *Aplicar apenas nos sites da lista "Se Aplicam"* (Whitelist).
- **Painel de Controle (`options`)**: gerenciamento de modo global, listas de domínios, prévia da paleta Denim Dark, além de **Exportar JSON**, **Importar JSON** e **Resetar Tudo**.

## Atalhos de Teclado

| Atalho | Ação |
| --- | --- |
| `Alt+Shift+D` | Selecionar elemento na página para personalizar cor |
| `Alt+Shift+T` | Alternar entre Ativado, Personalizado e Desativado |

## Instalação Local (Chrome / Edge / Brave)

1. Acesse `chrome://extensions/` (ou `edge://extensions/`).
2. Ative o **Modo do desenvolvedor** no canto superior direito.
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta raiz deste projeto (onde está o arquivo `manifest.json`).

## Estrutura do Projeto

```text
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── content.js
│   ├── modal.js
│   └── picker.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── shared/
│   └── tokens.js
├── styles/
│   ├── tokens.css
│   └── universal-engine.css
└── icons/
    ├── vader-*.png / vader.svg
    ├── commando-*.png / commando.svg
    └── stormtrooper-*.png / stormtrooper.svg
```
