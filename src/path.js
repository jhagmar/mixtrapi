/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isPath(value) {
  if (typeof value !== 'string' || value.length < 1) {
    return false;
  }
  if (value.startsWith('/')) {
    return false;
  }
  const nfc = value.normalize('NFC');
  if (nfc !== value) {
    return false;
  }
  const segments = value.split('/');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      return false;
    }
  }
  return true;
}
