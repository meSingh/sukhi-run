/**
 * Every picture, loaded once before the first run. They are small WebP files
 * that Vite fingerprints, so the offline worker keeps them after one visit.
 */
const SPRITE_URLS = import.meta.glob('./assets/sprites/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SCENE_URLS = import.meta.glob('./assets/scenes/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const name = (path: string): string => path.split('/').pop()!.replace(/\.webp$/, '');

export const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries({ ...SPRITE_URLS, ...SCENE_URLS })) URLS[name(path)] = url;

const images = new Map<string, HTMLImageElement>();

export function img (key: string): HTMLImageElement {
  const found = images.get(key);
  if (!found) throw new Error(`No picture called ${key}`);
  return found;
}

/** Loads them all. A picture that fails is left out rather than stopping the game. */
export async function load (): Promise<void> {
  await Promise.all(Object.entries(URLS).map(async ([key, url]) => {
    const im = new Image();
    im.src = url;
    try {
      await im.decode();
      images.set(key, im);
    } catch { /* drawn as nothing */ }
  }));
}

export const has = (key: string): boolean => images.has(key);
