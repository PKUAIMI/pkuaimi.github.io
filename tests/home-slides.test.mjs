import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { HOME_SLIDES_DIRECTORY, loadHomeSlides } from '../src/home-slides.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aimi-slides-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, HOME_SLIDES_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  return { root, directory };
}

test('dropping, renaming and deleting photos controls order without a content list', async t => {
  const { root, directory } = fixture(t);
  const photo = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#94070a' } }).png().toBuffer();
  for (const name of ['10-last.PNG', '2-合照 1.png', '.hidden.png']) fs.writeFileSync(path.join(directory, name), photo);
  fs.writeFileSync(path.join(directory, 'README.md'), 'Not a photo');
  fs.mkdirSync(path.join(directory, 'nested'));
  fs.writeFileSync(path.join(directory, 'nested/01-ignore.png'), photo);
  let slides = await loadHomeSlides(root);
  assert.equal(slides.length, 2);
  assert.equal(slides[0].width, 40);
  assert.equal(slides[0].height, 20);
  assert.equal(slides[0].original, '/assets/home-slides/2-%E5%90%88%E7%85%A7%201.png');
  assert.equal(slides[0].captionKey, 'heroLabCaption');
  fs.renameSync(path.join(directory, '10-last.PNG'), path.join(directory, '01-first.PNG'));
  slides = await loadHomeSlides(root, { '01-first.PNG': { captionKey: 'specialCaption' } });
  assert.equal(slides[0].captionKey, 'specialCaption');
  assert.equal(slides[0].altKey, 'teamPhotoAlt');
  fs.unlinkSync(path.join(directory, '2-合照 1.png'));
  assert.equal((await loadHomeSlides(root)).length, 1);
});

test('phone EXIF orientation is reflected in displayed dimensions', async t => {
  const { root, directory } = fixture(t);
  await sharp({ create: { width: 40, height: 20, channels: 3, background: 'white' } })
    .withMetadata({ orientation: 6 }).jpeg().toFile(path.join(directory, 'portrait.jpg'));
  const [slide] = await loadHomeSlides(root);
  assert.equal(slide.width, 20);
  assert.equal(slide.height, 40);
});

test('empty folders, damaged images and symlinks report actionable errors', async t => {
  const { root, directory } = fixture(t);
  await assert.rejects(loadHomeSlides(root), /至少保留一张/);
  fs.writeFileSync(path.join(directory, 'broken.jpg'), 'not a jpeg');
  await assert.rejects(loadHomeSlides(root), /broken.jpg.*无法读取/);
  fs.unlinkSync(path.join(directory, 'broken.jpg'));
  fs.symlinkSync(path.join(root, 'outside.jpg'), path.join(directory, 'linked.jpg'));
  await assert.rejects(loadHomeSlides(root), /符号链接/);
});
