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
    document.querySelectorAll('[data-link]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.api.openExternal(a.dataset.link);
      })
    );
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
        : tr.hasLyrics
        ? '♪'
        : T.noLyrics;
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
    $('fOffset').value = settings.offsetMs;
    $('offsetVal').textContent = settings.offsetMs;
    $('fCover').checked = settings.useCover;
    $('fLang').value = settings.language;
    $('redirectUri').textContent = settings.redirectUri;
    $('help').open = !settings.spotifyClientId;
  }

  async function saveSettings(flash = true) {
    settings = await window.api.saveSettings({
      spotifyClientId: $('fSpotifyId').value,
      discordAppId: $('fDiscordId').value,
      offsetMs: Number($('fOffset').value),
      useCover: $('fCover').checked,
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
