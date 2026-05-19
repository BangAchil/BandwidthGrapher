export function calculateNiceCeiling(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;

  const exponent = Math.floor(Math.log10(value));
  const powerOf10 = Math.pow(10, exponent);
  const normalized = value / powerOf10;

  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 1.5) niceNormalized = 1.5;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 3) niceNormalized = 3;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  return niceNormalized * powerOf10;
}

export function calculateGridIntervalSeconds(totalDurationSeconds: number): number {
  if (totalDurationSeconds <= 90) return 15;
  if (totalDurationSeconds <= 300) return 30;
  if (totalDurationSeconds <= 900) return 60;
  return 120;
}
