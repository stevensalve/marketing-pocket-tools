'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

const ASOF = '2026-10-23';

test('rowsToEvents: flexible headers and problems', () => {
  const r = c.rowsToEvents([
    { 'User ID': 'a', 'Order Date': '15/09/2026', Joined: '01-08-2026' },
    { Customer: 'b', Date: '2026-10-01' },
    { Customer: '', Date: '2026-10-01' },
    { Customer: 'c', Date: 'soon' },
    { Customer: 'd', Date: '2026-10-02', 'Signup Date': 'x' },
    {},
  ]);
  assert.deepEqual(r.events, [
    { id: 'a', date: '2026-09-15', start: '2026-08-01' },
    { id: 'b', date: '2026-10-01', start: '' },
    { id: 'd', date: '2026-10-02', start: '' },
  ]);
  assert.deepEqual(r.problems, [
    'Row 4: no customer ID.',
    'Row 5: no readable activity date.',
    'Row 6: the start date could not be read; the first activity was used instead.',
  ]);
});

test('labelOf', () => {
  assert.equal(c.labelOf('month', 2026 * 12 + 9), 'Oct 2026');
  assert.equal(c.labelOf('week', 2926), c.labelOf('week', 2926));
});

test('report: monthly cohorts from first activity', () => {
  const ev = [
    { id: 'a', date: '2026-08-05', start: '' },
    { id: 'a', date: '2026-09-10', start: '' },
    { id: 'a', date: '2026-10-02', start: '' },
    { id: 'b', date: '2026-08-20', start: '' },
    { id: 'b', date: '2026-10-05', start: '' },
    { id: 'c', date: '2026-09-01', start: '' },
    { id: 'late', date: '2026-11-05', start: '' },
  ];
  const r = c.report(ev, { periods: 3, asOf: ASOF });
  assert.equal(r.customers, 3);
  assert.deepEqual(
    r.cohorts.map((x) => [x.label, x.size]),
    [
      ['Aug 2026', 2],
      ['Sep 2026', 1],
    ],
  );
  assert.deepEqual(r.cohorts[0].retained, [2, 1, 2, null]);
  assert.deepEqual(r.cohorts[0].rates, [1, 0.5, 1, null]);
  assert.deepEqual(r.cohorts[1].retained, [1, 0, null, null]);
  assert.deepEqual(r.average, [1, 1 / 3, 1, null]);
});

test('report: start dates define cohorts; activity before start is skipped', () => {
  const ev = [
    { id: 'a', date: '2026-09-10', start: '2026-08-01' },
    { id: 'a', date: '2026-07-10', start: '2026-08-01' },
    { id: 'z', date: '2026-10-10', start: '2026-10-01' },
  ];
  const r = c.report(ev, { periods: 2, asOf: ASOF });
  assert.deepEqual(
    r.cohorts.map((x) => x.label),
    ['Aug 2026', 'Oct 2026'],
  );
  assert.deepEqual(r.cohorts[0].retained, [0, 1, 0]);
  assert.equal(r.skipped, 1);
});

test('report: weekly cohorts', () => {
  const ev = [
    { id: 'a', date: '2026-10-05', start: '' },
    { id: 'a', date: '2026-10-13', start: '' },
    { id: 'b', date: '2026-10-11', start: '' },
  ];
  const r = c.report(ev, { unit: 'week', periods: 2, asOf: ASOF });
  assert.equal(r.cohorts.length, 1);
  assert.deepEqual(r.cohorts[0].retained, [2, 1, 0]);
  assert.equal(r.cohorts[0].label, '05/10/2026');
});

test('report: validation', () => {
  assert.throws(() => c.report([], { asOf: ASOF }), /no activity rows/);
  assert.throws(() => c.report([{ id: 'a', date: '2026-10-01', start: '' }], { asOf: 'x' }), /valid report date/);
  assert.throws(() => c.report([{ id: 'a', date: '2026-10-01', start: '' }], { asOf: ASOF, periods: 30 }), /between 1 and 24/);
});

test('sample: six cohorts, falling retention', () => {
  const ev = c.rowsToEvents(c.sampleRows(ASOF));
  assert.equal(ev.problems.length, 0);
  const r = c.report(ev.events, { periods: 5, asOf: ASOF });
  assert.equal(r.customers, 315);
  assert.deepEqual(
    r.cohorts.map((x) => x.label),
    ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'],
  );
  assert.equal(r.cohorts[0].retained[1], 18);
  assert.deepEqual(r.cohorts[5].retained, [65, null, null, null, null, null]);
  assert.equal(r.average[0], 1);
  assert.ok(r.average[1] > r.average[3] && r.average[3] > r.average[5]);
  assert.ok(r.bestCohort && r.weakestCohort);
});

test('toText and toCsv', () => {
  const r = c.report(c.rowsToEvents(c.sampleRows(ASOF)).events, { periods: 3, asOf: ASOF });
  const t = c.toText(r);
  assert.match(
    t,
    /^COHORT RETENTION \(315 customers, 6 monthly cohorts, as of 23\/10\/2026\)\nAverage retention: start 100\.0%, month 1 46\.\d%/,
  );
  const csv = c.toCsv(r);
  assert.ok(csv.startsWith('﻿Cohort,Customers,Start,Month 1,Month 2,Month 3\r\nMay 2026,40,100.0%,45.0%,35.0%,27.5%'));
  assert.match(csv, /\r\nOct 2026,65,100\.0%,,,\r\n/);
  assert.match(csv, /\r\nAverage,315,100\.0%,/);
});
