/**
 * Universal Image Source Resolver
 * Safely handles Data URLs, Base64 strings, HTTP/HTTPS URLs, Blob URLs,
 * and relative server upload paths across production cross-domain deployments.
 */
export const DEFAULT_ROAD_DEFECT_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><path d="M 50 150 Q 200 80 350 150 Q 200 220 50 150 Z" fill="%230f172a" stroke="%23f97316" stroke-width="4"/><circle cx="200" cy="150" r="45" fill="%23020617"/><text x="200" y="240" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23f97316" text-anchor="middle">EDGE-AI ROAD DEFECT CAPTURE</text></svg>';

export function resolveImageSrc(imageSnippet: string | null | undefined): string {
  if (!imageSnippet) return DEFAULT_ROAD_DEFECT_SVG;
  let str = String(imageSnippet).trim();
  if (!str) return DEFAULT_ROAD_DEFECT_SVG;

  // Clean newlines, carriage returns, or quotes escaped in JSON transport
  str = str.replace(/[\r\n"']/g, '');

  if (str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }

  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }

  // Relative path resolution (e.g., /uploads/citizen-reports/...) for cross-origin production deploys
  if (str.startsWith('/')) {
    try {
      const envApi = (((import.meta as any).env?.VITE_API_URL) as string) || '';
      if (envApi) {
        const apiOrigin = envApi.replace(/\/api\/?$/, '');
        return `${apiOrigin}${str}`;
      }
    } catch {
      // fallback to relative path
    }
    return str;
  }

  // If it's a raw base64 string sent by mobile APK / camera feed
  return `data:image/jpeg;base64,${str}`;
}
