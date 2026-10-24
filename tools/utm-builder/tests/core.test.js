'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/core.js');

test('clean applies naming rules', () => {
  assert.equal(u.clean('  Diwali Sale  2026 '), 'diwali-sale-2026');
  assert.equal(u.clean('Diwali_Sale', { separator: '_' }), 'diwali_sale');
  assert.equal(u.clean('Big Sale!!', { lowercase: false }), 'Big-Sale');
  assert.equal(u.clean('--a--b--'), 'a-b');
  assert.equal(u.clean('हिंदी Sale'), 'हिंदी-sale');
  assert.throws(() => u.clean('x', { separator: '.' }), /separator/);
});

test('build: tags a link and reports changes', () => {
  const r = u.build({ url: 'https://example.com/a?x=1#top', source: 'Google', medium: 'cpc', campaign: 'Diwali Sale', term: 'shoes' });
  assert.deepEqual(r.errors, []);
  assert.equal(r.url, 'https://example.com/a?x=1&utm_source=google&utm_medium=cpc&utm_campaign=diwali-sale&utm_term=shoes#top');
  assert.deepEqual(r.warnings, ['source "Google" was changed to "google".', 'campaign "Diwali Sale" was changed to "diwali-sale".']);
});

test('build: errors and warnings', () => {
  assert.deepEqual(u.build({}).errors, ['Add the page address.', 'Add the source.', 'Add the medium.', 'Add the campaign.']);
  assert.match(u.build({ url: 'ftp://x.com', source: 'a', medium: 'b', campaign: 'c' }).errors[0], /Only http and https/);
  assert.match(u.build({ url: 'http://', source: 'a', medium: 'b', campaign: 'c' }).errors[0], /not valid/);
  const w = u.build({ url: 'example.com', source: 'a', medium: 'banner', campaign: 'c' }).warnings;
  assert.ok(w.some((x) => /https:\/\/ was added/.test(x)) && w.some((x) => /not in your allowed list/.test(x)));
  assert.ok(u.build({ url: 'http://example.com', source: 'a', medium: 'cpc', campaign: 'c' }).warnings.some((x) => /uses http/.test(x)));
  const dup = u.build({ url: 'https://e.com/?utm_source=old&utm_id=7', source: 'new', medium: 'cpc', campaign: 'c' });
  assert.match(dup.url, /utm_source=new/);
  assert.doesNotMatch(dup.url, /old|utm_id/);
  assert.ok(dup.warnings.some((x) => /already had utm_source, utm_id/.test(x)));
  assert.ok(
    u
      .build({ url: 'https://e.com/' + 'a'.repeat(2100), source: 'a', medium: 'cpc', campaign: 'c' })
      .warnings.some((x) => /characters long/.test(x)),
  );
  assert.equal(u.build({ url: 'https://e.com', source: 'a', medium: 'x', campaign: 'c' }, { allowedMedium: [] }).warnings.length, 0);
});

test('parseBatch and buildBatch: duplicates flagged', () => {
  const rows = u.parseBatch('# c\nhttps://e.com | a | cpc | c1\n\nhttps://e.com | a | cpc | c1 | | ');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].line, 4);
  const res = u.buildBatch(rows);
  assert.ok(res[1].warnings.includes('Same link as line 2.'));
  assert.deepEqual(
    u.parseBatch(u.batchToText(rows)).map((r) => r.url),
    ['https://e.com', 'https://e.com'],
  );
});

test('audit finds inconsistent names', () => {
  const g = u.audit(u.sample());
  assert.deepEqual(
    g.map((x) => [x.field, x.names]),
    [['campaign', ['Diwali Sale 2026', 'diwali_sale_2026', 'diwali-sale-2026']]],
  );
  assert.deepEqual(u.audit([{ source: 'a', medium: 'b', campaign: 'c' }]), []);
});

test('toCsv: BOM, guard, quoting', () => {
  const res = u.buildBatch(u.parseBatch('https://e.com/?q=1,2 | =cmd | cpc | c'));
  const c = u.toCsv(res);
  assert.ok(c.startsWith('﻿Line,Link'));
  assert.match(
    c,
    /1,https:\/\/e\.com\/\?q=1%2C2&utm_source=cmd&utm_medium=cpc&utm_campaign=c,cmd,cpc,c,,,,"source ""=cmd"" was changed to ""cmd""\."/,
  );
});

test('save and open', () => {
  const rows = u.sample();
  const s = u.serialize(rows, { separator: '_' });
  const p = u.parse(s);
  assert.equal(p.rules.separator, '_');
  assert.deepEqual(
    p.rows.map((r) => r.source),
    rows.map((r) => r.source),
  );
  assert.throws(() => u.parse('x'), /not a saved link list/);
  assert.throws(() => u.parse('{"app":"y"}'), /not a saved link list/);
  const bad = JSON.parse(s);
  bad.rules.separator = '*';
  assert.equal(u.parse(JSON.stringify(bad)).rules.separator, '-');
});
