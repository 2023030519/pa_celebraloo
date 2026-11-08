# App Android de Celebraloo Admin

Cascarón de Capacitor 6 que abre el panel en línea (`server.url` en `capacitor.config.json`). Los cambios del panel llegan solos con cada deploy; la APK solo se vuelve a publicar cuando cambia el cascarón (dirección, ícono, nombre).

- `npm install` · `npm run apk` (APK en `android/app/build/outputs/apk/debug/app-debug.apk`) · `npm run release` (publica desde la PC).
- Dirección del panel: `server.url` en `capacitor.config.json`. Hoy es la laptop (`http://192.168.1.8:3011`, solo en la misma WiFi); cuando haya URL de producción, cámbiala ahí y quita `cleartext`.

## Publicar una versión
1. Sube `"version"` en `package.json` (0.2.0 → 0.2.1).
2. Agrega `## <versión>` con sus cambios en `CHANGELOG.md`, en palabras para el usuario.
3. Sube a `main` de 2023030519/pa_celebraloo. GitHub Actions compila y publica el release; en el cel: Configuración › Versión › Actualizar.

La APK se firma con la llave de depuración de la PC del autor (secreto `DEBUG_KEYSTORE` en Actions, `base64` de `~/.android/debug.keystore`). Si cambia, Android no deja actualizar sin desinstalar.
