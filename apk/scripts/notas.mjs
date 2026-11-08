// Imprime la sección de CHANGELOG.md de la versión de package.json (las notas del release).
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const secciones = readFileSync("CHANGELOG.md", "utf8").split(/^## /m);
const mia = secciones.find((s) => s.startsWith(`${version}\n`) || s.startsWith(`${version}\r\n`));
if (!mia) {
  console.error(`CHANGELOG.md no tiene la sección "## ${version}".`);
  process.exit(1);
}
console.log(mia.slice(mia.indexOf("\n") + 1).trim());
