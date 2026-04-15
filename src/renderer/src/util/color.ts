/**
 * Genera un colore HSL deterministico da una stringa (feed slug).
 * Stesso input = stesso colore, tra sessioni e device.
 */
export function colorForFeed(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 62%)`
}
