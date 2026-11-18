(() => {
  const $ = (id) => document.getElementById(id);
  let T = window.I18N.es;
  let settings = null;
  let state = null;

  const pickLang = (s) => {
    const l = s.language === 'auto' ? (s.locale || 'es').slice(0, 2) : s.language;
    return l === 'en' ? 'en' : 'es';
  };

  function applyI18n() {
    document.documentElement.lang = T === window.I18N.en ? 'en' : 'es';
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = T[el.dataset.i18n]));
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      // Los textos vienen de i18n.js (no de usuarios): contenido estático y de confianza.
      el.innerHTML = T[el.dataset.i18nHtml];
    });
    render();
  }

  function render() {
    if (!state) return;
    $('pillSpotify').classList.toggle('on', state.loggedIn && (state.spotify || state.running));
    $('pillDiscord').classList.toggle('on', !!state.discord);

    const tr = state.track;
    const lyrics = $('lyrics');
    $('title').textContent = tr ? tr.title : state.running ? T.nothing : '—';
    $('artist').textContent = tr ? tr.artist : state.running ? T.nothingHint : '';
    const cover = $('cover');
    if (tr && tr.cover) {
      if (cover.src !== tr.cover) cover.src = tr.cover;
      $('bg').style.backgroundImage = `url("${tr.cover}")`;
      $('bg').style.opacity = 0.35;
    } else {
      cover.removeAttribute('src');
      $('bg').style.opacity = 0;
    }

    const ly = state.lyric;
    lyrics.classList.toggle('empty', !ly);
    $('approxTag').hidden = !(ly ? ly.approx : tr && tr.lyricsKind === 'approx');
    if (ly) {
      $('lPrev').textContent = ly.prev;
      $('lCur').textContent = ly.current;
      $('lNext').textContent = ly.next;
    } else {
      $('lPrev').textContent = '';
      $('lNext').textContent = '';
      $('lCur').textContent = !state.running
        ? ''
        : !tr
        ? '♪'
        : !tr.isPlaying
        ? T.paused
        : tr.loading
        ? T.searching
        : tr.hasLyrics
        ? '♪'
        : T.noLyrics;
    }

    // Canción sin letra: explicar qué se puede hacer
    const noLyrics = !!(state.running && tr && tr.isPlaying && !tr.loading && !tr.hasLyrics);
    $('noLyricsBox').hidden = !noLyrics;
    if (noLyrics) {
      $('noLyricsText').textContent = settings && settings.useApproxLyrics ? T.noLyricsTip : T.noLyricsTipApprox;
      $('noLyricsLink').textContent = T.contribute;
    }

    // Calibración rápida
    const off = typeof state.offsetMs === 'number' ? state.offsetMs : settings ? settings.offsetMs : 0;
    $('syncVal').textContent = (off > 0 ? '+' : '') + off;

    // Aviso de versión nueva
    const up = state.update;
    $('updateBar').hidden = !up;
    if (up) {
      $('updateText').textContent = T.updateAvail(up.version);
      $('btnUpdate').textContent = T.download;
    }

    const banner = $('banner');
    if (state.error) {
      const base = T.errors[state.error] || state.error;
      banner.textContent = state.detail && state.error !== 'DISCORD_UNAVAILABLE' ? `${base} (${state.detail})` : base;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }

    const toggle = $('btnToggle');
    toggle.textContent = state.running ? T.stop : T.start;
    toggle.classList.toggle('stop', state.running);
    toggle.hidden = !state.loggedIn;
    const login = $('btnLogin');
    login.textContent = T.connect;
    login.hidden = state.loggedIn;
  }

  function showSettings(show) {
    $('viewMain').hidden = show;
    $('viewSettings').hidden = !show;
    $('btnSettings').hidden = show;
  }

  function fillSettings() {
    $('fSpotifyId').value = settings.spotifyClientId;
    $('fDiscordId').value = settings.discordAppId;
    const off = state && typeof state.offsetMs === 'number' ? state.offsetMs : settings.offsetMs;
    $('fOffset').value = off;
    $('offsetVal').textContent = off;
    $('fMode').value = settings.discordMode || 'pair';
    $('fCover').checked = settings.useCover;
    $('fApprox').checked = !!settings.useApproxLyrics;
    $('fWinStart').checked = !!settings.startWithWindows && settings.canAutostart;
    $('fWinStart').disabled = !settings.canAutostart;
    $('fieldAutostart').classList.toggle('disabled', !settings.canAutostart);
    $('winStartHelp').textContent = settings.canAutostart ? T.startWithWindowsHelp : T.startWithWindowsOff;
    $('fTray').checked = !!settings.minimizeToTray;
    $('fUpdates').checked = settings.checkUpdates !== false;
    $('version').textContent = `${T.version} ${settings.appVersion || ''}`;
    $('fLang').value = settings.language;
    $('redirectUri').textContent = settings.redirectUri;
    $('help').open = !settings.spotifyClientId;
  }

  async function saveSettings(flash = true) {
    settings = await window.api.saveSettings({
      spotifyClientId: $('fSpotifyId').value,
      discordAppId: $('fDiscordId').value,
      offsetMs: Number($('fOffset').value),
      discordMode: $('fMode').value,
      useCover: $('fCover').checked,
      useApproxLyrics: $('fApprox').checked,
      startWithWindows: $('fWinStart').checked,
      minimizeToTray: $('fTray').checked,
      checkUpdates: $('fUpdates').checked,
      language: $('fLang').value,
    });
    T = window.I18N[pickLang(settings)];
    applyI18n();
    if (flash) {
      const b = $('btnSave');
      const old = b.textContent;
      b.textContent = T.saved;
      setTimeout(() => (b.textContent = old), 1200);
    }
  }

  async function init() {
    settings = await window.api.getSettings();
    state = await window.api.getState();
    T = window.I18N[pickLang(settings)];
    fillSettings();
    applyI18n();
    window.api.onState((s) => {
      state = s;
      render();
    });

    $('btnSettings').onclick = () => {
      fillSettings();
      showSettings(true);
    };
    $('btnBack').onclick = () => showSettings(false);
    $('btnSave').onclick = async () => {
      await saveSettings();
      // Si ya están los dos IDs, regresa sola a la pantalla principal
      if (settings.spotifyClientId && settings.discordAppId) {
        setTimeout(() => showSettings(false), 700);
      }
    };
    $('fOffset').oninput = (e) => ($('offsetVal').textContent = e.target.value);
    // Un solo listener para todos los enlaces (los textos se reescriben al cambiar de idioma)
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('[data-link]');
      if (!a) return;
      e.preventDefault();
      window.api.openExternal(a.dataset.link);
    });
    $('btnEarlier').onclick = () => window.api.nudgeOffset(-100);
    $('btnLater').onclick = () => window.api.nudgeOffset(100);
    $('btnUpdate').onclick = () => state.update && window.api.openExternal(state.update.url);
    $('btnCopy').onclick = async () => {
      await navigator.clipboard.writeText(settings.redirectUri);
      const b = $('btnCopy');
      b.textContent = T.copied;
      setTimeout(() => (b.textContent = T.copy), 1200);
    };
    $('btnLogout').onclick = async () => {
      await window.api.logout();
      showSettings(false);
    };
    $('btnLogin').onclick = async () => {
      if (!settings.spotifyClientId) return showSettings(true);
      $('btnLogin').disabled = true;
      const r = await window.api.login();
      $('btnLogin').disabled = false;
      if (!r.ok) {
        state = { ...state, error: r.error, detail: r.detail };
        render();
      }
    };
    $('btnToggle').onclick = async () => {
      if (state.running) return window.api.stop();
      const r = await window.api.start();
      if (!r.ok && (r.error === 'MISSING_SPOTIFY_ID' || r.error === 'MISSING_DISCORD_ID')) {
        fillSettings();
        showSettings(true);
      }
    };

    // Primera vez: manda directo a Ajustes
    if (!settings.spotifyClientId || !settings.discordAppId) showSettings(true);
    // Si el Discord App ID viene incluido por defecto, no hace falta mostrarlo
    if (settings.discordAppId && settings.discordAppId === settings.defaultDiscordAppId) {
      $('fieldDiscord').hidden = true;
    }
  }

  init();
})();
