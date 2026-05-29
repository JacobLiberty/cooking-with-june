export type CookProgress = {
  current: number;
  total: number;
  completed: number;
  isLast: boolean;
};

export function cookProgress(index: number, total: number): CookProgress {
  if (total <= 0) return { current: 0, total: 0, completed: 0, isLast: true };
  const current = Math.min(Math.max(index, 0), total - 1);
  return {
    current,
    total,
    completed: current,
    isLast: current >= total - 1,
  };
}
