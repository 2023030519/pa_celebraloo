// La versión vive en package.json; la app la manda en el user agent para que el panel
// (Configuración › Versión) sepa si hay una APK más nueva en las releases.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const config = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
config.android = { ...config.android, appendUserAgent: `CelebralooAdminApp/${version}` };
writeFileSync("capacitor.config.json", JSON.stringify(config, null, 2) + "\n");
