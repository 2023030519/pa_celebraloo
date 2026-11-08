// Prueba de parsePesosToCents. Corre con: node lib/format.check.mjs (Node 22.18+ ejecuta el .ts directo).
import assert from "node:assert/strict";
import { parsePesosToCents } from "./format.ts";

const cases = [
  ["1500", 150000],
  ["1500.5", 150050],
  ["1500.50", 150050],
  ["$ 1,500.00", 150000],
  ["1,500", 150000],
  ["12,345,678.9", 1234567890],
  ["0", 0],
  ["0.05", 5],
  ["999999999.99", 99999999999],
  // Coma decimal: ambigua, se rechaza (antes "1,50" se guardaba como $150.00).
  ["1,50", null],
  ["1,5", null],
  ["1500,00", null],
  // Grupos de miles mal formados.
  ["1,5000", null],
  ["15,00.00", null],
  [",500", null],
  ["1000000000", null],
  ["-5", null],
  ["1.234", null],
  ["abc", null],
  ["", null],
];

for (const [raw, expected] of cases) {
  assert.equal(parsePesosToCents(raw), expected, `parsePesosToCents(${JSON.stringify(raw)})`);
}
console.log(`format.check: ${cases.length} casos ok`);
