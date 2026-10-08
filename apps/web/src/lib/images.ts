/*
 * Image URL rules shared by the storefront's server-side mappers (storefront-catalog design D7).
 */

/**
 * Whether `next/image` may load `url`: a root-relative path (the storefront's own files), or an
 * https URL on one of the allowed hosts. Anything else shows the placeholder instead.
 */
export function isAllowedImage(url: string, allowedHosts: readonly string[]): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  return (
    parsed.protocol === 'https:' &&
    parsed.port === '' &&
    allowedHosts.includes(parsed.hostname.toLowerCase())
  );
}
