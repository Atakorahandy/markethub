import { customAlphabet } from "nanoid";

const orderCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const paymentSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);
const numericCode = customAlphabet("0123456789", 4);

/** Public order number, e.g. MH-7K2M9Q */
export const orderNumber = (): string => `MH-${orderCode()}`;

/** Payment reference passed to the gateway. Embeds the order number
 *  (dash-joined) so the mock pay page can recover it: reference.split("-")
 *  .slice(0, 2).join("-") === the order's orderNumber. */
export const paymentReference = (order: string): string => `${order}-${paymentSuffix()}`;

/** 4-digit proof-of-delivery confirmation code (spec §35). */
export const deliveryOtp = (): string => numericCode();

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Appends -2, -3, ... until `exists` reports no collision. */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "item";
  let slug = root;
  for (let i = 2; await exists(slug); i++) slug = `${root}-${i}`;
  return slug;
}
