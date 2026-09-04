/** Safe helpers for the JSON-string columns (images, tags, specifications). */

export function parseStringArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function parseStringRecord(json: string): Record<string, string> {
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).filter(([, val]) => typeof val === "string")) as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}
