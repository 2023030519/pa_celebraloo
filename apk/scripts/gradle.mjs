// gradlew en Windows es un .bat (con ruta: cmd no siempre busca en la carpeta actual); en Linux, un script.
import { execFileSync } from "node:child_process";

const win = process.platform === "win32";
execFileSync(win ? ".\\gradlew.bat" : "./gradlew", ["assembleDebug"], { cwd: "android", stdio: "inherit", shell: win });
