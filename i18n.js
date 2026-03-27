(() => {
  'use strict';

  const LANG_KEY = 'cu-pwa-lang';
  const DEFAULT_LANG = 'es';
  const LANG_DIR = 'lang';
  const STORAGE_PREFIX = 'cu-pwa-i18n-cache:';
  const STORAGE_SCHEMA_VERSION = 1;

  const SUPPORTED_LANGS = Object.freeze([
    'es',
    'en',
    'de',
    'it',
    'ca',
    'pt-br',
    'ko',
    'ja',
    'zh',
    'fr',
    'ru',
    'hi'
  ]);

  const LANG_ALIASES = Object.freeze({
    'pt': 'pt-br',
    'pt_br': 'pt-br',
    'pt-pt': 'pt-br',
    'pt_pt': 'pt-br',
    'zh-cn': 'zh',
    'zh-hans': 'zh',
    'zh-hant': 'zh',
    'zh-tw': 'zh',
    'zh-hk': 'zh',
    'jp': 'ja'
  });

  let currentLang = DEFAULT_LANG;
  let baseDict = {};
  let langDict = {};
  let warmupStarted = false;

  const listeners = new Set();
  const dictStore = new Map();
  const pendingLoads = new Map();

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function deepGet(obj, path) {
    if (!obj) return undefined;
    const parts = String(path || '').split('.');
    let cursor = obj;

    for (const part of parts) {
      if (cursor == null || (!isPlainObject(cursor) && typeof cursor !== 'object')) return undefined;
      if (!hasOwn(cursor, part)) return undefined;
      cursor = cursor[part];
    }

    return cursor;
  }

  function interpolate(value, vars) {
    if (value == null) return value;
    let out = String(value);
    if (!vars || typeof vars !== 'object') return out;

    for (const [key, val] of Object.entries(vars)) {
      out = out.replaceAll(`{{${key}}}`, String(val));
    }

    return out;
  }

  function normalizeLang(input) {
    let lang = String(input || '').trim().toLowerCase();
    if (!lang) return DEFAULT_LANG;

    lang = lang.replace(/_/g, '-');
    if (SUPPORTED_LANGS.includes(lang)) return lang;
    if (LANG_ALIASES[lang]) return LANG_ALIASES[lang];

    const short = lang.split('-')[0];
    if (SUPPORTED_LANGS.includes(short)) return short;
    if (LANG_ALIASES[short]) return LANG_ALIASES[short];

    return DEFAULT_LANG;
  }

  function detectPreferredLanguage() {
    const saved = safeStorageGet(LANG_KEY);
    if (saved) return normalizeLang(saved);

    const navigatorCandidates = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language, navigator.userLanguage, navigator.browserLanguage].filter(Boolean);

    for (const candidate of navigatorCandidates) {
      const normalized = normalizeLang(candidate);
      if (SUPPORTED_LANGS.includes(normalized)) return normalized;
    }

    return DEFAULT_LANG;
  }

  function storageKeyForLang(lang) {
    return `${STORAGE_PREFIX}${normalizeLang(lang)}`;
  }

  function readStoredDict(lang) {
    const raw = safeStorageGet(storageKeyForLang(lang));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== STORAGE_SCHEMA_VERSION || !isPlainObject(parsed.dict)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeStoredDict(lang, dict, source) {
    if (!isPlainObject(dict)) return;
    const payload = {
      v: STORAGE_SCHEMA_VERSION,
      lang: normalizeLang(lang),
      source: source || null,
      ts: Date.now(),
      dict
    };
    safeStorageSet(storageKeyForLang(lang), JSON.stringify(payload));
  }

  function t(key, vars) {
    const fromLang = deepGet(langDict, key);
    const fromBase = deepGet(baseDict, key);
    const value = fromLang != null ? fromLang : (fromBase != null ? fromBase : key);
    return interpolate(value, vars);
  }

  function toUrl(path) {
    return new URL(path, document.baseURI).toString();
  }

  function candidateUrlsFor(lang) {
    const normalized = normalizeLang(lang);
    const candidates = [toUrl(`${LANG_DIR}/${normalized}.json`)];
    if (normalized === DEFAULT_LANG) {
      candidates.push(toUrl(`${DEFAULT_LANG}.json`));
    } else {
      candidates.push(toUrl(`${normalized}.json`));
    }
    return candidates;
  }

  async function fetchJSON(url) {
    const response = await fetch(url, {
      cache: 'default',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${url})`);
    }

    const json = await response.json();
    if (!isPlainObject(json)) {
      throw new Error(`JSON inválido o no compatible: ${url}`);
    }

    return json;
  }

  async function loadDict(lang) {
    const normalized = normalizeLang(lang);

    if (dictStore.has(normalized)) {
      return {
        lang: normalized,
        dict: dictStore.get(normalized),
        loaded: true,
        source: 'memory',
        fromStorage: false,
        stale: false,
        missing: false,
        usedFallback: false,
        url: null,
        error: null
      };
    }

    if (pendingLoads.has(normalized)) {
      return pendingLoads.get(normalized);
    }

    const task = (async () => {
      let lastError = null;
      const candidates = candidateUrlsFor(normalized);

      for (const url of candidates) {
        try {
          const dict = await fetchJSON(url);
          dictStore.set(normalized, dict);
          writeStoredDict(normalized, dict, url);
          return {
            lang: normalized,
            dict,
            loaded: true,
            source: url,
            fromStorage: false,
            stale: false,
            missing: false,
            usedFallback: false,
            url,
            error: null
          };
        } catch (error) {
          lastError = error;
        }
      }

      const stored = readStoredDict(normalized);
      if (stored && isPlainObject(stored.dict)) {
        dictStore.set(normalized, stored.dict);
        return {
          lang: normalized,
          dict: stored.dict,
          loaded: true,
          source: stored.source || 'storage',
          fromStorage: true,
          stale: true,
          missing: false,
          usedFallback: false,
          url: null,
          error: lastError
        };
      }

      return {
        lang: normalized,
        dict: {},
        loaded: false,
        source: null,
        fromStorage: false,
        stale: false,
        missing: true,
        usedFallback: normalized !== DEFAULT_LANG,
        url: null,
        error: lastError
      };
    })().finally(() => {
      pendingLoads.delete(normalized);
    });

    pendingLoads.set(normalized, task);
    return task;
  }

  async function loadBase() {
    const result = await loadDict(DEFAULT_LANG);
    baseDict = isPlainObject(result.dict) ? result.dict : {};
    return result;
  }

  async function loadLanguageFile(lang) {
    const normalized = normalizeLang(lang);

    if (normalized === DEFAULT_LANG) {
      langDict = {};
      return {
        lang: DEFAULT_LANG,
        dict: {},
        loaded: true,
        source: 'base',
        fromStorage: false,
        stale: false,
        missing: false,
        usedFallback: false,
        url: null,
        error: null
      };
    }

    const result = await loadDict(normalized);
    langDict = isPlainObject(result.dict) ? result.dict : {};
    return result;
  }

  function setElTextOrHTML(el, value) {
    const stringValue = String(value ?? '');
    if (/<[a-z][\s\S]*>/i.test(stringValue)) el.innerHTML = stringValue;
    else el.textContent = stringValue;
  }

  function applyTranslations(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;

    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      setElTextOrHTML(el, t(key));
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', t(key));
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      el.setAttribute('aria-label', t(key));
    });

    if (root === document) {
      const title = t('app.title');
      if (title && title !== 'app.title') {
        document.title = title;
      }

      const description = t('app.description');
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription && description && description !== 'app.description') {
        metaDescription.setAttribute('content', description);
      }
    }
  }

  function notifyLanguageChange(detail) {
    for (const fn of listeners) {
      try { fn(detail); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('i18n:change', { detail }));
  }

  function scheduleWarmup() {
    if (warmupStarted) return;
    warmupStarted = true;

    const run = () => {
      preloadAllLanguages().catch(() => {});
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1800 });
      return;
    }

    window.setTimeout(run, 1200);
  }

  async function preloadLanguage(lang) {
    await loadBase();
    const normalized = normalizeLang(lang);
    if (normalized === DEFAULT_LANG) return true;
    const result = await loadDict(normalized);
    return !!result.loaded;
  }

  async function preloadAllLanguages() {
    await loadBase();
    const jobs = SUPPORTED_LANGS
      .filter((lang) => lang !== DEFAULT_LANG)
      .map((lang) => preloadLanguage(lang));
    await Promise.allSettled(jobs);
    return true;
  }

  async function setLanguage(lang) {
    await loadBase();

    const requested = normalizeLang(lang || currentLang || detectPreferredLanguage());
    const result = requested === DEFAULT_LANG
      ? await loadLanguageFile(DEFAULT_LANG)
      : await loadLanguageFile(requested);

    currentLang = requested;
    safeStorageSet(LANG_KEY, requested);

    document.documentElement.setAttribute('lang', requested);
    document.documentElement.setAttribute('dir', 'ltr');

    applyTranslations();

    const detail = {
      requested,
      lang: requested,
      loaded: !!result.loaded,
      source: result.source || null,
      fromStorage: !!result.fromStorage,
      stale: !!result.stale,
      missing: !!result.missing,
      usedFallback: !!result.usedFallback,
      error: result.error || null
    };

    notifyLanguageChange(detail);
    scheduleWarmup();
    return detail;
  }

  function getLanguage() {
    return currentLang;
  }

  function getSupportedLanguages() {
    return [...SUPPORTED_LANGS];
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  currentLang = detectPreferredLanguage();

  const ready = (async () => {
    await setLanguage(currentLang);
  })();

  window.I18n = {
    t,
    setLanguage,
    getLanguage,
    getSupportedLanguages,
    applyTranslations,
    onChange,
    preloadLanguage,
    preloadAllLanguages,
    ready
  };
})();
