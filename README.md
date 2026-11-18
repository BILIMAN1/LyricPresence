# LyricPresence

**English** · [Español](README.es.md)

Shows the **live, synced lyrics** of whatever you are playing on Spotify on your **Discord profile** (as a "Listening to…" activity). Desktop app for Windows, built with Electron.

## Features

- Line-by-line synced lyrics, in real time. Your Discord card shows the **current and the next line**, so lines are almost never skipped
- Synced lyrics come from [LRCLIB](https://lrclib.net) (free, no account needed)
- Album cover on your Discord activity (optional)
- Quick sync calibration: **−100 / +100 ms** buttons and global shortcuts **Ctrl+Alt+← / →**
- Runs in the background: tray icon, optional **start with Windows**, and a notice when a new version is out
- Tracks without synced lyrics: your profile shows the song instead, and you can opt in to *approximate lyrics*
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

- **Discord limits** activity updates to about 5 every 20 seconds. To keep up, the card shows the current line plus the next one and refreshes only when the current line is about to leave it (about every 4–5 s). The in-app view is always real time.
- Discord also takes a moment to paint each update. If lyrics still feel late, press **+100** (or **Ctrl+Alt+→**) until they match. The offset is saved.
- Closing the window keeps LyricPresence in the tray (icon near the clock). Use **Quit** in the tray menu to exit completely.
- *Start with Windows* is for the installed/portable `.exe`. With the portable build, saving the setting again after moving the file updates the path.
- The update notice only opens the release page on GitHub; nothing is downloaded or installed automatically.
- **Spotify limits** new apps to 25 users in development mode, which is why everyone uses their own Client ID.
- Lyrics are only shown when LRCLIB has a synced version of the song. If it doesn't, you can [add it there](https://lrclib.net) for everyone, or enable *approximate lyrics* in Settings (untimed lyrics spread evenly across the song; they can drift and are labelled as approximate).

## Development

```bash
npm install
npm start        # run the app
npm test         # lyric parser, Discord planner and updater tests
npm run dist     # build the Windows installer + portable .exe into /dist
```

### Maintainer setup (before publishing)

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications). Its **name** is what people see as "Listening to *name*".
2. Copy its Application ID (public, not a secret) into `DEFAULT_DISCORD_APP_ID` in `src/config.js`, so users don't have to create one. `GITHUB_REPO` in the same file is what the update notice checks.
3. Bump `version` in `package.json`, push a tag like `v1.1.0` and the GitHub Action builds the release automatically. The update notice compares that tag with the installed version.

## Disclaimer

Not affiliated with Spotify or Discord. Uses Discord Rich Presence and the Spotify Web API as intended. It does **not** touch your Discord token or custom status.

## License

[MIT](LICENSE)
