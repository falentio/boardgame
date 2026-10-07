const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const formatRemaining = (ms: number): string => {
  if (ms <= 0) return "";
  if (ms < MINUTE_MS) return "<1m";
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  return hours > 0 ? `${String(hours)}h ${String(minutes)}m` : `${String(minutes)}m`;
};
