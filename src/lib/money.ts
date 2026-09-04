/** Money is stored as INTEGER pesewas (1 GHS = 100 pesewas). Never use floats. */

export const toPesewas = (cedis: number): number => Math.round(cedis * 100);
export const toCedis = (pesewas: number): number => pesewas / 100;

export function formatMoney(pesewas: number, currency = "GHS"): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  const s = (abs / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currency} ${s}`;
}

/** basis points → multiplier fraction. 1000 bps = 0.10 */
export const bps = (basisPoints: number): number => basisPoints / 10_000;

/** Apply a bps rate to a pesewa amount, rounding to the nearest pesewa. */
export const applyBps = (pesewas: number, basisPoints: number): number => Math.round(pesewas * bps(basisPoints));
