import assert from "node:assert/strict";
import { buildVisitsByHourChart } from "../lib/dashboard.ts";
import { generateId } from "../lib/ids.ts";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("buildVisitsByHourChart returns 24 buckets", () => {
  const chart = buildVisitsByHourChart([]);

  assert.equal(chart.length, 24);
  assert.deepEqual(chart[0], { hour: "00:00", visitas: 0 });
  assert.deepEqual(chart[23], { hour: "23:00", visitas: 0 });
});

runTest("buildVisitsByHourChart groups visits by hour", () => {
  const chart = buildVisitsByHourChart([
    { check_in_at: "2026-03-12T08:10:00" },
    { check_in_at: "2026-03-12T08:40:00" },
    { check_in_at: "2026-03-12T15:05:00" },
  ]);

  assert.equal(chart[8]?.visitas, 2);
  assert.equal(chart[15]?.visitas, 1);
  assert.equal(chart[9]?.visitas, 0);
});

runTest("generateId returns uuid-like identifiers", () => {
  const id = generateId();

  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

runTest("generateId produces distinct values", () => {
  const values = new Set(Array.from({ length: 50 }, () => generateId()));

  assert.equal(values.size, 50);
});

console.log("All tests passed");
