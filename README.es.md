# LyricPresence

[English](README.md) · **Español**

Muestra la **letra sincronizada en vivo** de lo que suena en Spotify en tu **perfil de Discord** (como actividad "Escuchando…"). App de escritorio para Windows hecha con Electron.

## Características

- Letra sincronizada línea por línea, en tiempo real. La tarjeta de Discord muestra la línea **actual y la siguiente**, así casi no se saltan líneas
- Las letras vienen de [LRCLIB](https://lrclib.net) (gratis y sin cuenta)
- Carátula del álbum en tu actividad de Discord (opcional)
- Calibración rápida: botones **−100 / +100 ms** y atajos globales **Ctrl+Alt+← / →**
- Funciona en segundo plano: icono en la bandeja, **iniciar con Windows** (opcional) y aviso cuando hay versión nueva
- Canciones sin letra sincronizada: tu perfil muestra la canción y puedes activar la *letra aproximada*
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

- **Discord limita** las actualizaciones de actividad a unas 5 cada 20 segundos. Para aguantar el ritmo, la tarjeta muestra la línea actual más la siguiente y se refresca solo cuando la actual está por salir (cada ~4–5 s). La vista dentro de la app siempre va en tiempo real.
- Discord además tarda un instante en pintar cada cambio. Si aun así la letra sale tarde, pulsa **+100** (o **Ctrl+Alt+→**) hasta que coincida. El ajuste se guarda.
- Al cerrar la ventana, LyricPresence sigue en la bandeja (icono junto al reloj). Para salir del todo usa **Salir** en el menú de la bandeja.
- *Iniciar con Windows* es para el `.exe` instalado o portable. Con el portable, si lo mueves de carpeta, vuelve a guardar el ajuste para actualizar la ruta.
- El aviso de actualización solo abre la página del release en GitHub; no descarga ni instala nada solo.
- **Spotify limita** las apps nuevas a 25 usuarios en modo desarrollo; por eso cada persona usa su propio Client ID.
- Solo se muestra letra si LRCLIB tiene una versión sincronizada de la canción. Si no la tiene, puedes [añadirla allí](https://lrclib.net) para todos, o activar la *letra aproximada* en Ajustes (letra sin tiempos repartida de forma pareja; puede ir desfasada y se marca como aproximada).

## Desarrollo

```bash
npm install
npm start        # ejecuta la app
npm test         # pruebas del parser de letras, del planificador de Discord y del aviso de versión
npm run dist     # genera el instalador y el .exe portable en /dist
```

### Antes de publicar (para quien mantiene el repo)

1. Crea una aplicación en el [Portal de desarrolladores de Discord](https://discord.com/developers/applications). Su **nombre** es lo que la gente ve como "Escuchando *nombre*".
2. Copia su Application ID (es público, no un secreto) en `DEFAULT_DISCORD_APP_ID` dentro de `src/config.js`, para que los usuarios no tengan que crear una. `GITHUB_REPO`, en el mismo archivo, es lo que consulta el aviso de actualización.
3. Sube `version` en `package.json`, crea una etiqueta como `v1.1.0` y la GitHub Action genera el release automáticamente. El aviso compara esa etiqueta con la versión instalada.

## Aviso

No está afiliado a Spotify ni a Discord. Usa Rich Presence de Discord y la API web de Spotify como están pensadas. **No** usa tu token de Discord ni cambia tu estado personalizado.

## Licencia

[MIT](LICENSE)
