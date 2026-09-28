/** A same-document hash is navigation; another language, query or site is not. */
export function samePageAnchor(href, current) {
  try {
    const base = new URL(current);
    const target = new URL(href, base);
    if (target.origin !== base.origin || target.pathname !== base.pathname || target.search !== base.search) return null;
    return target.hash ? decodeURIComponent(target.hash.slice(1)) : null;
  } catch {
    return null;
  }
}

/** Use section starts, not equal viewport divisions: a long news section may exceed a screen. */
export function activeChapter(starts, position, viewport, maximum) {
  if (!starts.length) return null;
  if (maximum > 0 && position >= maximum - 2) return starts.at(-1).id;
  const readingLine = position + viewport * 0.32;
  return starts.reduce((active, section) => section.top <= readingLine ? section.id : active, starts[0].id);
}

export function lowResourceDevice(cores, memory, saveData) {
  return Boolean(saveData || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4));
}
