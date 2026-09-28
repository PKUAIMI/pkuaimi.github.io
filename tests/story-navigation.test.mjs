import assert from 'node:assert/strict';
import test from 'node:test';
import { activeChapter, samePageAnchor, lowResourceDevice } from '../src/browser/story-navigation.mjs';

test('chapter navigation preserves language, queries and external links', () => {
  const url = 'https://pkuaimi.github.io/zh/?preview=1#home';
  assert.equal(samePageAnchor('#research', url), 'research');
  assert.equal(samePageAnchor('#home-news-heading', url), 'home-news-heading');
  assert.equal(samePageAnchor('/#research', url), null);
  assert.equal(samePageAnchor('/zh/#research', url), null);
  assert.equal(samePageAnchor('https://other.example/zh/?preview=1#research', url), null);
  assert.equal(samePageAnchor('mailto:huangyx@pku.edu.cn', url), null);
  assert.equal(samePageAnchor('#%E0%A4%A', url), null);
  assert.equal(samePageAnchor('#', url), null);
});

test('long content and a short final section resolve to the chapter being read', () => {
  const starts = [{id:'home',top:150},{id:'updates',top:900},{id:'research',top:2700},{id:'contact',top:3600}];
  assert.equal(activeChapter(starts, 0, 700, 3700), 'home');
  assert.equal(activeChapter(starts, 1600, 700, 3700), 'updates');
  assert.equal(activeChapter(starts, 2600, 700, 3700), 'research');
  assert.equal(activeChapter(starts, 3700, 700, 3700), 'contact');
  assert.equal(activeChapter([], 0, 700, 0), null);
});

test('unknown hardware does not imply low resources, explicit constraints do', () => {
  assert.equal(lowResourceDevice(undefined, undefined, undefined), false);
  assert.equal(lowResourceDevice(12, 8, false), false);
  assert.equal(lowResourceDevice(4, 16, false), true);
  assert.equal(lowResourceDevice(12, 2, false), true);
  assert.equal(lowResourceDevice(12, 16, true), true);
});
