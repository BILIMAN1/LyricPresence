# LyricPresence

**English** · [Español](README.es.md)

Shows the **live, synced lyrics** of whatever you are playing on Spotify on your **Discord profile** (as a "Listening to…" activity). Desktop app for Windows, built with Electron.

## Features

- Line-by-line synced lyrics, in real time
- Synced lyrics come from [LRCLIB](https://lrclib.net) (free, no account needed)
- Album cover on your Discord activity (optional)
- Sync offset slider if lyrics feel early or late
- Dark UI, English / Spanish
- Spotify login with PKCE: you only need a **Client ID**, never a secret. Tokens are stored encrypted on your machine

## Install

Download the latest `.exe` from the [Releases](../../releases) page and run it.

> Discord **desktop** must be open (the web version does not support Rich Presence), and
> **Settings → Activity Privacy → Share your detected activity** must be on.

## First-time setup

1. Create an app in the [Spotify dashboard](https://developer.spotify.com/dashboard) and copy its **Client ID**.
2. In that app's settings add this Redirect URI and save: `http://127.0.0.1:8888/callback`
3. Open LyricPresence → Settings, paste the Client ID, save, then click **Connect Spotify**.
4. Play a song and press **Start**.

The app shows these steps itself on first launch.

## Good to know

- **Discord limits** activity updates to about 5 every 20 seconds, so the lyric on your profile changes at most every ~4 seconds. The in-app view is always real time.
- **Spotify limits** new apps to 25 users in development mode, which is why everyone uses their own Client ID.
- Lyrics are only shown when LRCLIB has a synced version of the song.

## Development

```bash
npm install
npm start        # run the app
npm test         # run the lyric parser tests
npm run dist     # build the Windows installer + portable .exe into /dist
```

### Maintainer setup (before publishing)

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications). Its **name** is what people see as "Listening to *name*".
2. Copy its Application ID (public, not a secret) into `DEFAULT_DISCORD_APP_ID` in `src/lib/settings.js`, so users don't have to create one.
3. Replace `TU_NOMBRE` / `TU_USUARIO` in `package.json`, `LICENSE` and `src/lib/lyrics.js` with your own.
4. Push a tag like `v1.0.0` and the GitHub Action builds the release automatically.

## Disclaimer

Not affiliated with Spotify or Discord. Uses Discord Rich Presence and the Spotify Web API as intended. It does **not** touch your Discord token or custom status.

## License

[MIT](LICENSE)
