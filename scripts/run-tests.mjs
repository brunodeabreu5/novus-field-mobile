import assert from "node:assert/strict";
import { isExpectedAuthError } from "../lib/auth-errors.ts";
import { deriveBackendWsUrl } from "../lib/config-utils.ts";
import {
  buildTrackPointsFromVendorPositions,
  sortVendorPositionsByRecordedAtDesc,
} from "../lib/manager-map-utils.ts";
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

runTest("isExpectedAuthError matches expected auth failures", () => {
  assert.equal(isExpectedAuthError(new Error("Unauthorized")), true);
  assert.equal(isExpectedAuthError(new Error("HTTP 401")), true);
  assert.equal(isExpectedAuthError(new Error("No active backend session")), true);
  assert.equal(isExpectedAuthError(new Error("HTTP 500")), false);
  assert.equal(isExpectedAuthError("Unauthorized"), false);
});

runTest("backend ws URL derivation strips /api suffix and respects override", () => {
  assert.equal(deriveBackendWsUrl("http://localhost:4000/api"), "http://localhost:4000");
  assert.equal(deriveBackendWsUrl("http://localhost:4000"), "http://localhost:4000");
  assert.equal(
    deriveBackendWsUrl("http://localhost:4000/api", "http://ws.example.com"),
    "http://ws.example.com"
  );
});

runTest("sortVendorPositionsByRecordedAtDesc returns newest rows first", () => {
  const rows = [
    {
      id: "1",
      vendor_id: "vendor-a",
      latitude: -25.3,
      longitude: -57.6,
      recorded_at: "2026-03-27T10:00:00.000Z",
      accuracy_meters: null,
      speed_kmh: null,
      heading: null,
      is_idle: null,
      idle_duration_seconds: null,
    },
    {
      id: "2",
      vendor_id: "vendor-a",
      latitude: -25.2,
      longitude: -57.5,
      recorded_at: "2026-03-27T12:00:00.000Z",
      accuracy_meters: null,
      speed_kmh: null,
      heading: null,
      is_idle: null,
      idle_duration_seconds: null,
    },
    {
      id: "3",
      vendor_id: "vendor-b",
      latitude: -25.1,
      longitude: -57.4,
      recorded_at: "2026-03-27T11:00:00.000Z",
      accuracy_meters: null,
      speed_kmh: null,
      heading: null,
      is_idle: null,
      idle_duration_seconds: null,
    },
  ];

  const sorted = sortVendorPositionsByRecordedAtDesc(rows);

  assert.deepEqual(sorted.map((row) => row.id), ["2", "3", "1"]);
});

runTest("buildTrackPointsFromVendorPositions sorts history ascending before mapping", () => {
  const rows = [
    {
      id: "late",
      vendor_id: "vendor-a",
      latitude: -25.4,
      longitude: -57.7,
      recorded_at: "2026-03-27T12:00:00.000Z",
      accuracy_meters: 8,
      speed_kmh: 30,
      heading: 90,
      is_idle: false,
      idle_duration_seconds: 0,
    },
    {
      id: "early",
      vendor_id: "vendor-a",
      latitude: -25.2,
      longitude: -57.5,
      recorded_at: "2026-03-27T09:00:00.000Z",
      accuracy_meters: 5,
      speed_kmh: 10,
      heading: 45,
      is_idle: true,
      idle_duration_seconds: 120,
    },
  ];

  const trail = buildTrackPointsFromVendorPositions(rows);

  assert.equal(trail.length, 2);
  assert.deepEqual(
    trail.map((point) => [point.lat, point.lng, point.timestamp.toISOString()]),
    [
      [-25.2, -57.5, "2026-03-27T09:00:00.000Z"],
      [-25.4, -57.7, "2026-03-27T12:00:00.000Z"],
    ]
  );
  assert.equal(trail[0]?.isIdle, true);
  assert.equal(trail[1]?.speedKmh, 30);
});

console.log("All tests passed");
