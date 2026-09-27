/** Small, dependency-free text helpers shared by templates and search. */
export function escapeHTML(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
}

export function decodeHTML(value) {
  return String(value)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => {
      const code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function plainText(source) {
  return decodeHTML(String(source).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function normalizedPath(value) {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}
