import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareImageLinks } from '../src/image-preview.mjs';

test('photo links keep the original resource and gain a safe new-tab fallback', () => {
  const markup = `<figure><a class="photo" href='/assets/original.JPG?size=full&amp;v=2' aria-label="Lab photo"><img src="/assets/thumbnail.jpg" alt="Our lab"></a></figure>`;
  const output = prepareImageLinks(markup);
  assert.match(output, /href='\/assets\/original\.JPG\?size=full&amp;v=2'/);
  assert.match(output, /data-image-preview aria-haspopup="dialog" target="_blank" rel="noopener"/);
  assert.match(output, /<img src="\/assets\/thumbnail.jpg" alt="Our lab">/);
  assert.match(output, /aria-label="Lab photo"/);
  assert.equal(prepareImageLinks(output), output, 'running enhancement again must not duplicate attributes');
});

test('member cards, research cards, ordinary links and downloads keep their behavior', () => {
  for (const markup of [
    '<a href="/people/member/"><img src="/assets/portrait.jpg"><h3>Member</h3></a>',
    '<a href="/research/#project"><img src="/assets/diagram.png">Research</a>',
    '<a href="/assets/photo.jpg">Download photo</a>',
    '<a href="/assets/photo.jpg" download><img src="/assets/photo.jpg"></a>',
    '<a href="javascript:void(0)"><img src="/assets/photo.jpg"></a>',
    '<a href="/article/?thumbnail=photo.jpg"><img src="/assets/photo.jpg"></a>',
  ]) assert.equal(prepareImageLinks(markup), markup);
});

test('existing target and rel attributes are normalized without losing unrelated metadata', () => {
  const output = prepareImageLinks('<a href="https://example.org/photo.webp" target="_self" rel="opener nofollow" data-credit="Photo author"><img src="/assets/photo.jpg"></a>');
  assert.match(output, /target="_blank"/);
  assert.match(output, /rel="nofollow noopener"/);
  assert.match(output, /data-credit="Photo author"/);
  assert.equal((output.match(/target=/g) || []).length, 1);
});

test('multiple photo links are enhanced independently without swallowing a page link', () => {
  const output = prepareImageLinks('<a href="/assets/a.png"><img src="/assets/a.png"></a><a href="/news/"><img src="/assets/b.jpg"></a><a href="/assets/c.svg#figure"><img src="/assets/c.svg"></a>');
  assert.equal((output.match(/data-image-preview/g) || []).length, 2);
  assert.match(output, /<a href="\/news\/">/);
});
