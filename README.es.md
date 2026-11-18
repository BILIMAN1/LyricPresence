# LyricPresence

[English](README.md) · **Español**

Muestra la **letra sincronizada en vivo** de lo que suena en Spotify en tu **perfil de Discord** (como actividad "Escuchando…"). App de escritorio para Windows hecha con Electron.

## Características

- Letra sincronizada línea por línea, en tiempo real
- Las letras vienen de [LRCLIB](https://lrclib.net) (gratis y sin cuenta)
- Carátula del álbum en tu actividad de Discord (opcional)
- Control de sincronía por si la letra sale antes o después
- Interfaz oscura, en español e inglés
- Login de Spotify con PKCE: solo necesitas un **Client ID**, nunca un secreto. Los tokens se guardan cifrados en tu equipo

## Instalación

Descarga el último `.exe` desde la página de [Releases](../../releases) y ábrelo.

> Debes tener **Discord de escritorio** abierto (la versión web no soporta Rich Presence) y
> activar **Ajustes → Privacidad de la actividad → Compartir tu actividad detectada**.

## Configuración inicial

1. Crea una app en el [panel de Spotify](https://developer.spotify.com/dashboard) y copia su **Client ID**.
2. En los ajustes de esa app agrega este Redirect URI y guarda: `http://127.0.0.1:8888/callback`
3. Abre LyricPresence → Ajustes, pega el Client ID, guarda y pulsa **Conectar Spotify**.
4. Pon una canción y pulsa **Iniciar**.

La propia app te muestra estos pasos la primera vez.

## Importante

- **Discord limita** las actualizaciones de actividad a unas 5 cada 20 segundos, así que la letra en tu perfil cambia como máximo cada ~4 segundos. La vista dentro de la app siempre va en tiempo real.
- **Spotify limita** las apps nuevas a 25 usuarios en modo desarrollo; por eso cada persona usa su propio Client ID.
- Solo se muestra letra si LRCLIB tiene una versión sincronizada de la canción.

## Desarrollo

```bash
npm install
npm start        # ejecuta la app
npm test         # pruebas del parser de letras
npm run dist     # genera el instalador y el .exe portable en /dist
```

### Antes de publicar (para quien mantiene el repo)

1. Crea una aplicación en el [Portal de desarrolladores de Discord](https://discord.com/developers/applications). Su **nombre** es lo que la gente ve como "Escuchando *nombre*".
2. Copia su Application ID (es público, no un secreto) en `DEFAULT_DISCORD_APP_ID` dentro de `src/lib/settings.js`, para que los usuarios no tengan que crear una.
3. Cambia `TU_NOMBRE` / `TU_USUARIO` en `package.json`, `LICENSE` y `src/lib/lyrics.js` por los tuyos.
4. Sube una etiqueta como `v1.0.0` y la GitHub Action genera el release automáticamente.

## Aviso

No está afiliado a Spotify ni a Discord. Usa Rich Presence de Discord y la API web de Spotify como están pensadas. **No** usa tu token de Discord ni cambia tu estado personalizado.

## Licencia

[MIT](LICENSE)
