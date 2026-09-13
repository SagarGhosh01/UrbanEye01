/**
 * Universal Image Source Resolver
 * Safely handles Base64 strings from mobile APKs, Data URLs, HTTP/HTTPS URLs, and Blob URLs.
 */
export function resolveImageSrc(imageSnippet: string | null | undefined): string | null {
  if (!imageSnippet) return null;
  const str = String(imageSnippet).trim();
  if (!str) return null;

  if (
    str.startsWith('data:') ||
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('/') ||
    str.startsWith('blob:')
  ) {
    return str;
  }

  // If it's a raw base64 string sent by the mobile camera app
  return `data:image/jpeg;base64,${str}`;
}
