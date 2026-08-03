/** Display helpers. Pure, so they can be tested without rendering anything. */

/**
 * Initials for the avatar fallback, used whenever there is no Google picture
 * or it fails to load.
 *
 * "Adam Grenville"      -> "AG"
 * "adam.grenville@x.com" -> "AG"
 * "adam@x.com"           -> "A"
 */
export function initials(name, email) {
  const source = String(name || '').trim() || String(email || '').trim();
  if (!source) return '?';

  const local = source.includes('@') && !name ? source.split('@')[0] : source;
  const words = local.split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return '?';

  const first = words[0][0] || '';
  const second = words.length > 1 ? words[words.length - 1][0] || '' : '';
  return (first + second).toUpperCase();
}
