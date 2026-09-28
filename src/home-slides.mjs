import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const HOME_SLIDES_DIRECTORY = 'public/assets/home-slides';
const supported = /\.(jpe?g|png|webp|gif|avif)$/i;
const order = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });

/** The folder is the source of truth; captions are optional, never a photo list. */
export async function loadHomeSlides(root, labels = {}) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    throw new Error('content/home.json · heroLabels：应为按文件名填写的可选说明对象。');
  }
  const directory = path.join(root, HOME_SLIDES_DIRECTORY);
  if (!fs.existsSync(directory)) throw new Error(`请创建 ${HOME_SLIDES_DIRECTORY}/ 并放入至少一张轮播图片。`);
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.') && supported.test(entry.name) && !entry.isDirectory())
    .sort((a, b) => order.compare(a.name, b.name) || (a.name < b.name ? -1 : 1));
  if (!entries.length) throw new Error(`${HOME_SLIDES_DIRECTORY}/ 中没有图片；请至少保留一张 JPG、PNG、WebP、GIF 或 AVIF 图片。`);

  const slides = [];
  for (const entry of entries) {
    const filename = `${HOME_SLIDES_DIRECTORY}/${entry.name}`;
    if (!entry.isFile()) throw new Error(`${filename}：请使用普通图片文件，不要放入符号链接。`);
    let metadata;
    try {
      metadata = await sharp(path.join(directory, entry.name)).metadata();
    } catch {
      throw new Error(`${filename}：无法读取图片，请确认文件完整并重新导出。`);
    }
    // Browser EXIF orientation can swap the displayed width and height.
    const { width, height } = metadata.autoOrient;
    const label = labels[entry.name] ?? {};
    if (!label || typeof label !== 'object' || Array.isArray(label)) throw new Error(`content/home.json · heroLabels.${entry.name}：应为图片说明对象。`);
    const url = `/assets/home-slides/${encodeURIComponent(entry.name)}`;
    slides.push({
      original: url, display: url, width, height,
      altKey: label.altKey ?? 'teamPhotoAlt',
      captionKey: label.captionKey ?? 'heroLabCaption',
    });
  }
  return slides;
}
