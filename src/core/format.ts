export function formatBps(valueBps: number | null | undefined): string {
  if (valueBps === null || valueBps === undefined || Number.isNaN(valueBps)) return "N/A";
  if (valueBps < 1_000) return `${valueBps.toFixed(0)} bps`;
  if (valueBps < 1_000_000) return `${(valueBps / 1_000).toFixed(1)} K`;
  if (valueBps < 1_000_000_000) return `${(valueBps / 1_000_000).toFixed(1)} M`;
  return `${(valueBps / 1_000_000_000).toFixed(1)} G`;
}

export function formatClock(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
