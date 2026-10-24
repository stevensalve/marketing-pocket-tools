'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

const TODAY = '2026-10-23';
const P = { start: '2026-10-01', end: '2026-10-30' };

test('parseRows: defaults, per-channel dates, errors', () => {
  const r = c.parseRows(
    '# c\nGoogle | Rs. 3,00,000 | 1,50,000\nMeta | 100000\nFlight | 5000 | 0 | 2026-10-10 | 2026-10-20\n | 5\nBad | abc\nNoSpend | 100 | zzz\nDates | 100 | 0 | nope\nBackwards | 100 | 0 | 2026-10-20 | 2026-10-10',
    P,
  );
  assert.deepEqual(r.rows, [
    { name: 'Google', budget: 300000, spent: 150000, start: P.start, end: P.end },
    { name: 'Meta', budget: 100000, spent: 0, start: P.start, end: P.end },
    { name: 'Flight', budget: 5000, spent: 0, start: '2026-10-10', end: '2026-10-20' },
  ]);
  assert.deepEqual(r.errors, [
    'Line 5 has no channel name.',
    'Line 6 (Bad): the budget must be a number above zero.',
    'Line 7 (NoSpend): the spend so far is not a number.',
    'Line 8 (Dates): the start or end date is not a real date.',
    'Line 9 (Backwards): the end date is before the start date.',
  ]);
  assert.deepEqual(c.parseRows(c.rowsToText(r.rows), P).rows, r.rows);
});

test('pace: on pace, ahead, behind, overspent', () => {
  const row = (spent) => ({ name: 'X', budget: 300000, spent: spent, start: P.start, end: P.end });
  const a = c.pace(row(230000), TODAY);
  assert.deepEqual([a.totalDays, a.elapsed, a.left, a.expected], [30, 23, 7, 230000]);
  assert.equal(a.status, 'On pace');
  assert.equal(a.projected, 300000);
  assert.equal(a.projectedGap, 0);
  assert.equal(a.currentDaily, 10000);
  assert.equal(a.allowedDaily, 10000);
  assert.equal(c.pace(row(280000), TODAY).status, 'Ahead');
  assert.equal(c.pace(row(150000), TODAY).status, 'Behind');
  const o = c.pace(row(310000), TODAY);
  assert.equal(o.status, 'Overspent');
  assert.equal(o.allowedDaily, 0);
  assert.equal(o.remaining, -10000);
});

test('pace: before start, after end', () => {
  const r = { name: 'F', budget: 1000, spent: 0, start: '2026-11-01', end: '2026-11-10' };
  const n = c.pace(r, TODAY);
  assert.deepEqual([n.status, n.elapsed, n.pacing, n.projected, n.currentDaily], ['Not started', 0, null, null, null]);
  assert.equal(n.allowedDaily, 100);
  const done = c.pace({ name: 'D', budget: 1000, spent: 950, start: '2026-10-01', end: '2026-10-10' }, TODAY);
  assert.deepEqual([done.status, done.left, done.elapsed, done.allowedDaily], ['Finished', 0, 10, null]);
  assert.equal(c.pace({ name: 'D', budget: 1000, spent: 500, start: '2026-10-01', end: '2026-10-10' }, TODAY).status, 'Underspent');
  const last = c.pace({ name: 'L', budget: 1000, spent: 500, start: '2026-10-14', end: '2026-10-23' }, TODAY);
  assert.deepEqual([last.left, last.status], [0, 'Underspent']);
});

test('report on sample', () => {
  const s = c.sample(TODAY);
  assert.equal(s.period.start, '2026-10-12');
  assert.equal(s.period.end, '2026-11-10');
  const r = c.report(s.rows, s.period, TODAY);
  assert.deepEqual(
    r.channels.map((x) => x.status),
    ['Ahead', 'Behind', 'On pace', 'Overspent', 'On pace'],
  );
  assert.equal(r.total.budget, 840000);
  assert.equal(r.total.spent, 443000);
  assert.equal(r.total.expected, 336000);
  assert.ok(Math.abs(r.total.pacing - 443000 / 336000) < 1e-9);
  assert.equal(r.total.remaining, 397000);
  assert.ok(r.flags.some((f) => /Influencers has spent more than its budget \(Rs\. 10,000 over\)/.test(f)));
  assert.ok(r.flags.includes('Meta Ads is 20% behind plan: Rs. 20,000 of expected spend has not happened.'));
  assert.ok(r.flags.includes('Google Search is spending 25% faster than plan: at this rate it will run out about 6 days early.'));
  assert.throws(() => c.report([], s.period, TODAY), /at least one channel/);
  assert.throws(() => c.report(s.rows, { start: 'x', end: s.period.end }, TODAY), /valid start and end/);
  assert.throws(() => c.report(s.rows, { start: '2026-11-01', end: '2026-10-01' }, TODAY), /ends before it starts/);
});

test('toText and toCsv', () => {
  const s = c.sample(TODAY);
  const r = c.report(s.rows, s.period, TODAY);
  const t = c.toText(r);
  assert.match(t, /^BUDGET PACING\nBudget Rs\. 8,40,000, spent Rs\. 4,43,000 \(53%\), pacing 132% of plan\n/);
  assert.match(t, /- Google Search: Rs\. 1,50,000 of Rs\. 3,00,000, ahead \(125% of plan\)/);
  assert.match(t, /Watch:\n- /);
  const csv = c.toCsv(r);
  assert.ok(csv.startsWith('﻿Channel,Budget,Spent'));
  assert.equal(csv.split('\r\n').length, 7);
  assert.match(csv, /\r\nTotal,840000,443000,397000,336000,132%/);
});

test('save and open', () => {
  const s = c.sample(TODAY);
  assert.deepEqual(c.parse(c.serialize(s.rows, s.period)), s);
  assert.throws(() => c.parse('x'), /not a saved pacing plan/);
  assert.throws(() => c.parse('{"app":"budget-pacing","rows":[],"period":{"start":"x","end":"y"}}'), /not a saved pacing plan/);
  const bad = JSON.parse(c.serialize(s.rows, s.period));
  bad.rows.push({ name: '', budget: 5 }, { name: 'neg', budget: -4 });
  assert.equal(c.parse(JSON.stringify(bad)).rows.length, 5);
});
