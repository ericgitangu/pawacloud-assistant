// SPDX-License-Identifier: MIT

const safeVibrate = (pattern: number | number[]): void => {
  if (typeof navigator === "undefined") return;
  // vibrate is not in all TypeScript lib typings — cast to avoid compile error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (typeof nav.vibrate === "function") {
    nav.vibrate(pattern);
  }
};

export const haptics = {
  tap: () => safeVibrate(8),
  success: () => safeVibrate([12, 40, 18]),
  warn: () => safeVibrate([20, 60, 20, 60]),
  error: () => safeVibrate([40, 80, 40]),
};
