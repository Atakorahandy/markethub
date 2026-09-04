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
