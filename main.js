/* Dinámicas Coherentes – CU PWA 16×16 Sᵢ
   - Niveles 0..8 + Manual
   - Números con hasta 32 decimales (por defecto 16)
   - Banda de números a lo ancho bajo el header
   - Explicación por nivel, Notas (localStorage), 4×4 en el visualizador
   - HUD central con Teclas + métricas (STEP, AVG, etc.)
   - Inversor por bisección + Ver/Log r + sin→off + Export de r (snapshot/log) + Export estado (val+r)
   Teclas: A Reset | Espacio Play/Pause | E Export CSV | R Ralentizar | S Paso

   Cambios UI (2026):
   • Header/Footer estilo OptimeFlow(s) (como Normaliza Coherente).
   • Engranaje en header: Idioma / Temas + toggle Panel de Control.
   • Controles del header → Panel de Control flotante (draggable).
   • i18n externo: i18n.js + es.json (todos los textos en JSON).
*/

(async () => {
  // ===== i18n helpers =====
  const I18n = window.I18n;
  const t = (key, vars) => (I18n && typeof I18n.t === 'function') ? I18n.t(key, vars) : String(key);

  // Esperar a i18n para que el DOM inicial quede traducido
  if (I18n && I18n.ready) {
    try { await I18n.ready; } catch {}
  }

  // ===== Toast =====
  const $toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(msg, type = 'ok', ms = 1600) {
    if (!$toast) return;
    $toast.hidden = false;
    $toast.textContent = String(msg || '');
    $toast.dataset.type = type;
    $toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $toast.classList.remove('show');
      setTimeout(() => { $toast.hidden = true; }, 220);
    }, ms);
  }

  const MOBILE_WARNING_SESSION_KEY = 'optimeflow-mobile-warning-shown';
  const OFFLINE_READY_SESSION_KEY = 'optimeflow-offline-ready-shown';

  function isLikelyMobileDevice() {
    const ua = navigator.userAgent || '';
    const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const narrowScreen = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 1024;
    return mobileUa || (coarsePointer && narrowScreen);
  }

  function maybeShowMobileWarning() {
    const dlg = document.getElementById('mobileWarningDialog');
    if (!dlg || !isLikelyMobileDevice()) return;

    let alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem(MOBILE_WARNING_SESSION_KEY) === '1'; } catch {}
    if (alreadyShown) return;

    try { sessionStorage.setItem(MOBILE_WARNING_SESSION_KEY, '1'); } catch {}
    openDialogById('mobileWarningDialog');
  }

  window.addEventListener('pwa:offline-ready', () => {
    let alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem(OFFLINE_READY_SESSION_KEY) === '1'; } catch {}
    if (alreadyShown) return;

    try { sessionStorage.setItem(OFFLINE_READY_SESSION_KEY, '1'); } catch {}
    showToast(t('toasts.offlineReady'), 'ok', 1800);
  });

  window.addEventListener('pwa:installed', () => {
    showToast(t('toasts.pwaInstalled'), 'ok', 1800);
  });

  function warmOfflineLanguageCache() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready
      .then((reg) => {
        const target = reg.active || navigator.serviceWorker.controller;
        if (target) {
          target.postMessage({ type: 'WARM_LANGS' });
        }
      })
      .catch(() => {});
  }

  window.addEventListener('pwa:offline-ready', warmOfflineLanguageCache);
  window.addEventListener('online', warmOfflineLanguageCache);

  // ===== Footer spacer (evita que el footer fijo tape contenido) =====
  const $footer = document.getElementById('siteFooter');
  const $footerSpacer = document.getElementById('footerSpacer');

  function syncFooterSpacer() {
    if (!$footer || !$footerSpacer) return;
    const h = Math.ceil($footer.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty('--footer-h', `${h}px`);
    $footerSpacer.style.height = `${h}px`;
  }

  if ($footer) {
    syncFooterSpacer();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => syncFooterSpacer());
      ro.observe($footer);
    }
    window.addEventListener('resize', syncFooterSpacer);
  }

  // Año dinámico en footer
  const $year = document.getElementById('f-year');
  if ($year) $year.textContent = String(new Date().getFullYear());

  // ===== Gear menu + dialogs =====
  const $gearButton = document.getElementById('gearButton');
  const $gearMenu = document.getElementById('gearMenu');

  function closeGearMenu() {
    if (!$gearMenu || !$gearButton) return;
    $gearMenu.classList.remove('open');
    $gearButton.setAttribute('aria-expanded', 'false');
    $gearMenu.setAttribute('aria-hidden', 'true');
  }

  function toggleGearMenu() {
    if (!$gearMenu || !$gearButton) return;
    const willOpen = !$gearMenu.classList.contains('open');
    if (willOpen) {
      $gearMenu.classList.add('open');
      $gearButton.setAttribute('aria-expanded', 'true');
      $gearMenu.setAttribute('aria-hidden', 'false');
    } else {
      closeGearMenu();
    }
  }

  function openDialogById(id) {
    const dlg = document.getElementById(id);
    if (!dlg) return;

    if (id === 'whatSeeingDialog') refreshWhatSeeingStatus();

    if (typeof dlg.showModal === 'function') {
      try { dlg.showModal(); } catch { /* noop */ }
    }
  }

  function closeDialog(dlg) {
    if (!dlg) return;
    try { dlg.close(); } catch {}
  }

  if ($gearButton) {
    $gearButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGearMenu();
    });
  }

  // Cerrar menú al click fuera / Escape
  document.addEventListener('click', (e) => {
    if (!$gearMenu || !$gearButton) return;
    if (!$gearMenu.classList.contains('open')) return;
    const target = e.target;
    if (target === $gearButton) return;
    if ($gearMenu.contains(target)) return;
    closeGearMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGearMenu();
  });

  // data-open en cualquier parte
  document.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-open');
      if (id) {
        closeGearMenu();
        openDialogById(id);
      }
    });
  });

  // data-close en modales
  document.querySelectorAll('dialog').forEach(dlg => {
    dlg.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeDialog(dlg));
    });
    // click en backdrop (solo si click directo en <dialog>)
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg) closeDialog(dlg);
    });
  });

  // ===== Panel de Control: show/hide + drag + persistencia =====
  const $controlPanel = document.getElementById('controlPanel');
  const $panelHandle = document.getElementById('controlPanelHandle');
  const $panelMinBtn = document.getElementById('controlPanelMinBtn');
  const $panelCloseBtn = document.getElementById('controlPanelCloseBtn');
  const $togglePanelBtn = document.getElementById('togglePanelBtn');

  const PANEL_POS_KEY = 'cu-pwa-control-panel-pos';
  const PANEL_STATE_KEY = 'cu-pwa-control-panel-state';

  function loadPanelState() {
    if (!$controlPanel) return;
    try {
      const raw = localStorage.getItem(PANEL_STATE_KEY);
      if (!raw) return;
      const st = JSON.parse(raw);
      if (st && typeof st === 'object') {
        if (st.hidden) $controlPanel.hidden = true;
        if (st.minimized) $controlPanel.classList.add('minimized');
      }
    } catch {}
  }

  function savePanelState() {
    if (!$controlPanel) return;
    try {
      const st = {
        hidden: !!$controlPanel.hidden,
        minimized: $controlPanel.classList.contains('minimized')
      };
      localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(st));
    } catch {}
  }

  function loadPanelPos() {
    if (!$controlPanel) return;
    try {
      const raw = localStorage.getItem(PANEL_POS_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (!pos || typeof pos !== 'object') return;

      if (Number.isFinite(pos.x)) $controlPanel.style.left = `${pos.x}px`;
      if (Number.isFinite(pos.y)) $controlPanel.style.top = `${pos.y}px`;
    } catch {}
  }

  function savePanelPos(x, y) {
    try {
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ x, y }));
    } catch {}
  }

  function setPanelVisible(visible) {
    if (!$controlPanel) return;
    $controlPanel.hidden = !visible;
    savePanelState();
    showToast(visible ? t('toasts.panelShown') : t('toasts.panelHidden'), visible ? 'ok' : 'warn', 1100);
  }

  function togglePanelVisible() {
    if (!$controlPanel) return;
    setPanelVisible($controlPanel.hidden);
  }

  function togglePanelMinimized() {
    if (!$controlPanel) return;
    $controlPanel.classList.toggle('minimized');
    savePanelState();
  }

  if ($togglePanelBtn) {
    $togglePanelBtn.addEventListener('click', () => {
      closeGearMenu();
      togglePanelVisible();
    });
  }

  if ($panelCloseBtn) {
    $panelCloseBtn.addEventListener('click', () => setPanelVisible(false));
  }

  if ($panelMinBtn) {
    $panelMinBtn.addEventListener('click', () => togglePanelMinimized());
  }

  // Drag logic
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function getFooterHeight() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--footer-h').trim();
    const num = parseFloat(v);
    return Number.isFinite(num) ? num : 64;
  }

  function getHeaderHeight() {
    const header = document.querySelector('.brand-header');
    if (!header) return 0;
    return Math.ceil(header.getBoundingClientRect().height || 0);
  }

  function clampPanelIntoViewport() {
    if (!$controlPanel || $controlPanel.hidden) return;

    const rect = $controlPanel.getBoundingClientRect();
    const pad = 8;

    const headerH = getHeaderHeight();
    const footerH = getFooterHeight();

    const minX = pad;
    const maxX = Math.max(minX, window.innerWidth - rect.width - pad);

    const minY = headerH + pad;
    const maxY = Math.max(minY, window.innerHeight - footerH - rect.height - pad);

    const curLeft = parseFloat($controlPanel.style.left || rect.left);
    const curTop = parseFloat($controlPanel.style.top || rect.top);

    const x = clamp(curLeft, minX, maxX);
    const y = clamp(curTop, minY, maxY);

    $controlPanel.style.left = `${x}px`;
    $controlPanel.style.top = `${y}px`;
    savePanelPos(x, y);
  }

  if ($controlPanel) {
    loadPanelState();
    loadPanelPos();
    clampPanelIntoViewport();

    window.addEventListener('resize', clampPanelIntoViewport);
  }

  if ($panelHandle && $controlPanel) {
    let dragging = false;
    let dx = 0;
    let dy = 0;

    const onPointerMove = (ev) => {
      if (!dragging) return;

      const rect = $controlPanel.getBoundingClientRect();
      const pad = 8;

      const headerH = getHeaderHeight();
      const footerH = getFooterHeight();

      const minX = pad;
      const maxX = Math.max(minX, window.innerWidth - rect.width - pad);

      const minY = headerH + pad;
      const maxY = Math.max(minY, window.innerHeight - footerH - rect.height - pad);

      const x = clamp(ev.clientX - dx, minX, maxX);
      const y = clamp(ev.clientY - dy, minY, maxY);

      $controlPanel.style.left = `${x}px`;
      $controlPanel.style.top = `${y}px`;
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;

      // guardar posición final
      const left = parseFloat($controlPanel.style.left);
      const top = parseFloat($controlPanel.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) savePanelPos(left, top);
    };

    $panelHandle.addEventListener('pointerdown', (ev) => {
      // Evitar drag si el click viene de un botón (min/close) dentro del handle
      const target = ev.target;
      if (target && target.closest && target.closest('.panel-action-btn')) return;

      ev.preventDefault();
      dragging = true;

      const rect = $controlPanel.getBoundingClientRect();
      dx = ev.clientX - rect.left;
      dy = ev.clientY - rect.top;

      try { $panelHandle.setPointerCapture(ev.pointerId); } catch {}

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
      window.addEventListener('pointercancel', onPointerUp, { once: true });
    });

    // Teclado: Enter/Espacio en handle -> minimizar
    $panelHandle.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        togglePanelMinimized();
      }
    });
  }

  // ===== Idioma (dialog) =====
  const $langDialog = document.getElementById('langDialog');

  function syncLanguageButtons() {
    if (!$langDialog) return;
    const activeLang = (I18n && typeof I18n.getLanguage === 'function')
      ? String(I18n.getLanguage() || 'es').toLowerCase()
      : 'es';

    $langDialog.querySelectorAll('[data-lang]').forEach(btn => {
      const lang = String(btn.getAttribute('data-lang') || '').toLowerCase();
      const isActive = lang === activeLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  if ($langDialog) {
    $langDialog.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lang = (btn.getAttribute('data-lang') || 'es').toLowerCase();
        let result = null;

        if (I18n && typeof I18n.setLanguage === 'function') {
          result = await I18n.setLanguage(lang);
          if (result && result.usedFallback) {
            showToast(t('toasts.langFallback'), 'warn', 1800);
          }
        }

        syncLanguageButtons();
        closeDialog($langDialog);

        // Re-render de partes generadas por JS
        document.title = t('app.title');
        renderExplicacion();
        updateNumbersTable();
        updateSingleGroupData();
      });
    });

    syncLanguageButtons();
  }

  // ===== Temas (dialog) =====
  const THEME_KEY = 'cu-pwa-theme';
  const defaultTheme = localStorage.getItem(THEME_KEY) || 'dark';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0f14';
      meta.setAttribute('content', bg);
    }
    syncFooterSpacer();
  }

  function syncThemeChips() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('.theme-chip[data-theme]').forEach(chip => {
      const isOn = chip.getAttribute('data-theme') === cur;
      chip.classList.toggle('active', isOn);
      chip.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    });
  }

  setTheme(defaultTheme);
  syncThemeChips();

  const $themeDialog = document.getElementById('themeDialog');
  if ($themeDialog) {
    $themeDialog.querySelectorAll('.theme-chip[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const th = btn.getAttribute('data-theme') || 'dark';
        setTheme(th);
        syncThemeChips();
        closeDialog($themeDialog);
      });
    });
  }

  // ===== util =====
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hsl = (h, s = 100, l = 60, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const MAX_ABS_SEED = 0.99999999999999;

  // ===== canvas =====
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);

  // ===== UI =====
  const $btnStartPause = document.getElementById('btnStartPause'); // oculto pero operativo (atajos)
  const $btnPlay = document.getElementById('btnPlay');
  const $btnPause = document.getElementById('btnPause');
  const $btnReset = document.getElementById('btnReset');
  const $btnExport = document.getElementById('btnExport');
  const $btnStep = document.getElementById('btnStep');
  const $btnRalentizar = document.getElementById('btnRalentizar');
  const $stepFps = document.getElementById('stepFps');
  const $drawMode = document.getElementById('drawMode');
  const $decimals = document.getElementById('decimals');
  const $chkStructuralFlow = document.getElementById('chkStructuralFlow');
  const $nivel = document.getElementById('nivelSelect');
  const $nivelName = document.getElementById('nivelName');
  const $explain = document.getElementById('explainContent');

  // HUD
  const $info = document.getElementById('info');

  // Números
  const $numbersTable = document.getElementById('numbersTable');
  const $btnCopyNumbers = document.getElementById('btnCopyNumbers');
  const $btnDownloadNumbers = document.getElementById('btnDownloadNumbers');

  // Herramientas r
  const $chkShowR = document.getElementById('chkShowR');
  const $chkLogR = document.getElementById('chkLogR');
  const $chkSinOff = document.getElementById('chkSinOff');
  const $btnExportRSnapshot = document.getElementById('btnExportRSnapshot');
  const $btnExportRLog = document.getElementById('btnExportRLog');
  const $btnExportStateLog = document.getElementById('btnExportStateLog');

  // Notas
  const $notesText = document.getElementById('notesText');
  const $btnSaveNotes = document.getElementById('btnSaveNotes');
  const $btnExportNotes = document.getElementById('btnExportNotes');
  const $notesStatus = document.getElementById('notesStatus');

  // Semillas Manual
  const $manualSeedsSection = document.getElementById('manualSeedsSection');
  const $seedGrid = document.getElementById('seedGrid');
  const $btnApplySeeds = document.getElementById('btnApplySeeds');
  const $btnDemoG1 = document.getElementById('btnDemoG1');
  const $btnClearSeeds = document.getElementById('btnClearSeeds');
  const $seedStatus = document.getElementById('seedStatus');
  const $manualRunLevel = document.getElementById('manualRunLevel');
  const SEEDS_KEY = 'cu-pwa-manual-seeds';

  // Controles de visualización
  const $viewMode = document.getElementById('viewMode');
  const $groupSelect = document.getElementById('groupSelect');
  const $groupSelectWrap = document.getElementById('groupSelectWrap');
  const $singleGroupData = document.getElementById('singleGroupData');
  const $whatSeeingDialog = document.getElementById('whatSeeingDialog');
  const $whatSeeingStatus = document.getElementById('whatSeeingStatus');

  function boolStateText(value) {
    return value ? t('dialogs.whatSeeing.flags.on') : t('dialogs.whatSeeing.flags.off');
  }

  function drawBasisText() {
    return state.drawUseFormula
      ? t('dialogs.whatSeeing.drawBasisValues.formula')
      : t('dialogs.whatSeeing.drawBasisValues.r');
  }

  function levelStateText() {
    if (state.nivel === 'M') {
      return `${t('levels.nM')} · ${t('dialogs.whatSeeing.manualDerivedLevel', { lvl: state.manualRunLevel })}`;
    }
    return t(`levels.n${state.nivel}`);
  }

  function viewStateText() {
    if (state.viewMode === 'single') return `${t('view.single')} · G${state.selectedGroup + 1}`;
    return t('view.all');
  }

  function runStateText() {
    return state.paused
      ? t('dialogs.whatSeeing.statusValues.paused')
      : t('dialogs.whatSeeing.statusValues.running');
  }

  function statusItem(label, value) {
    return `
      <div class="status-item">
        <span class="status-label">${label}</span>
        <strong class="status-value">${value}</strong>
      </div>
    `;
  }

  function refreshWhatSeeingStatus() {
    if (!$whatSeeingStatus) return;

    const fps = clamp(parseInt($stepFps.value, 10) || 10, 1, 60);
    const slowText = state.ralentizar_activo
      ? `${state.valor_ralentizador_ms} ms`
      : t('hud.off');

    $whatSeeingStatus.innerHTML = [
      statusItem(t('dialogs.whatSeeing.status.runState'), runStateText()),
      statusItem(t('dialogs.whatSeeing.status.step'), String(state.stepCounter)),
      statusItem(t('dialogs.whatSeeing.status.seconds'), String(state.secondCounter)),
      statusItem(t('dialogs.whatSeeing.status.level'), levelStateText()),
      statusItem(t('dialogs.whatSeeing.status.flow'), state.structuralFlow ? t('flow.modeStructural') : t('flow.modeLinear')),
      statusItem(t('dialogs.whatSeeing.status.view'), viewStateText()),
      statusItem(t('dialogs.whatSeeing.status.stepFps'), String(fps)),
      statusItem(t('dialogs.whatSeeing.status.decimals'), String(state.precision)),
      statusItem(t('dialogs.whatSeeing.status.showR'), boolStateText(state.showR)),
      statusItem(t('dialogs.whatSeeing.status.logR'), boolStateText(state.logR)),
      statusItem(t('dialogs.whatSeeing.status.sinOff'), boolStateText(state.sinOff)),
      statusItem(t('dialogs.whatSeeing.status.drawBasis'), drawBasisText()),
      statusItem(t('dialogs.whatSeeing.status.slow'), slowText)
    ].join('');
  }

  // ===== modelo =====
  const GROUPS = 16;
  const SI = 16;
  const baseSeq = [0,0.89,0.76,0.91,0.85,0.72,0.66,0.81,0.77,0.69,0.73,0.58,0.62,0.79,0.83];

  function crearConjuntoS(secuencia) {
    const minVals = [-1,0,0,0,-1,-1,0,-1,-1,0,0,-1,0,0,0];
    const maxVals = [ 1,1,1,1, 1, 1,1, 1, 1,1,1, 1,1,1,1];
    const S = [];
    for (let i = 0; i < 15; i++) {
      S[i] = {
        w: secuencia[i], C: secuencia[i], E: secuencia[i], t: secuencia[i],
        Ei_1: (i === 0) ? 1 : (S[i-1].E),
        formula_value: 0, total_value: secuencia[i],
        min_value: minVals[i], max_value: maxVals[i]
      };
    }
    S[15] = { w:0, C:0, E:0, t:0, Ei_1:0, formula_value:0, total_value:0, min_value:0, max_value:1 };
    return S;
  }

  // ===== inversor CU por bisección =====
  function fxFactory(name) {
    switch (name) {
      case 'sin': return (r) => Math.sin(r);
      case 'cos': return (r) => Math.cos(r);
      case 'tan': return (r) => Math.tan(r);
      case '1 - sin': return (r) => 1 - Math.sin(r);
      case 'sqrt': return (r) => Math.sqrt(r);
      case 'r * sin': return (r) => r * Math.sin(r);
      case 'r * cos': return (r) => r * Math.cos(r);
      case 'ln(r + 1)': return (r) => Math.log(r + 1);
      case 'r^2': return (r) => r ** 2;
      case 'e^r': return (r) => Math.E ** r;
      case '1 / (r + 1)': return (r) => 1 / (r + 1);
      case 'r^3': return (r) => r ** 3;
      case 'r': return (r) => r;
      case '1 / (r^2 + 1)': return (r) => 1 / (r ** 2 + 1);
      case 'r * ln(r + 1)': return (r) => r * Math.log(r + 1);
      case 'r^2 * e^(-r)': return (r) => (r ** 2) * (Math.E ** (-r));
      case '(sin(r) * e^(-r^2)) / (1 + r^2)': return (r) => (Math.sin(r) * Math.exp(-(r**2))) / (1 + r**2);
      default: return null;
    }
  }

  function invertByBisection(target, fx, rmin = 1e-6, rmax = 10, coarse = 0.25, tol = 1e-12, maxIter = 80) {
    const absT = Math.abs(target);
    const wantSign = Math.sign(target) || 1;

    const phi = (r) => {
      const fr = fx(r);
      if (!Number.isFinite(fr)) return Number.NEGATIVE_INFINITY;
      if (Math.abs(fr) < 1e-14) return -1;
      if (Math.sign(fr) !== wantSign) return -1;
      return Math.abs(fr) - absT;
    };

    let a = rmin, b = rmin + coarse, phia = phi(a), phib = phi(b);
    let found = false;
    for (a = rmin, b = rmin + coarse; b <= rmax + 1e-12; a += coarse, b += coarse) {
      phia = phi(a); phib = phi(b);
      if (phia < 0 && phib >= 0) { found = true; break; }
      if (phia >= 0) { b = a; a = Math.max(rmin, a - coarse); phia = phi(a); found = true; break; }
    }
    if (!found) return undefined;

    let left = Math.max(rmin, a), right = Math.min(rmax, b);
    for (let it = 0; it < maxIter && right - left > tol; it++) {
      const mid = 0.5 * (left + right);
      const phim = phi(mid);
      if (phim >= 0) right = mid;
      else left = mid;
    }
    const r = Math.max(rmin, Math.min(rmax, 0.5 * (left + right)));
    const fr = fx(r);
    if (!Number.isFinite(fr) || Math.abs(fr) < 1e-14 || Math.sign(fr) !== wantSign) return undefined;

    const x = Math.pow(Math.abs(absT / Math.abs(fr)), 1/5);
    if (!(x > 0 && x <= 1)) return undefined;

    const round = (v) => Math.round(v * 1e16) / 1e16;
    return { r: round(r), x: round(x), fx: round(fr) };
  }

  const invCache = new Map();
  function calcular_inversion_CU(valor_deseado, nombre_formula) {
    const fx = fxFactory(nombre_formula);
    if (!fx || !isFinite(valor_deseado)) return undefined;
    const vkey = `${nombre_formula}|${Number(valor_deseado).toFixed(8)}`;
    const cached = invCache.get(vkey);
    if (cached) return cached;
    const rsol = invertByBisection(valor_deseado, fx);
    if (rsol) invCache.set(vkey, rsol);
    return rsol;
  }

  const FLOW_MODE_KEY = 'cu-pwa-structural-flow';
  const structuralFlowStored = (() => {
    try { return localStorage.getItem(FLOW_MODE_KEY) === '1'; } catch { return false; }
  })();

  // ===== estado =====
  const state = {
    groups: [],
    S_labels: Array.from({length: SI}, (_, i) => `S${i+1}`),
    coincidencias: Array.from({length: GROUPS}, () => 1),

    r_iniciales: Array.from({length: GROUPS}, () => 0),
    r_iniciales_previos: Array.from({length: GROUPS}, () => 0),
    si_valores_previos: Array.from({length: GROUPS}, () => Array.from({length: SI}, () => 0)),

    r_usados: Array.from({length: GROUPS}, () => 0),
    r_si: Array.from({length: GROUPS}, () => Array.from({length: SI}, () => 0)),

    r_log: [],
    state_log: [],

    patrones_guardados: [],

    reset_tiempo: false,
    paused: true,
    lastKey: '',
    ralentizar_activo: false,
    valor_ralentizador_ms: 0,

    stepCounter: 0,
    secondCounter: 0,
    frameTimer: 0,
    vuelta_actual: 0,

    stepIntervalMs: 1000/10,
    drawMode: 'full',
    precision: 16,
    nivel: '1',
    showR: false,
    logR: false,
    sinOff: false,
    structuralFlow: structuralFlowStored,

    // Visualización
    viewMode: 'all',
    selectedGroup: 0,

    // Manual
    manualRunLevel: '5',

    // Dibujo formula vs r
    drawUseFormula: false
  };

  function initGroups() {
    state.groups = []; state.coincidencias = [];
    for (let i = 0; i < GROUPS; i++) {
      state.groups.push(crearConjuntoS(baseSeq));
      state.coincidencias.push(1);
    }
  }

  // ===== Semillas Manual: UI =====
  const seedInputs = [];
  function buildSeedsUI() {
    $seedGrid.innerHTML = '';
    seedInputs.length = 0;
    for (let g = 0; g < GROUPS; g++) {
      const cell = document.createElement('div'); cell.className = 'seedCell';
      const lab = document.createElement('label'); lab.textContent = `G${g+1}`;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = '0.000000000000000';
      inp.value = '0';
      cell.appendChild(lab); cell.appendChild(inp);
      $seedGrid.appendChild(cell);
      seedInputs.push(inp);
    }
    try {
      const raw = localStorage.getItem(SEEDS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        for (let i = 0; i < Math.min(arr.length, seedInputs.length); i++) seedInputs[i].value = String(arr[i]);
      }
    } catch {}
  }

  function readSeedsFromUI() {
    const seeds = [];
    for (let i = 0; i < GROUPS; i++) {
      let v = parseFloat(seedInputs[i].value.replace(',', '.'));
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(-MAX_ABS_SEED, Math.min(MAX_ABS_SEED, v));
      seeds.push(v);
    }
    return seeds;
  }

  function applySeedsFromUI() {
    const seeds = readSeedsFromUI();
    state.r_iniciales = seeds.slice();
    try {
      localStorage.setItem(SEEDS_KEY, JSON.stringify(seeds));
      $seedStatus.textContent = t('manual.seedsApplied');
      setTimeout(() => $seedStatus.textContent = '', 1200);
    } catch {}
  }

  // ===== seed/reset =====
  function clearCurrentValues() {
    for (let g = 0; g < GROUPS; g++) {
      for (let s = 0; s < SI; s++) {
        state.groups[g][s].total_value = 0.0;
        state.groups[g][s].formula_value = 0.0;
        state.si_valores_previos[g][s] = 0.0;
        state.r_si[g][s] = 0.0;
      }
      state.r_usados[g] = 0.0;
    }
  }

  function restartCurrentRun() {
    state.reset_tiempo = true;
    state.vuelta_actual = 0;
    state.stepCounter = 0;
    state.secondCounter = 0;
    state.frameTimer = 0;
    state.r_iniciales_previos = Array.from({length: GROUPS}, () => 0);
    if (state.logR) { state.r_log.length = 0; state.state_log.length = 0; }
    clearCurrentValues();
    updateNumbersTable();
    computeRalentizadorMs();
  }

  function seedOnA() {
    if (state.nivel === '0') {
      state.r_iniciales = Array.from({length: GROUPS}, () => 0);
      state.r_iniciales[0] = 0.000000000000010;
    } else if (state.nivel === 'M') {
      // usa las semillas manuales ya aplicadas
    } else {
      state.r_iniciales = Array.from({length: GROUPS}, () => Math.floor(rnd(1, 10)) / 10000);
    }

    restartCurrentRun();
  }

  // ===== Tabla de números =====
  const cellRefs = Array.from({length: SI}, () => Array.from({length: GROUPS}, () => null));
  const prevMatrix = Array.from({length: GROUPS}, () => Array.from({length: SI}, () => 0));

  function buildNumbersTable() {
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');

    const th0 = document.createElement('th');
    th0.textContent = t('table.corner');
    hr.appendChild(th0);

    for (let g = 0; g < GROUPS; g++) {
      const th = document.createElement('th');
      th.textContent = `G${g+1}`;
      hr.appendChild(th);
    }
    thead.appendChild(hr);

    const tbody = document.createElement('tbody');
    for (let s = 0; s < SI; s++) {
      const tr = document.createElement('tr');
      const rowH = document.createElement('th');
      rowH.textContent = `S${s+1}`;
      tr.appendChild(rowH);

      for (let g = 0; g < GROUPS; g++) {
        const td = document.createElement('td');
        td.dataset.s = s; td.dataset.g = g;
        td.textContent = '0.0000000000000000';
        tr.appendChild(td);
        cellRefs[s][g] = td;
      }
      tbody.appendChild(tr);
    }

    $numbersTable.innerHTML = '';
    $numbersTable.appendChild(thead);
    $numbersTable.appendChild(tbody);
  }

  const fmt = (v) => Number.isFinite(v) ? v.toFixed(state.precision) : 'NaN';

  function updateNumbersTable() {
    const rPrefix = t('table.rPrefix');

    for (let s = 0; s < SI; s++) {
      for (let g = 0; g < GROUPS; g++) {
        const v = state.groups[g][s].total_value;
        const td = cellRefs[s][g];
        if (!td) continue;

        if (Math.abs(v - prevMatrix[g][s]) > 1e-18) {
          td.classList.remove('changed'); td.offsetWidth; td.classList.add('changed');
          prevMatrix[g][s] = v;
        }

        if (state.showR) {
          const rHere = state.r_si[g][s];
          td.innerHTML = `<span class="val">${fmt(v)}</span><span class="sub">${rPrefix}${fmt(rHere)}</span>`;
          td.title = t('table.cellTitleWithR', { s: s + 1, g: g + 1, val: fmt(v), r: fmt(rHere) });
        } else {
          td.textContent = fmt(v);
          td.title = t('table.cellTitle', { s: s + 1, g: g + 1, val: fmt(v) });
        }

        td.classList.toggle('pos', v >= 0);
        td.classList.toggle('neg', v < 0);
      }
    }
  }

  function numbersSnapshotCSV() {
    const header = [t('table.corner'), ...Array.from({length: GROUPS}, (_, i) => `G${i+1}`)].join(',');
    const rows = [header];
    for (let s = 0; s < SI; s++) {
      const row = [`S${s+1}`];
      for (let g = 0; g < GROUPS; g++) row.push(fmt(state.groups[g][s].total_value));
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  // CSV r (snapshot y log) + estado (val+r)
  function rSnapshotCSV() {
    const header = [t('table.corner'), ...Array.from({length: GROUPS}, (_, i) => `G${i+1}`)].join(',');
    const rows = [header];
    for (let s = 0; s < SI; s++) {
      const row = [`S${s+1}`];
      for (let g = 0; g < GROUPS; g++) row.push(fmt(state.r_si[g][s]));
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  function rLogCSV() {
    const header = [
      t('exports.columns.step'),
      t('exports.columns.group'),
      t('exports.columns.rUsed'),
      ...Array.from({length: SI}, (_, i) => `r_S${i+1}`)
    ].join(',');
    return [header, ...state.r_log].join('\n');
  }

  function stateLogCSV() {
    const header = [t('exports.columns.step'), t('exports.columns.group'), t('exports.columns.rUsed')];
    for (let i = 0; i < SI; i++) { header.push(`S${i+1}`, `r_S${i+1}`); }
    return [header.join(','), ...state.state_log].join('\n');
  }

  async function copyNumbersToClipboard() {
    const tsv = numbersSnapshotCSV().replaceAll(',', '\t');
    try {
      await navigator.clipboard.writeText(tsv);
      showToast('OK', 'ok', 900);
    } catch {
      const blob = new Blob([tsv], {type: 'text/tab-separated-values;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = t('exports.numbers.snapshotTsv');
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function downloadNumbersCSV() {
    const csv = numbersSnapshotCSV();
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = t('exports.numbers.snapshotCsv');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadRSnapshot() {
    const csv = rSnapshotCSV();
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = t('exports.r.snapshot');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadRLog() {
    const csv = rLogCSV();
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = t('exports.r.log');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadStateLog() {
    const csv = stateLogCSV();
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = t('exports.r.stateLog');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== fórmulas auxiliares =====
  const IDX_S1 = 0;
  const IDX_S9 = 8;
  const IDX_S16 = 15;
  const FLOW_RETURN_LOWER = [1, 2, 3, 4, 5, 6, 7];
  const FLOW_RETURN_UPPER = [14, 13, 12, 11, 10, 9];
  const S16_FORMULA_ID = '(sin(r) * e^(-r^2)) / (1 + r^2)';
  const STRUCTURAL_MIN_R = 0.000001;
  const STRUCTURAL_BASE_R = 0.18;
  const STRUCTURAL_MAX_R = 1.25;
  const STRUCTURAL_SAFE_TAN_MAX_R = 1.18;
  const STRUCTURAL_INPUT_GAIN = 1.85;
  const STRUCTURAL_PROGRESS_EPS = 0.0005;
  const STRUCTURAL_STALL_DRIVE = 0.045;
  const STRUCTURAL_MAX_ABS_VALUE = 8;

  const FORMULA_SEQUENCE = Object.freeze([
    'sin',
    'cos',
    'tan',
    'e^r',
    'sqrt',
    'ln(r + 1)',
    '1 / (r + 1)',
    '1 / (r^2 + 1)',
    'r^2',
    'r^3',
    'r * sin',
    'r * cos',
    'r^2 * e^(-r)',
    'r * ln(r + 1)',
    '1 - sin',
    S16_FORMULA_ID
  ]);

  const FALLBACK_FORMULA_IDS = Object.freeze(FORMULA_SEQUENCE.slice(0, 15));

  function formulaIdForNode(idx) {
    return FORMULA_SEQUENCE[idx] || 'sin';
  }

  function maxRForFormula(formulaId) {
    return formulaId === 'tan' ? STRUCTURAL_SAFE_TAN_MAX_R : STRUCTURAL_MAX_R;
  }

  function clampRForFormula(formulaId, r) {
    return clamp(r, STRUCTURAL_MIN_R, maxRForFormula(formulaId));
  }

  function evaluateFormulaById(formulaId, r) {
    const safeR = clampRForFormula(formulaId, Math.abs(Number.isFinite(r) ? r : STRUCTURAL_BASE_R));
    switch (formulaId) {
      case 'sin': return Math.sin(safeR);
      case 'cos': return Math.cos(safeR);
      case 'tan': return Math.tan(safeR);
      case 'e^r': return Math.exp(safeR);
      case 'sqrt': return Math.sqrt(safeR);
      case 'ln(r + 1)': return Math.log(safeR + 1);
      case '1 / (r + 1)': return 1 / (safeR + 1);
      case '1 / (r^2 + 1)': return 1 / ((safeR ** 2) + 1);
      case 'r^2': return safeR ** 2;
      case 'r^3': return safeR ** 3;
      case 'r * sin': return safeR * Math.sin(safeR);
      case 'r * cos': return safeR * Math.cos(safeR);
      case 'r^2 * e^(-r)': return (safeR ** 2) * Math.exp(-safeR);
      case 'r * ln(r + 1)': return safeR * Math.log(safeR + 1);
      case '1 - sin': return 1 - Math.sin(safeR);
      case S16_FORMULA_ID: return (Math.sin(safeR) * Math.exp(-(safeR ** 2))) / (1 + (safeR ** 2));
      default: return Math.sin(safeR);
    }
  }

  function structuralSignalSign(...signals) {
    for (const signal of signals) {
      if (Number.isFinite(signal) && Math.abs(signal) > 1e-12) return Math.sign(signal);
    }
    return 1;
  }

  function normaliseMagnitudeToR(value, gain = STRUCTURAL_INPUT_GAIN) {
    const magnitude = Math.abs(Number.isFinite(value) ? value : 0);
    return STRUCTURAL_MAX_R * Math.tanh(magnitude * gain);
  }

  function buildBaseSignedR(g, input, fallbackSignal = 0) {
    const prevSignedR = Number.isFinite(state.r_usados[g]) ? state.r_usados[g] : 0;
    const sign = structuralSignalSign(input, fallbackSignal, prevSignedR, state.r_iniciales_previos[g], state.r_iniciales[g]);
    const norm = normaliseMagnitudeToR(input);
    const prevMagnitude = Math.abs(prevSignedR) > 0 ? Math.abs(prevSignedR) : STRUCTURAL_BASE_R;
    const phase = 0.06 * Math.abs(Math.sin(((g + 1) * 0.711) + ((state.stepCounter + 1) * 0.173)));
    const unsignedR = clamp((prevMagnitude * 0.36) + (norm * 0.52) + phase + 0.08, STRUCTURAL_MIN_R, STRUCTURAL_MAX_R);
    return sign * unsignedR;
  }

  function buildCandidateSignedR(g, idx, formulaId, drive, baseSignedR, phaseOffset = 0) {
    const prevSignedR = Number.isFinite(state.r_si[g][idx]) ? state.r_si[g][idx] : 0;
    const prevMagnitude = Math.abs(prevSignedR) > 0 ? Math.abs(prevSignedR) : STRUCTURAL_BASE_R;
    const baseMagnitude = Math.abs(Number.isFinite(baseSignedR) ? baseSignedR : 0);
    const driveMagnitude = normaliseMagnitudeToR(drive, STRUCTURAL_INPUT_GAIN + (idx * 0.015));
    const phase = 0.05 * Math.abs(Math.sin(((g + 1) * 0.618) + ((idx + 1) * 0.382) + ((state.stepCounter + 1) * 0.191) + phaseOffset));
    const unsignedR = clampRForFormula(
      formulaId,
      (prevMagnitude * 0.32) + (baseMagnitude * 0.20) + (driveMagnitude * 0.48) + phase + 0.03
    );
    const sign = structuralSignalSign(drive, baseSignedR, state.si_valores_previos[g][idx], prevSignedR);
    return sign * unsignedR;
  }

  function evaluateCandidateNode(g, idx, formulaId, drive, baseSignedR, phaseOffset = 0) {
    const signedR = buildCandidateSignedR(g, idx, formulaId, drive, baseSignedR, phaseOffset);
    const unsignedR = Math.abs(signedR);
    const value = state.sinOff
      ? signedR
      : evaluateFormulaById(formulaId, unsignedR) * structuralSignalSign(signedR, drive, baseSignedR);

    return {
      formulaId,
      signedR,
      unsignedR,
      value
    };
  }

  function isCollapsedCandidate(candidate, ctx) {
    if (!Number.isFinite(candidate.value) || !Number.isFinite(candidate.signedR)) return true;
    if (Math.abs(candidate.value) > STRUCTURAL_MAX_ABS_VALUE) return true;
    if (candidate.formulaId === 'tan' && candidate.unsignedR >= (STRUCTURAL_SAFE_TAN_MAX_R - 0.01)) return true;

    const significantDrive = Math.abs(ctx.drive) > STRUCTURAL_STALL_DRIVE || Math.abs(ctx.anchorSignal || 0) > STRUCTURAL_STALL_DRIVE;
    if (!significantDrive) return false;

    const deltaOwn = Math.abs(candidate.value - ctx.ownPrevValue);
    const deltaNode = Math.abs(candidate.value - ctx.prevNodeValue);
    return deltaOwn < STRUCTURAL_PROGRESS_EPS && deltaNode < STRUCTURAL_PROGRESS_EPS;
  }

  function candidateScore(candidate, ctx) {
    const targetSignal = Math.tanh(Number.isFinite(ctx.drive) ? ctx.drive : 0);
    const candidateSignal = Math.tanh(candidate.value);
    const closeness = 1 / (1 + Math.abs(candidateSignal - targetSignal));
    const advance = Math.abs(candidate.value - ctx.ownPrevValue) + (0.6 * Math.abs(candidate.value - ctx.prevNodeValue));
    const continuity = 1 / (1 + Math.abs(Math.abs(candidate.signedR) - Math.abs(ctx.baseSignedR || STRUCTURAL_BASE_R)));
    const anchorMatch = Math.abs(ctx.anchorSignal || 0) > 1e-9
      ? 1 / (1 + Math.abs(candidateSignal - Math.tanh(ctx.anchorSignal)))
      : 0.5;

    return (closeness * 1.1) + (advance * 0.35) + (continuity * 0.15) + (anchorMatch * 0.20);
  }

  function setResolvedNode(g, idx, candidate) {
    const G = state.groups[g];
    state.r_si[g][idx] = candidate.signedR;
    G[idx].formula_value = candidate.value;
    G[idx].total_value = candidate.value;
    G[idx].formula_id = candidate.formulaId;
    return { r: candidate.signedR, value: candidate.value, formulaId: candidate.formulaId };
  }

  function resolveDynamicNode(g, idx, drive, baseSignedR, context = {}) {
    const ctx = {
      drive: Number.isFinite(drive) ? drive : 0,
      ownPrevValue: Number.isFinite(state.si_valores_previos[g][idx]) ? state.si_valores_previos[g][idx] : 0,
      prevNodeValue: Number.isFinite(context.prevNodeValue) ? context.prevNodeValue : 0,
      anchorSignal: Number.isFinite(context.anchorSignal) ? context.anchorSignal : 0,
      baseSignedR: Number.isFinite(baseSignedR) ? baseSignedR : 0
    };

    const primaryFormulaId = formulaIdForNode(idx);
    const primaryCandidate = evaluateCandidateNode(
      g,
      idx,
      primaryFormulaId,
      ctx.drive + (ctx.anchorSignal * 0.22),
      ctx.baseSignedR,
      0
    );

    if (idx === IDX_S16 || !isCollapsedCandidate(primaryCandidate, ctx)) {
      return setResolvedNode(g, idx, primaryCandidate);
    }

    let bestCandidate = primaryCandidate;
    let bestScore = -Infinity;

    for (let i = 0; i < FALLBACK_FORMULA_IDS.length; i++) {
      const fallbackFormulaId = FALLBACK_FORMULA_IDS[i];
      if (fallbackFormulaId === primaryFormulaId) continue;

      const candidate = evaluateCandidateNode(
        g,
        idx,
        fallbackFormulaId,
        ctx.drive + (ctx.anchorSignal * 0.28),
        ctx.baseSignedR,
        (i + 1) * 0.17
      );

      if (isCollapsedCandidate(candidate, ctx)) continue;
      const score = candidateScore(candidate, ctx);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    return setResolvedNode(g, idx, bestCandidate);
  }

  function poleCouplingSignal(baseValue, maxValue, nucleusMemory = 0) {
    const bridge = 0.55 * (baseValue + maxValue);
    const product = baseValue * maxValue;
    const fusion = Math.abs(product) > 1e-12 ? Math.sign(product) * Math.sqrt(Math.abs(product)) : 0;
    return (bridge * 0.35) + (fusion * 0.65) + (nucleusMemory * 0.25);
  }

  function integrateForS16(g, directPoleValue, baseSignedR) {
    let weighted = 0;
    let weightSum = 0;
    for (let i = 0; i < IDX_S16; i++) {
      const weight = 1 + (i * 0.05);
      weighted += state.groups[g][i].total_value * weight;
      weightSum += weight;
    }
    const aggregated = weightSum > 0 ? (weighted / weightSum) : 0;
    const priorS16 = state.si_valores_previos[g][IDX_S16];
    return aggregated + (directPoleValue * 0.60) + (priorS16 * 0.30) + ((Number.isFinite(baseSignedR) ? baseSignedR : 0) * 0.20);
  }

  function resolvePolePair(g, baseSignedR, getTargetForIdx) {
    const prevS1 = state.si_valores_previos[g][IDX_S1];
    const prevS16 = state.si_valores_previos[g][IDX_S16];

    let s1 = resolveDynamicNode(
      g,
      IDX_S1,
      getTargetForIdx(IDX_S1) + (prevS16 * 0.55) + (prevS1 * 0.20),
      baseSignedR,
      { prevNodeValue: prevS1, anchorSignal: prevS16 }
    );

    let s16 = resolveDynamicNode(
      g,
      IDX_S16,
      getTargetForIdx(IDX_S16) + (s1.value * 0.65) + (prevS16 * 0.20),
      baseSignedR,
      { prevNodeValue: prevS16, anchorSignal: s1.value }
    );

    s1 = resolveDynamicNode(
      g,
      IDX_S1,
      getTargetForIdx(IDX_S1) + (s16.value * 0.45) + (prevS1 * 0.15),
      baseSignedR,
      { prevNodeValue: prevS1, anchorSignal: s16.value }
    );

    s16 = resolveDynamicNode(
      g,
      IDX_S16,
      getTargetForIdx(IDX_S16) + (s1.value * 0.55) + (prevS16 * 0.15),
      baseSignedR,
      { prevNodeValue: prevS16, anchorSignal: s1.value }
    );

    return { s1, s16 };
  }

  function applyLinearFlow(g, baseSignedR, getTargetForIdx) {
    state.r_usados[g] = baseSignedR;

    const prevS16 = state.si_valores_previos[g][IDX_S16];
    const s1 = resolveDynamicNode(
      g,
      IDX_S1,
      getTargetForIdx(IDX_S1) + (prevS16 * 0.50),
      baseSignedR,
      { prevNodeValue: state.si_valores_previos[g][IDX_S1], anchorSignal: prevS16 }
    );

    let carry = s1.value;
    for (let idx = 1; idx < IDX_S16; idx++) {
      let drive = getTargetForIdx(idx) + (carry * 0.42);
      if (idx === IDX_S9) {
        drive += poleCouplingSignal(s1.value, prevS16, state.si_valores_previos[g][IDX_S9]);
      }
      const node = resolveDynamicNode(g, idx, drive, baseSignedR, { prevNodeValue: carry, anchorSignal: s1.value });
      carry = node.value;
    }

    resolveDynamicNode(
      g,
      IDX_S16,
      integrateForS16(g, s1.value, baseSignedR),
      baseSignedR,
      { prevNodeValue: carry, anchorSignal: s1.value }
    );
  }

  function applyStructuralFlow(g, baseSignedR, getTargetForIdx) {
    state.r_usados[g] = baseSignedR;

    const { s1, s16 } = resolvePolePair(g, baseSignedR, getTargetForIdx);
    const emergentSeed = poleCouplingSignal(s1.value, s16.value, state.si_valores_previos[g][IDX_S9]);

    let lowerCarry = s1.value;
    for (const idx of FLOW_RETURN_LOWER) {
      const node = resolveDynamicNode(
        g,
        idx,
        getTargetForIdx(idx) + (lowerCarry * 0.58) + (emergentSeed * 0.12),
        baseSignedR,
        { prevNodeValue: lowerCarry, anchorSignal: emergentSeed }
      );
      lowerCarry = node.value;
    }

    let upperCarry = s16.value;
    for (const idx of FLOW_RETURN_UPPER) {
      const node = resolveDynamicNode(
        g,
        idx,
        getTargetForIdx(idx) + (upperCarry * 0.58) + (emergentSeed * 0.12),
        baseSignedR,
        { prevNodeValue: upperCarry, anchorSignal: emergentSeed }
      );
      upperCarry = node.value;
    }

    resolveDynamicNode(
      g,
      IDX_S9,
      getTargetForIdx(IDX_S9) + emergentSeed + (lowerCarry * 0.65) + (upperCarry * 0.65) + (state.si_valores_previos[g][IDX_S9] * 0.25),
      baseSignedR,
      {
        prevNodeValue: state.si_valores_previos[g][IDX_S9],
        anchorSignal: poleCouplingSignal(lowerCarry, upperCarry, emergentSeed)
      }
    );
  }

  function applyGroupFlow(g, baseSignedR, getTargetForIdx) {
    if (state.structuralFlow) applyStructuralFlow(g, baseSignedR, getTargetForIdx);
    else applyLinearFlow(g, baseSignedR, getTargetForIdx);
  }

  function syncPrevForGroup(g) {
    for (let s = 0; s < SI; s++) state.si_valores_previos[g][s] = state.groups[g][s].total_value;
  }

  function syncPrevForAllGroups() {
    for (let g = 0; g < GROUPS; g++) syncPrevForGroup(g);
  }

  function registerPattern(g) {
    const start = state.structuralFlow ? 'S9' : 'S1';
    const phase = state.structuralFlow ? t('flow.patternEntry') : 'Arranque';
    state.patrones_guardados.push(`${start},${phase},"",${state.groups[g].map(s => s.total_value).join(',')}`);
  }

  function finalizeGroupStep(g, savePattern = false) {
    syncPrevForGroup(g);
    if (savePattern) registerPattern(g);
    if (state.logR) logRLine(state.stepCounter + 1, g);
  }

  function finalizeMultiGroupStep() {
    syncPrevForAllGroups();
    state.r_iniciales_previos = state.r_iniciales.slice();
    if (state.logR) for (let g = 0; g < GROUPS; g++) logRLine(state.stepCounter + 1, g);
  }

  // ===== STEPS por nivel =====
  function stepNivel0() {
    const prev = state.si_valores_previos.map(row => row.slice());
    const g = 0;

    const inputSeed = state.r_iniciales[g] + (prev[g][IDX_S9] * 0.35) + (prev[g][IDX_S16] * 0.15);
    const baseSignedR = buildBaseSignedR(g, inputSeed, state.r_iniciales[g]);

    const getTargetForIdx = (idx) => {
      if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
      let suma_interna_prev = 0.0;
      for (let k = 0; k <= idx; k++) suma_interna_prev += prev[g][k];
      return baseSignedR + suma_interna_prev;
    };

    applyGroupFlow(g, baseSignedR, getTargetForIdx);
    syncPrevForGroup(g);
    state.r_iniciales_previos = state.r_iniciales.slice();
    if (state.logR) logRLine(state.stepCounter + 1, g);
  }

  function stepNivel1() {
    let suma_s16_anterior = 0.0;
    for (let g = 0; g < GROUPS; g++) suma_s16_anterior += state.groups[g][IDX_S16].total_value;

    let acumulado_random_actual = 0.0;
    for (let g = 0; g < GROUPS; g++) {
      const r_random_actual = state.r_iniciales[g];
      acumulado_random_actual += r_random_actual;

      const valor_entrada = suma_s16_anterior + acumulado_random_actual + state.r_iniciales_previos[g];
      const baseSignedR = buildBaseSignedR(g, valor_entrada, r_random_actual);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        return baseSignedR + (suma_s16_anterior * 0.15);
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
      finalizeGroupStep(g, true);
    }
    state.r_iniciales_previos = state.r_iniciales.slice();
  }

  function stepNivel2() {
    const suma_si_anterior = Array.from({length: SI}, () => 0.0);
    for (let s = 0; s < SI; s++) for (let g = 0; g < GROUPS; g++) suma_si_anterior[s] += state.groups[g][s].total_value;
    const suma_total = suma_si_anterior.reduce((p, c) => p + c, 0);

    let acumulado_random_actual = 0.0;
    for (let g = 0; g < GROUPS; g++) {
      const r_random_actual = state.r_iniciales[g];
      acumulado_random_actual += r_random_actual;

      const baseSignedR = buildBaseSignedR(g, acumulado_random_actual + state.r_iniciales_previos[g] + suma_total, r_random_actual);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        return baseSignedR + suma_total;
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
      finalizeGroupStep(g, true);
    }
    state.r_iniciales_previos = state.r_iniciales.slice();
  }

  function stepNivel3() {
    const suma_si_anterior = Array.from({length: SI}, () => 0.0);
    for (let s = 0; s < SI; s++) for (let g = 0; g < GROUPS; g++) suma_si_anterior[s] += state.groups[g][s].total_value;

    let acumulado_random_actual = 0.0;
    for (let g = 0; g < GROUPS; g++) {
      const r_random_actual = state.r_iniciales[g];
      acumulado_random_actual += r_random_actual;
      const baseSignedR = buildBaseSignedR(g, acumulado_random_actual + state.r_iniciales_previos[g], r_random_actual);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        let suma_total = 0.0;
        for (let k = 0; k <= idx; k++) suma_total += suma_si_anterior[k];
        return baseSignedR + suma_total;
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
      finalizeGroupStep(g, true);
    }
    state.r_iniciales_previos = state.r_iniciales.slice();
  }

  function stepNivel4() {
    state.vuelta_actual += 1;
    const suma_si_anterior = Array.from({length: SI}, () => 0.0);
    for (let s = 0; s < SI; s++) for (let g = 0; g < GROUPS; g++) suma_si_anterior[s] += state.groups[g][s].total_value;

    let acumulado_random_actual = 0.0;
    for (let g = 0; g < GROUPS; g++) {
      const r_random_actual = state.r_iniciales[g];
      acumulado_random_actual += r_random_actual;
      const baseSignedR = buildBaseSignedR(g, acumulado_random_actual + state.r_iniciales_previos[g], r_random_actual);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        let suma_total = 0.0;
        for (let k = 0; k <= idx; k++) suma_total += suma_si_anterior[k];
        if (state.vuelta_actual >= 3) suma_total += state.si_valores_previos[g][idx];
        return baseSignedR + suma_total;
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
      finalizeGroupStep(g, true);
    }
    state.r_iniciales_previos = state.r_iniciales.slice();
  }

  function stepNivel5() {
    const suma_si_anterior = Array.from({length: SI}, () => 0.0);
    for (let s = 0; s < SI; s++) for (let g = 0; g < GROUPS; g++) suma_si_anterior[s] += state.groups[g][s].total_value;

    let acumulado_random_actual = 0.0;
    for (let g = 0; g < GROUPS; g++) {
      const r_random_actual = state.r_iniciales[g];
      acumulado_random_actual += r_random_actual;
      const baseSignedR = buildBaseSignedR(g, acumulado_random_actual + state.r_iniciales_previos[g], r_random_actual);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        let suma_total = 0.0;
        for (let k = 0; k <= idx; k++) suma_total += suma_si_anterior[k];
        suma_total += state.si_valores_previos[g][idx];
        return baseSignedR + suma_total;
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
      finalizeGroupStep(g, true);
    }
    state.r_iniciales_previos = state.r_iniciales.slice();
  }

  function stepNivel6() {
    const prev = state.si_valores_previos.map(row => row.slice());
    for (let g = 0; g < GROUPS; g++) {
      const base = state.r_iniciales[g] + prev[g][IDX_S16] + state.r_iniciales_previos[g];
      const baseSignedR = buildBaseSignedR(g, base, state.r_iniciales[g]);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        let suma_interna = 0.0;
        for (let k = 0; k <= idx; k++) suma_interna += prev[g][k];
        return baseSignedR + suma_interna;
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
    }
    finalizeMultiGroupStep();
  }

  function stepNivel7() {
    const prev = state.si_valores_previos.map(row => row.slice());
    for (let g = 0; g < GROUPS; g++) {
      const left = (g - 1 + GROUPS) % GROUPS;
      const base = state.r_iniciales[g] + prev[left][IDX_S1] + state.r_iniciales_previos[g];
      const baseSignedR = buildBaseSignedR(g, base, state.r_iniciales[g]);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        return baseSignedR + prev[left][idx];
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
    }
    finalizeMultiGroupStep();
  }

  function stepNivel8() {
    const prev = state.si_valores_previos.map(row => row.slice());
    for (let g = 0; g < GROUPS; g++) {
      const base = state.r_iniciales[g] + prev[g][IDX_S16] + state.r_iniciales_previos[g];
      const baseSignedR = buildBaseSignedR(g, base, state.r_iniciales[g]);

      const getTargetForIdx = (idx) => {
        if (idx === IDX_S1 || idx === IDX_S16) return baseSignedR;
        const sym = 15 - idx;
        return baseSignedR + prev[g][idx] + prev[g][sym];
      };

      applyGroupFlow(g, baseSignedR, getTargetForIdx);
    }
    finalizeMultiGroupStep();
  }

  function runStepByLevel(level) {
    switch (level) {
      case '0': stepNivel0(); break;
      case '1': stepNivel1(); break;
      case '2': stepNivel2(); break;
      case '3': stepNivel3(); break;
      case '4': stepNivel4(); break;
      case '5': stepNivel5(); break;
      case 'M': runStepByLevel(state.manualRunLevel); break;
      case '6': stepNivel6(); break;
      case '7': stepNivel7(); break;
      case '8': stepNivel8(); break;
      default: stepNivel5();
    }
  }

  function simStep() {
    if (!state.reset_tiempo) return;
    switch (state.nivel) {
      case '0': runStepByLevel('0'); break;
      case '1': runStepByLevel('1'); break;
      case '2': runStepByLevel('2'); break;
      case '3': runStepByLevel('3'); break;
      case '4': runStepByLevel('4'); break;
      case '5': runStepByLevel('5'); break;
      case 'M': runStepByLevel(state.manualRunLevel); break;
      case '6': runStepByLevel('6'); break;
      case '7': runStepByLevel('7'); break;
      case '8': runStepByLevel('8'); break;
      default: runStepByLevel('5');
    }
    state.stepCounter++; state.frameTimer++;
    if (state.frameTimer >= 60) { state.secondCounter++; state.frameTimer = 0; }
    updateNumbersTable();
  }

  // ===== Ralentizador =====
  function computeRalentizadorMs() {
    if (!state.ralentizar_activo) { state.valor_ralentizador_ms = 0; return; }
    let suma_s16 = 0.0;
    for (let g = 0; g < GROUPS; g++) suma_s16 += state.groups[g][IDX_S16].total_value;
    const promedio = suma_s16 / GROUPS;
    state.valor_ralentizador_ms = clamp(180 + (Math.abs(Math.tanh(promedio)) * 900), 16, 2000);
  }

  // ===== Dibujo =====
  function drawGroupInCell(cx, cy, cellW, cellH, g) {
    const maxRad = Math.max(2, Math.min(cellW, cellH) * 0.42);
    for (let i = 0; i < SI; i++) {
      const s = state.groups[g][i];

      // qué magnitud usar para el tamaño
      let mag;
      if (state.drawUseFormula) {
        mag = Math.abs(s.formula_value);
        if (!Number.isFinite(mag)) mag = 0.2 + Math.abs(s.total_value);
      } else {
        mag = state.r_si[g][i];
        if (!Number.isFinite(mag)) mag = 0.2 + Math.abs(s.total_value);
        mag = Math.abs(mag);
      }

      const baseRadius = Math.max(1.5, Math.min(maxRad, mag * (i + 1) * 1.6));
      const deform = 1 + mag * 0.25;
      const rx = baseRadius * deform, ry = baseRadius;

      ctx.strokeStyle = hsl((i * 22 + g * 5) % 360, 100, 60, Math.max(0.12, 1 - i * 0.05));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAll(w, h) {
    const PADDING_X = 16;
    const TOP = 32;
    const BOTTOM = 28;
    const COLS = 4, ROWS = 4;

    const usableW = Math.max(80, w - PADDING_X * 2);
    const usableH = Math.max(80, h - TOP - BOTTOM);
    const colW = usableW / COLS;
    const rowH = usableH / ROWS;

    const gridW = COLS * colW, gridH = ROWS * rowH;
    const startX = (w - gridW) / 2 + colW / 2;
    const startY = h - BOTTOM - gridH + rowH / 2;

    for (let g = 0; g < GROUPS; g++) {
      const col = g % COLS, row = (g / COLS) | 0;
      const cx = startX + col * colW;
      const cy = startY + row * rowH;
      drawGroupInCell(cx, cy, colW, rowH, g);
    }
  }

  function updateSingleGroupData() {
    if (state.viewMode !== 'single') return;
    const g = state.selectedGroup;
    const title = t('viewer.singleTitle', { g: g + 1 });
    const showR = state.showR;

    const rows = [];
    for (let i = 0; i < SI; i++) {
      const val = state.groups[g][i].total_value;
      if (showR) {
        const r = state.r_si[g][i];
        rows.push(`<tr><td>S${i+1}</td><td>${fmt(val)}</td><td>${fmt(r)}</td></tr>`);
      } else {
        rows.push(`<tr><td>S${i+1}</td><td>${fmt(val)}</td></tr>`);
      }
    }

    $singleGroupData.innerHTML = `
      <h4>${title}</h4>
      <table>
        <thead>
          <tr>
            <th>${t('viewer.table.si')}</th>
            <th>${t('viewer.table.value')}</th>
            ${showR ? `<th>${t('viewer.table.r')}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    `;
  }

  function drawSingle(w, h, g) {
    const PADDING_X = 16;
    const TOP = 32;
    const BOTTOM = 28;

    const cellW = Math.max(100, w - PADDING_X * 2);
    const cellH = Math.max(100, h - TOP - BOTTOM);

    const cx = (w - cellW) / 2 + cellW / 2;
    const cy = h - BOTTOM - cellH / 2;

    drawGroupInCell(cx, cy, cellW, cellH, g);

    $singleGroupData.classList.remove('hidden');
    updateSingleGroupData();
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    if (state.viewMode === 'all') {
      $singleGroupData.classList.add('hidden');
      drawAll(w, h);
    } else {
      drawSingle(w, h, state.selectedGroup);
    }

    // HUD
    let promedio_s1 = 0, promedio_s16 = 0, resonancias = 0;
    for (let g = 0; g < GROUPS; g++) {
      const grupo = state.groups[g];
      promedio_s1 += grupo[0].total_value;
      promedio_s16 += grupo[15].total_value;
      if (grupo[15].total_value >= 0.1675 && grupo[15].total_value <= 0.2237 &&
          grupo[0].total_value >= 0.4850 && grupo[0].total_value <= 0.5412) {
        resonancias += 1;
      }
    }
    promedio_s1 /= GROUPS; promedio_s16 /= GROUPS;

    const slowState = state.ralentizar_activo ? (state.valor_ralentizador_ms + ' ms') : t('hud.off');
    const lastKey = state.lastKey || '-';

    $info.textContent = [
      t('hud.lines.step', { step: state.stepCounter }),
      t('hud.lines.seconds', { seconds: state.secondCounter }),
      t('hud.lines.avgS1', { value: fmt(promedio_s1) }),
      t('hud.lines.avgS16', { value: fmt(promedio_s16) }),
      t('hud.lines.resonancias', { count: resonancias }),
      t('hud.lines.flow', { mode: state.structuralFlow ? t('flow.modeStructural') : t('flow.modeLinear') }),
      t('hud.lines.lastKey', { key: lastKey }),
      t('hud.lines.slow', { state: slowState })
    ].join('\n');

    if ($whatSeeingDialog && $whatSeeingDialog.open) refreshWhatSeeingStatus();
  }

  // ===== export histórico =====
  function exportCSV() {
    const headerPrefix = [t('exports.patterns.label1'), t('exports.patterns.label2'), t('exports.patterns.label3')].join(',');
    const header = headerPrefix + ',' + Array.from({length: SI}, (_, i) => `S${i+1}`).join(',');
    const content = [header, ...state.patrones_guardados].join('\n');
    const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = t('exports.patterns.filename');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== Explicaciones por nivel =====
  function renderExplicacion() {
    $nivelName.textContent = (state.nivel === 'M')
      ? t('levels.nM')
      : (t('labels.level') + ' ' + state.nivel);

    const html = (state.nivel === 'M')
      ? t('explain.manualTitle', { lvl: state.manualRunLevel })
      : t(`explain.levels.${state.nivel}`);

    const flowNote = state.structuralFlow ? t('flow.noteStructural') : t('flow.noteLinear');
    $explain.innerHTML = (html || '') + (flowNote || '');

    if ($chkStructuralFlow) $chkStructuralFlow.checked = !!state.structuralFlow;

    if (state.nivel === 'M') $manualSeedsSection.classList.remove('hidden');
    else $manualSeedsSection.classList.add('hidden');

    refreshWhatSeeingStatus();
  }

  // ===== Notas =====
  const NOTES_KEY = 'cu-pwa-notes';
  function loadNotes() {
    try { $notesText.value = localStorage.getItem(NOTES_KEY) || ''; } catch {}
  }
  function saveNotes() {
    try {
      localStorage.setItem(NOTES_KEY, $notesText.value || '');
      $notesStatus.textContent = t('notes.saved');
      setTimeout(() => $notesStatus.textContent = '', 1200);
    } catch {
      $notesStatus.textContent = t('notes.saveError');
    }
  }
  function exportNotes() {
    const blob = new Blob([$notesText.value || ''], {type: 'text/plain;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = t('exports.notes.filename');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== eventos =====
  function togglePause() {
    state.paused = !state.paused;
    if ($btnStartPause) $btnStartPause.textContent = state.paused ? t('buttons.start') : t('buttons.pause');
    if ($btnPlay) $btnPlay.disabled = !state.paused;
    if ($btnPause) $btnPause.disabled = state.paused;
    updateNumbersTable();
    refreshWhatSeeingStatus();
  }

  document.addEventListener('keydown', (ev) => {
    const k = ev.key;
    state.lastKey = k;

    if (k === 'a' || k === 'A') seedOnA();
    else if (k === 'e' || k === 'E') exportCSV();
    else if (k === ' ') { ev.preventDefault(); togglePause(); }
    else if (k === 'r' || k === 'R') { state.ralentizar_activo = !state.ralentizar_activo; computeRalentizadorMs(); }
    else if ((k === 's' || k === 'S') && state.paused) { simStep(); computeRalentizadorMs(); }
  });

  if ($btnStartPause) $btnStartPause.addEventListener('click', togglePause);
  if ($btnPlay) $btnPlay.addEventListener('click', () => { if (state.paused) togglePause(); });
  if ($btnPause) $btnPause.addEventListener('click', () => { if (!state.paused) togglePause(); });
  $btnReset.addEventListener('click', () => { seedOnA(); refreshWhatSeeingStatus(); });
  $btnExport.addEventListener('click', exportCSV);
  $btnStep.addEventListener('click', () => {
    if (state.paused) {
      simStep();
      computeRalentizadorMs();
      refreshWhatSeeingStatus();
    }
  });
  $btnRalentizar.addEventListener('click', () => {
    state.ralentizar_activo = !state.ralentizar_activo;
    computeRalentizadorMs();
    refreshWhatSeeingStatus();
  });

  $stepFps.addEventListener('change', () => {
    const v = clamp(parseInt($stepFps.value, 10) || 10, 1, 60);
    state.stepIntervalMs = 1000 / v;
    $stepFps.value = v;
    refreshWhatSeeingStatus();
  });

  $drawMode.addEventListener('change', () => { state.drawMode = $drawMode.value; });

  $decimals.addEventListener('change', () => {
    const v = clamp(parseInt($decimals.value, 10) || 16, 0, 32);
    state.precision = v;
    $decimals.value = v;
    updateNumbersTable();
    updateSingleGroupData();
    refreshWhatSeeingStatus();
  });

  if ($chkStructuralFlow) {
    $chkStructuralFlow.checked = !!state.structuralFlow;
    $chkStructuralFlow.addEventListener('change', () => {
      state.structuralFlow = !!$chkStructuralFlow.checked;
      try { localStorage.setItem(FLOW_MODE_KEY, state.structuralFlow ? '1' : '0'); } catch {}
      restartCurrentRun();
      renderExplicacion();
      updateSingleGroupData();
      refreshWhatSeeingStatus();
      showToast(state.structuralFlow ? t('toasts.flowStructural') : t('toasts.flowLinear'), 'ok', 1400);
    });
  }

  $btnCopyNumbers.addEventListener('click', copyNumbersToClipboard);
  $btnDownloadNumbers.addEventListener('click', downloadNumbersCSV);

  // Re-seed automático al cambiar de nivel
  $nivel.addEventListener('change', () => {
    state.nivel = $nivel.value;
    renderExplicacion();
    seedOnA();
  });

  // Manual: cambio de nivel de ejecución
  $manualRunLevel.addEventListener('change', () => {
    state.manualRunLevel = $manualRunLevel.value || '5';
    renderExplicacion();
  });

  // Toggled de r y export
  $chkShowR.addEventListener('change', () => {
    state.showR = $chkShowR.checked;
    updateNumbersTable();
    updateSingleGroupData();
    refreshWhatSeeingStatus();
  });
  $chkLogR.addEventListener('change', () => {
    state.logR = $chkLogR.checked;
    state.r_log.length = 0;
    state.state_log.length = 0;
    refreshWhatSeeingStatus();
  });
  $chkSinOff.addEventListener('change', () => {
    state.sinOff = $chkSinOff.checked;
    updateNumbersTable();
    updateSingleGroupData();
    refreshWhatSeeingStatus();
  });

  $btnExportRSnapshot.addEventListener('click', downloadRSnapshot);
  $btnExportRLog.addEventListener('click', downloadRLog);
  $btnExportStateLog.addEventListener('click', downloadStateLog);

  const $chkDrawFormula = document.getElementById('chkDrawFormula');
  $chkDrawFormula.addEventListener('change', () => {
    state.drawUseFormula = $chkDrawFormula.checked;
    refreshWhatSeeingStatus();
  });

  // Semillas manuales
  $btnApplySeeds.addEventListener('click', () => { applySeedsFromUI(); });
  $btnDemoG1.addEventListener('click', () => {
    seedInputs.forEach((inp, i) => inp.value = i === 0 ? '0.000000000000010' : '0');
    applySeedsFromUI();
  });
  $btnClearSeeds.addEventListener('click', () => {
    seedInputs.forEach(inp => inp.value = '0');
    applySeedsFromUI();
  });

  $btnSaveNotes.addEventListener('click', saveNotes);
  $btnExportNotes.addEventListener('click', exportNotes);
  $notesText.addEventListener('blur', saveNotes);

  // Controles de vista/grupo
  function buildGroupSelector() {
    $groupSelect.innerHTML = '';
    for (let i = 0; i < GROUPS; i++) {
      const opt = document.createElement('option');
      opt.value = String(i + 1);
      opt.textContent = `G${i + 1}`;
      $groupSelect.appendChild(opt);
    }
    $groupSelect.value = String(state.selectedGroup + 1);
  }
  buildGroupSelector();

  $viewMode.addEventListener('change', () => {
    state.viewMode = $viewMode.value;
    const single = state.viewMode === 'single';
    $groupSelectWrap.classList.toggle('hidden', !single);
    if (!single) $singleGroupData.classList.add('hidden');
    refreshWhatSeeingStatus();
  });

  $groupSelect.addEventListener('change', () => {
    const v = clamp(parseInt($groupSelect.value, 10) || 1, 1, GROUPS);
    state.selectedGroup = v - 1;
    updateSingleGroupData();
    refreshWhatSeeingStatus();
  });

  // ===== init =====
  fitCanvas();
  buildNumbersTable();
  initGroups();
  buildSeedsUI();
  applySeedsFromUI();
  seedOnA();
  state.paused = true;
  computeRalentizadorMs();
  updateNumbersTable();
  renderExplicacion();
  loadNotes();
  syncThemeChips();

  // Ajuste UI inicial
  if ($groupSelectWrap) $groupSelectWrap.classList.add('hidden');

  // Título dinámico (por si el idioma cambia en el futuro)
  document.title = t('app.title');
  refreshWhatSeeingStatus();
  maybeShowMobileWarning();

  // ===== bucle =====
  let lastStepAt = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    const budget = state.stepIntervalMs + (state.ralentizar_activo ? state.valor_ralentizador_ms : 0);
    if (!state.paused && (ts - lastStepAt >= budget)) {
      simStep();
      computeRalentizadorMs();
      lastStepAt = ts;
    }
    draw();
  }
  requestAnimationFrame(loop);

  // Si cambia idioma: re-render de partes generadas por JS
  if (I18n && typeof I18n.onChange === 'function') {
    I18n.onChange(() => {
      syncLanguageButtons();
      document.title = t('app.title');
      buildNumbersTable();
      updateNumbersTable();
      renderExplicacion();
      updateSingleGroupData();
      refreshWhatSeeingStatus();
    });
  } else {
    window.addEventListener('i18n:change', () => {
      syncLanguageButtons();
      document.title = t('app.title');
      buildNumbersTable();
      updateNumbersTable();
      renderExplicacion();
      updateSingleGroupData();
      refreshWhatSeeingStatus();
    });
  }
})();