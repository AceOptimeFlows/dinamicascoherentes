# OptimeFlow(s) Dinámicas Coherentes

Desktop-first, local-first research software for exploring **16 × 16 coherent dynamics** in the **S(i)** model within the broader **Coherencia Universal** framework.

> **Desktop recommended**
>  
> This application is designed primarily for desktop or laptop interaction. It can be opened on mobile devices, but the interface is not optimized for small touch screens.

## Overview

**OptimeFlow(s) Dinámicas Coherentes** is a progressive web app (PWA) built with plain HTML, CSS, and JavaScript. It provides an interactive environment for observing, comparing, and documenting dynamic behavior across **16 groups × 16 simultaneous structural functions**.

The software supports two complementary readings of the dynamic flow:

- **Sequential / ascending flow**: `S1 → ... → S16`
- **Structural pulse flow**: `S9 → (S1, S16) → ... → S9`

The application is intended as an **exploratory research interface**: a visual and computational container for working with the model, not a claim that the interface alone exhausts the full theoretical framework.

## Key capabilities

- **16 × 16 simulation space** for groups and structural functions
- **Dual flow interpretation**:
  - linear ascending reading
  - structural pulse reading centered on `S9`
- **Levels 0–8 plus Manual mode**
- **Manual seeding** of the 16 groups
- **Live numerical band** with optional `r` display and export tools
- **Canvas-based visualizer** for all groups or a single selected group
- **Notes panel** stored locally in the browser
- **Multilingual interface** with offline-ready language files
- **Installable PWA** with service-worker caching
- **Local-first behavior** with no backend required for normal use
- **Desktop-first interaction** and a mobile warning for non-optimized screens

## Technology profile

- No build step required
- No framework dependency
- Static deployment friendly
- Progressive Web App (PWA)
- Offline-first service worker
- Browser-based local storage for preferences, notes, and manual seeds

## Project layout

```text
.
├── index.html
├── main.js
├── styles.css
├── i18n.js
├── sw.js
├── manifest.webmanifest
├── es.json
├── lang/
│   ├── es.json
│   ├── en.json
│   ├── de.json
│   ├── it.json
│   ├── ca.json
│   ├── pt-br.json
│   ├── ko.json
│   ├── ja.json
│   ├── zh.json
│   ├── fr.json
│   ├── ru.json
│   └── hi.json
├── assets/
│   └── img/
│       ├── logo.png
│       ├── dinamicacoherente180.png
│       ├── dinamicacoherente192.png
│       └── dinamicacoherente512.png
├── README.md
├── CITATION.cff
└── .zenodo.json
```

## Running locally

Because the app uses a service worker, it should be served over **HTTP(S)** during development. Do not rely on `file://` if you want installability and offline behavior.

### Option 1: Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Option 2: Any static host

You can deploy the project to any static hosting service that correctly serves:

- `index.html`
- JavaScript and CSS assets
- `manifest.webmanifest`
- `sw.js`
- `lang/*.json`
- `assets/img/*`

## Installation and offline use

Once served through a PWA-capable browser:

1. Open the app.
2. Let the service worker finish caching the core shell.
3. Install it from the browser's install option, if desired.
4. Reopen it normally or launch it as an installed app.

### What works offline

After the first successful load, the app can keep the following available offline:

- the core application shell
- interface scripts and styles
- the manifest
- local language dictionaries
- logo and PWA icons

### What still needs connectivity

External links remain online-only, including:

- website links
- DOI links
- Zenodo links
- ORCID links

## Interface guide

### Main regions

- **Top live table**  
  Shows the current numerical state of the 16 × 16 system.

- **Floating control panel**  
  Controls playback, levels, precision, flow mode, and simulation behavior.

- **Central visualizer**  
  Draws the active dynamics on canvas, either for all 16 groups or for a selected group.

- **Notes and side tools**  
  Provide local note-taking, view switching, and single-group inspection.

### Main controls

- **Start / Pause / Step / Slowdown / Reset**
- **Level selector**
- **Structural Flow toggle**
- **Show r / log r / sin → off / draw formula**
- **CSV export tools**
- **All-groups vs. single-group view**
- **Manual seed application**

### Keyboard shortcuts

- `A` → Reset
- `Space` → Play / Pause
- `E` → Export CSV
- `R` → Toggle slowdown
- `S` → Single simulation step

## Internationalization

The interface supports the following languages:

- Spanish
- English
- German
- Italian
- Catalan
- Brazilian Portuguese
- Korean
- Japanese
- Chinese
- French
- Russian
- Hindi

The translation layer is managed through `i18n.js` and the `lang/` folder. A root-level `es.json` can serve as a fallback/compatibility dictionary, while the service worker can pre-cache language files for offline use.

## Privacy and local storage

This project is designed to run **locally in the browser**.

### Stored locally

Depending on how you use the app, the browser may store:

- theme preference
- language preference
- notes
- manual seeds
- PWA cache for offline use

### Not used by default

- no analytics
- no remote tracking
- no server-side processing of your simulation state
- no external backend required for normal interaction

## Research context

This software is an interactive container for exploring dynamic behavior associated with the **16 S(i)** model inside the broader **Coherencia Universal** line of work.

Its purpose is to support:

- visualization
- comparative reading of flow modes
- live inspection of intermediate values
- documentation of observations
- offline, local, reproducible interaction

It should be read as a **research-oriented implementation layer**, not as a substitute for the essays or as an exhaustive closure of the framework.

## Companion essays

The software is in dialogue with the following companion works:

1. **Las 16 Funciones Estructurales Simultáneas (S(i))**  
   DOI: https://doi.org/10.5281/zenodo.18751249  
   Record: https://zenodo.org/records/18751249

2. **Fundamentos ontológicos y epistemológicos de la Coherencia Universal (CU)**  
   DOI: https://doi.org/10.5281/zenodo.18702121  
   Record: https://zenodo.org/records/18702121

3. **La Escala de Coherencia Universal de Precisión Limitada**  
   DOI: https://doi.org/10.5281/zenodo.18714577  
   Record: https://zenodo.org/records/18714577

## Citation

This repository includes both:

- `CITATION.cff` for software citation metadata
- `.zenodo.json` for Zenodo/GitHub release metadata

## DOI

    10.5281/zenodo.19262637


## Author

**Andrés Calvo Espinosa**  
ORCID: https://orcid.org/0009-0005-4079-7418  
Website: https://www.optimeflow.com


## License

MIT License.
