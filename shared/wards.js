// SustainIQ Bengaluru | Author: Vanshika Sharma
import { METRICS } from "./constants.js";

// Fictional teaching values retained from the original project. Ward IDs and zones
// are demonstration labels, not a current official administrative boundary dataset.
const wardProfiles = [
  ["ward-150", "Bellandur", "Mahadevapura", 48, 38, 42, 44],
  ["ward-85", "Koramangala", "South", 62, 54, 66, 68],
  ["ward-174", "HSR Layout", "Bommanahalli", 68, 64, 72, 76],
  ["ward-84", "Indiranagar", "East", 64, 60, 68, 64],
  ["ward-112", "Domlur", "East", 58, 56, 61, 59],
];

export function calculateIndex(scores) {
  const values = METRICS.map(({ key }) => scores[key]);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sigma = Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  );
  const weighted = METRICS.reduce(
    (sum, { key, weight }) => sum + scores[key] * weight,
    0,
  );
  return (
    Math.round(Math.max(0, Math.min(100, weighted - 0.2 * sigma)) * 10) / 10
  );
}

export const wards = wardProfiles.map(([id, name, zone, aq, wq, te, wm]) => {
  const scores = { aq, wq, te, wm };
  return { id, name, zone, scores, index: calculateIndex(scores) };
});
