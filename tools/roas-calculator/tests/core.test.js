'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

test('parseRows: numbers, blanks, rupee text and errors', () => {
  const r = c.parseRows(
    '# x\nBrand | Rs. 1,20,000 | 1000 | 100 | 10 | 5000\nNo data | 500\n | 1\nBad | abc\nNoSpend | \nTooMany | 100 | 10 | 20\nConv | 100 | 100 | 10 | 11',
  );
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { name: 'Brand', spend: 120000, impressions: 1000, clicks: 100, conversions: 10, revenue: 5000 });
  assert.deepEqual(r.rows[1], { name: 'No data', spend: 500, impressions: null, clicks: null, conversions: null, revenue: null });
  assert.deepEqual(r.errors, [
    'Line 4 has no name.',
    'Line 5 (Bad): spend is not a number.',
    'Line 6 (NoSpend): add the spend.',
    'Line 7 (TooMany): clicks are more than impressions.',
    'Line 8 (Conv): conversions are more than clicks.',
  ]);
  assert.deepEqual(c.parseRows(c.rowsToText(r.rows)).rows, r.rows);
});

test('metrics: all ratios', () => {
  const m = c.metrics({ spend: 1000, impressions: 50000, clicks: 500, conversions: 25, revenue: 5000 }, 0.4);
  assert.equal(m.ctr, 0.01);
  assert.equal(m.cpc, 2);
  assert.equal(m.cpm, 20);
  assert.equal(m.cvr, 0.05);
  assert.equal(m.cpa, 40);
  assert.equal(m.aov, 200);
  assert.equal(m.roas, 5);
  assert.equal(m.roi, 4);
  assert.equal(m.profit, 1000);
  assert.equal(m.profitRoi, 1);
  const blank = c.metrics({ spend: 100, impressions: null, clicks: null, conversions: null, revenue: null });
  assert.deepEqual([blank.ctr, blank.cpc, blank.cpm, blank.roas, blank.roi, blank.profit], [null, null, null, null, null, null]);
  assert.equal(c.metrics({ spend: 100, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }).cpa, null);
  assert.throws(() => c.metrics({ spend: 1 }, 1.5), /between 0% and 100%/);
});

test('breakEven', () => {
  assert.deepEqual(c.breakEven(0.4, 1500), { roas: 2.5, maxCpa: 600 });
  assert.deepEqual(c.breakEven(0.25), { roas: 4, maxCpa: null });
  assert.throws(() => c.breakEven(0), /between/);
});

test('report: totals, verdicts, best and worst', () => {
  const s = c.sample();
  const r = c.report(s.rows, s.margin);
  assert.equal(r.breakEvenRoas, 2.5);
  assert.equal(r.total.spend, 900000);
  assert.equal(r.total.revenue, 1872000);
  assert.equal(r.total.roas, 2.08);
  assert.equal(r.total.verdict, 'Losing money');
  assert.deepEqual(
    r.rows.map((x) => x.verdict),
    ['Profitable', 'Losing money', 'Losing money', 'Profitable', 'Losing money'],
  );
  assert.equal(r.best, 'Meta - retargeting');
  assert.equal(r.worst, 'YouTube');
  assert.equal(r.total.profit, -151200);
  assert.throws(() => c.report([], 0.4), /at least one/);
  const nom = c.report(s.rows, null);
  assert.equal(nom.rows[0].verdict, '');
  assert.equal(nom.breakEvenRoas, null);
});

test('report: totals are null when some rows lack a figure', () => {
  const r = c.report(c.parseRows('A | 100 | | | | 300\nB | 100 | | | | ').rows, null);
  assert.equal(r.total.revenue, null);
  assert.equal(r.total.spend, 200);
  assert.equal(r.worst, null);
});

test('toText and toCsv', () => {
  const s = c.sample();
  const r = c.report(s.rows, s.margin);
  const t = c.toText(r);
  assert.match(
    t,
    /^CAMPAIGN RETURN\nSpend Rs\. 9,00,000, revenue Rs\. 18,72,000, ROAS 2\.08x\nBreak-even ROAS 2\.50x: overall losing money\nProfit after ad spend -Rs\. 1,51,200\n/,
  );
  assert.match(t, /- YouTube: spend Rs\. 1,50,000, ROAS 0\.67x, CPA Rs\. 750 \(losing money\)/);
  assert.match(t, /Best ROAS: Meta - retargeting\. Weakest: YouTube\./);
  const csv = c.toCsv(r);
  assert.ok(csv.startsWith('﻿Campaign,Spend'));
  assert.equal(csv.split('\r\n').length, 7);
  assert.match(csv, /\r\nTotal,900000,/);
});

test('save and open', () => {
  const s = c.sample();
  const p = c.parse(c.serialize(s.rows, s.margin));
  assert.deepEqual(p, s);
  const bad = JSON.parse(c.serialize(s.rows, 9));
  bad.rows.push({ name: '', spend: 5 }, { name: 'ok', spend: -5 });
  const f = c.parse(JSON.stringify(bad));
  assert.equal(f.margin, null);
  assert.equal(f.rows.length, 5);
  assert.throws(() => c.parse('x'), /not a saved campaign list/);
  assert.throws(() => c.parse('{"app":"q"}'), /not a saved campaign list/);
});
