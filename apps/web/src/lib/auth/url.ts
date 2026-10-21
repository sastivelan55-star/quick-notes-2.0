/**
 * Safe Return URL Validation
 *
 * Prevents open redirect attacks by ensuring return destinations
 * are strictly relative paths within the application.
 */

export function getSafeReturnUrl(
  targetUrl: string | null | undefined,
  defaultUrl: string = '/app'
): string {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return defaultUrl;
  }

  const trimmed = targetUrl.trim();

  // Must not be empty
  if (!trimmed) {
    return defaultUrl;
  }

  // Must start with a single forward slash
  if (!trimmed.startsWith('/')) {
    return defaultUrl;
  }

  // Reject protocol-relative URLs (e.g. //attacker.com)
  if (trimmed.startsWith('//')) {
    return defaultUrl;
  }

  // Reject Windows path separators or slash-backslash evasion (e.g. /\attacker.com or \app)
  if (trimmed.includes('\\')) {
    return defaultUrl;
  }

  // Reject dangerous schemes or control characters
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return defaultUrl;
  }

  // Reject any embedded protocol pattern (e.g. /http:// or /javascript:)
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return defaultUrl;
  }

  return trimmed;
}
