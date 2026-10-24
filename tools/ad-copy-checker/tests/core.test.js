'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../js/core.js');

test('length: code points, wide characters count double on request', () => {
  assert.equal(a.length('hello'), 5);
  assert.equal(a.length('नमस्ते'), 6);
  assert.equal(a.length('日本語', true), 6);
  assert.equal(a.length('日本語', false), 3);
  assert.equal(a.length('a😀'), 2);
});

test('cut respects limit and wide characters', () => {
  assert.equal(a.cut('abcdef', 4), 'abcd');
  assert.equal(a.cut('日本語', 5, true), '日本');
});

test('checkLine: status bands and flags', () => {
  assert.equal(a.checkLine('x'.repeat(30), 30).status, 'near');
  assert.equal(a.checkLine('x'.repeat(27), 30).status, 'near');
  assert.equal(a.checkLine('x'.repeat(20), 30).status, 'ok');
  const o = a.checkLine('x'.repeat(35), 30);
  assert.deepEqual([o.status, o.left, o.shown.length], ['over', -5, 30]);
  assert.equal(a.checkLine('BEST DEALS EVER!!', 90).flags.length, 3);
  assert.ok(a.checkLine('We guarantee results', 90).flags[0].includes('ad reviewers'));
  assert.equal(a.checkLine('Buy now at 20% off', 90).flags.length, 0);
  assert.ok(a.checkLine('Save  big', 90).flags.some((f) => /double spaces/.test(f)));
  assert.ok(a.checkLine('Sale 😀😀😀', 90).flags.some((f) => /3 emoji/.test(f)));
  assert.equal(a.checkLine('NASA launch', 90).flags.length, 0);
});

test('audit: google sample', () => {
  const s = a.sample();
  const r = a.audit(s.preset, s.values, s.limits);
  assert.equal(r.name, 'Google Search (responsive ad)');
  assert.deepEqual(
    r.fields.map((f) => f.results.length),
    [6, 2, 1, 1],
  );
  assert.equal(r.over, 3);
  assert.ok(r.problems.includes('Headlines: "Free Delivery Across India" is repeated; each must be different.'));
  assert.equal(r.fields[0].results[4].flags.length >= 2, true);
  assert.equal(r.fields[0].results[3].status, 'over');
  assert.equal(r.fields[3].results[0].status, 'over');
  assert.equal(r.fields[1].results[1].status, 'over');
});

test('audit: counts, overrides and errors', () => {
  const r = a.audit('google-rsa', { headline: 'One\nTwo', description: 'd' }, { headline: 2 });
  assert.ok(r.problems.includes('Headlines: add at least 3 (you have 2).'));
  assert.ok(r.problems.includes('Descriptions: add at least 2 (you have 1).'));
  assert.equal(r.fields[0].limit, 2);
  assert.equal(r.fields[0].results[0].status, 'over');
  const many = a.audit('google-rsa', { headline: Array.from({ length: 16 }, (_, i) => 'h' + i).join('\n') });
  assert.ok(many.problems.some((p) => /16 lines is more than the 15/.test(p)));
  assert.throws(() => a.audit('nope', {}), /Unknown ad type/);
  assert.equal(a.audit('x-post', { post: 'x'.repeat(281) }).over, 1);
  assert.equal(a.audit('meta-feed', { primary: 'Hello' }).problems.length, 0);
});

test('sms segments', () => {
  assert.deepEqual(a.sms(''), { encoding: 'GSM-7', units: 0, segments: 0, left: 160 });
  assert.deepEqual(a.sms('a'.repeat(160)), { encoding: 'GSM-7', units: 160, segments: 1, left: 0 });
  assert.deepEqual(a.sms('a'.repeat(161)), { encoding: 'GSM-7', units: 161, segments: 2, left: 145 });
  assert.equal(a.sms('[x]').units, 5);
  assert.deepEqual(a.sms('नमस्ते'), { encoding: 'Unicode', units: 6, segments: 1, left: 64 });
  assert.equal(a.sms('न'.repeat(71)).segments, 2);
});

test('toText and toCsv', () => {
  const s = a.sample();
  const r = a.audit(s.preset, s.values, s.limits);
  const t = a.toText(r);
  assert.match(t, /^AD COPY CHECK - Google Search \(responsive ad\)\n\nHeadlines \(limit 30\):\n- Diwali Sale: Up To 40% Off \[26\/30\]/);
  assert.match(t, /- Official Store With Easy 10 Day Returns \[39\/30, 9 too long\]/);
  assert.match(t, /To fix:\n- Headlines: "Free Delivery Across India" is repeated/);
  const csv = a.toCsv(r);
  assert.ok(csv.startsWith('﻿Ad type,Field,Text,Length,Limit,Status,Notes\r\n'));
  assert.equal(csv.split('\r\n').length, 1 + 10);
});

test('save and open', () => {
  const s = a.sample();
  assert.deepEqual(a.parse(a.serialize(s.preset, s.values, s.limits)), s);
  const bad = JSON.parse(a.serialize('x-post', { post: 5, other: 'y' }, { post: -3 }));
  const p = a.parse(JSON.stringify(bad));
  assert.deepEqual(p, { preset: 'x-post', values: { post: '' }, limits: {} });
  assert.throws(() => a.parse('x'), /not a saved ad/);
  assert.throws(() => a.parse('{"app":"ad-copy-checker","preset":"zzz"}'), /not a saved ad/);
});
