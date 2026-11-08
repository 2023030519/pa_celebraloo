// Prueba de reportRange y metricsPeriod. Corre con: node lib/reports.check.mjs (Node 22.18+ ejecuta el .ts directo).
import assert from "node:assert/strict";
import { metricsPeriod, reportRange } from "./reports.ts";

const month = "2026-11";
const pick = ({ preset, from, to, months, notice }) => ({ preset, from, to, months, notice: notice !== null });

// Reportes
assert.deepEqual(pick(reportRange({ rango: "personalizado", desde: "2026-08", hasta: "2026-10" }, month)), {
  preset: "personalizado", from: "2026-08", to: "2026-10", months: 3, notice: false,
});
// Al revés: se invierte y avisa (antes caía en 12 meses sin decir nada).
assert.deepEqual(pick(reportRange({ rango: "personalizado", desde: "2026-11", hasta: "2026-08" }, month)), {
  preset: "personalizado", from: "2026-08", to: "2026-11", months: 4, notice: true,
});
// Futuro: termina en el mes actual.
assert.deepEqual(pick(reportRange({ rango: "personalizado", desde: "2027-01", hasta: "2027-05" }, month)), {
  preset: "personalizado", from: "2026-11", to: "2026-11", months: 1, notice: true,
});
// Más de 36 meses: los últimos 36.
assert.deepEqual(pick(reportRange({ rango: "personalizado", desde: "2020-01", hasta: "2026-11" }, month)), {
  preset: "personalizado", from: "2023-12", to: "2026-11", months: 36, notice: true,
});
// Sin desde válido: 12 meses con aviso; presets sin aviso.
assert.deepEqual(pick(reportRange({ rango: "personalizado", desde: "basura" }, month)), {
  preset: "12m", from: "2025-12", to: "2026-11", months: 12, notice: true,
});
assert.deepEqual(pick(reportRange({ rango: "anio" }, month)), { preset: "anio", from: "2026-01", to: "2026-11", months: 11, notice: false });
assert.deepEqual(pick(reportRange({}, month)), { preset: "12m", from: "2025-12", to: "2026-11", months: 12, notice: false });

// Métricas (to es exclusivo)
const today = "2026-11-07";
const m = (params) => pick({ months: undefined, ...metricsPeriod(params, today) });
assert.deepEqual(m({ periodo: "personalizado", desde: "2026-11-01", hasta: "2026-11-05" }), {
  preset: "personalizado", from: "2026-11-01", to: "2026-11-06", months: undefined, notice: false,
});
assert.deepEqual(m({ periodo: "personalizado", desde: "2026-11-05", hasta: "2026-11-01" }), {
  preset: "personalizado", from: "2026-11-01", to: "2026-11-06", months: undefined, notice: true,
});
assert.deepEqual(m({ periodo: "personalizado", desde: "2026-11-01", hasta: "2026-12-31" }), {
  preset: "personalizado", from: "2026-11-01", to: "2026-11-08", months: undefined, notice: true,
});
// Más de 1100 días: 3 años exactos (antes "admin_metrics: invalid period").
const long = metricsPeriod({ periodo: "personalizado", desde: "2020-01-01" }, today);
assert.equal(long.to, "2026-11-08");
assert.equal((Date.parse(long.to) - Date.parse(long.from)) / 86_400_000, 1095);
assert.ok(long.notice);
assert.deepEqual(m({ periodo: "personalizado", desde: "2026-02-30" }), {
  preset: "30d", from: "2026-10-09", to: "2026-11-08", months: undefined, notice: true,
});
assert.deepEqual(m({}), { preset: "30d", from: "2026-10-09", to: "2026-11-08", months: undefined, notice: false });

console.log("reports.check: ok");
