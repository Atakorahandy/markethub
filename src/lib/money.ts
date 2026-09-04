/** Money is stored as INTEGER pesewas (1 GHS = 100 pesewas). Never use floats. */

export const toPesewas = (cedis: number): number => Math.round(cedis * 100);
export const toCedis = (pesewas: number): number => pesewas / 100;

export function formatMoney(pesewas: number, currency = "GHS"): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  const s = (abs / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currency} ${s}`;
}
