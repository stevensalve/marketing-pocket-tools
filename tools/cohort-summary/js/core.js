/**
 * Cohort Retention Summary - core logic (pure; SheetJS only reads the file in app.js).
 *
 * Event: { id, date ('YYYY-MM-DD'), start ('YYYY-MM-DD' | '') }   one row per order or activity
 * A customer's cohort is the month (or week) of their start date, or of their first activity when no start date is given.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.CohortCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const key = (s) =>
    norm(s)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const MAX = 200000;
  const DAY = 86400000;
  const ALIASES = {
    id: ['customerid', 'customer', 'userid', 'user', 'id', 'accountid', 'memberid', 'clientid'],
    date: [
      'date',
      'orderdate',
      'activitydate',
      'activity',
      'purchasedate',
      'transactiondate',
      'eventdate',
      'createdat',
      'timestamp',
      'lastactive',
    ],
    start: [
      'signup',
      'signupdate',
      'joined',
      'joineddate',
      'registered',
      'registrationdate',
      'firstorder',
      'firstorderdate',
      'startdate',
      'cohort',
    ],
  };

  function pick(row, names) {
    const map = {};
    Object.keys(row).forEach((k) => (map[key(k)] = row[k]));
    for (let i = 0; i < names.length; i++) if (map[names[i]] !== undefined && norm(map[names[i]]) !== '') return map[names[i]];
    return '';
  }

  /** rows -> { events, problems }. */
  function rowsToEvents(rows) {
    const events = [];
    const problems = [];
    (rows || []).slice(0, MAX).forEach((row, i) => {
      if (Object.keys(row).every((k) => norm(row[k]) === '')) return;
      const at = 'Row ' + (i + 2) + ': ';
      const id = norm(pick(row, ALIASES.id));
      if (!id) return problems.push(at + 'no customer ID.');
      const date = OT.toIsoDate(pick(row, ALIASES.date));
      if (!date) return problems.push(at + 'no readable activity date.');
      const rawStart = pick(row, ALIASES.start);
      const start = OT.toIsoDate(rawStart);
      if (rawStart !== '' && !start) problems.push(at + 'the start date could not be read; the first activity was used instead.');
      events.push({ id: id, date: date, start: start || '' });
    });
    return { events: events, problems: problems };
  }

  // ----- period maths ("month" = calendar month, "week" = Monday-based week)
  const monthIndex = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const weekIndex = (iso) => Math.floor((OT.parseIsoDate(iso) - Date.UTC(1970, 0, 5)) / (7 * DAY)); // 1970-01-05 was a Monday
  const indexOf = (unit, iso) => (unit === 'week' ? weekIndex(iso) : monthIndex(iso));

  function labelOf(unit, idx) {
    if (unit === 'week') return OT.formatDate(new Date(Date.UTC(1970, 0, 5) + idx * 7 * DAY).toISOString().slice(0, 10), 'dmy');
    const y = Math.floor(idx / 12);
    const m = idx % 12;
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] + ' ' + y;
  }

  /**
   * Cohort table. opts: { unit: 'month' | 'week', periods: 1-24 (default 6), asOf: 'YYYY-MM-DD' }
   * Periods after the as-of date are null (not yet observed).
   */
  function report(events, opts) {
    const o = opts || {};
    const unit = o.unit === 'week' ? 'week' : 'month';
    const periods = o.periods === undefined ? 6 : o.periods;
    if (!Number.isInteger(periods) || periods < 1 || periods > 24) throw new Error('Show between 1 and 24 periods.');
    if (!events.length) throw new Error('There are no activity rows to analyse.');
    let asOf;
    try {
      OT.parseIsoDate(o.asOf);
      asOf = o.asOf;
    } catch (e) {
      throw new Error('Choose a valid report date.');
    }
    const asOfIdx = indexOf(unit, asOf);
    // customer -> { cohort, active: Set(period index) }
    const cust = {};
    const firstSeen = {};
    events.forEach((e) => {
      if (e.date > asOf) return;
      if (!firstSeen[e.id] || e.date < firstSeen[e.id]) firstSeen[e.id] = e.date;
    });
    const starts = {};
    events.forEach((e) => {
      if (e.start && (!starts[e.id] || e.start < starts[e.id])) starts[e.id] = e.start;
    });
    Object.keys(firstSeen).forEach(
      (id) => (cust[id] = { cohort: indexOf(unit, starts[id] && starts[id] <= asOf ? starts[id] : firstSeen[id]), active: {} }),
    );
    Object.keys(starts).forEach((id) => {
      if (!cust[id] && starts[id] <= asOf) cust[id] = { cohort: indexOf(unit, starts[id]), active: {} };
    });
    let skipped = 0;
    events.forEach((e) => {
      const c = cust[e.id];
      if (!c || e.date > asOf) return;
      const p = indexOf(unit, e.date) - c.cohort;
      if (p < 0) return skipped++;
      c.active[p] = true;
    });
    const byCohort = {};
    Object.keys(cust).forEach((id) => {
      const c = cust[id];
      const g = (byCohort[c.cohort] = byCohort[c.cohort] || { index: c.cohort, size: 0, counts: new Array(periods + 1).fill(0) });
      g.size++;
      for (let p = 0; p <= periods; p++) if (c.active[p]) g.counts[p]++;
    });
    const cohorts = Object.keys(byCohort)
      .map(Number)
      .sort((a, b) => a - b)
      .map((idx) => {
        const g = byCohort[idx];
        const retained = g.counts.map((n, p) => (idx + p > asOfIdx ? null : n));
        return {
          label: labelOf(unit, idx),
          index: idx,
          size: g.size,
          retained: retained,
          rates: retained.map((n) => (n === null ? null : n / g.size)),
        };
      });
    // size-weighted average by period, using only cohorts that have reached that period
    const average = [];
    for (let p = 0; p <= periods; p++) {
      let num = 0;
      let den = 0;
      cohorts.forEach((c) => {
        if (c.retained[p] !== null) {
          num += c.retained[p];
          den += c.size;
        }
      });
      average.push(den ? num / den : null);
    }
    const first = cohorts.filter((c) => c.rates[1] !== null && c.size >= 10);
    return {
      unit: unit,
      periods: periods,
      asOf: asOf,
      customers: Object.keys(cust).length,
      cohorts: cohorts,
      average: average,
      bestCohort: first.length ? first.slice().sort((a, b) => b.rates[1] - a.rates[1])[0].label : null,
      weakestCohort: first.length > 1 ? first.slice().sort((a, b) => a.rates[1] - b.rates[1])[0].label : null,
      skipped: skipped,
    };
  }

  const pct = (x) => (x === null ? '' : (x * 100).toFixed(1) + '%');

  function toText(rep) {
    const u = rep.unit;
    const L = [
      'COHORT RETENTION (' +
        rep.customers +
        ' customers, ' +
        rep.cohorts.length +
        ' ' +
        u +
        'ly cohorts, as of ' +
        OT.formatDate(rep.asOf, 'dmy') +
        ')',
    ];
    L.push(
      'Average retention: ' +
        rep.average
          .map((a, p) => (a === null ? null : (p === 0 ? 'start' : u + ' ' + p) + ' ' + pct(a)))
          .filter(Boolean)
          .join(', '),
    );
    if (rep.bestCohort)
      L.push(
        'Best ' +
          u +
          ' 1 retention: ' +
          rep.bestCohort +
          (rep.weakestCohort ? '. Weakest: ' + rep.weakestCohort : '') +
          '. (Cohorts under 10 customers are left out.)',
      );
    return L.join('\n');
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(rep) {
    const head = ['Cohort', 'Customers'].concat(
      Array.from({ length: rep.periods + 1 }, (_, p) => (p === 0 ? 'Start' : (rep.unit === 'week' ? 'Week ' : 'Month ') + p)),
    );
    const rows = rep.cohorts.map((c) => [c.label, c.size].concat(c.rates.map(pct)));
    rows.push(['Average', rep.customers].concat(rep.average.map(pct)));
    return (
      '﻿' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  /** Sample data: six monthly cohorts ending in the month of asOf, with falling retention. Everything is dated on the 1st. */
  function sampleRows(asOf) {
    const rows = [];
    const rates = [1, 0.46, 0.34, 0.27, 0.22, 0.2];
    const base = monthIndex(asOf) - 5;
    const iso = (m) => Math.floor(m / 12) + '-' + String((m % 12) + 1).padStart(2, '0') + '-01';
    let n = 0;
    for (let c = 0; c < 6; c++) {
      const size = 40 + c * 5;
      for (let k = 0; k < size; k++) {
        const id = 'C' + (1000 + n++);
        for (let p = 0; p <= 5 - c; p++) {
          if (k < Math.round(size * rates[p]))
            rows.push({ 'Customer ID': id, 'Signup date': iso(base + c), 'Order date': iso(base + c + p) });
        }
      }
    }
    return rows;
  }

  return { rowsToEvents: rowsToEvents, report: report, toText: toText, toCsv: toCsv, sampleRows: sampleRows, labelOf: labelOf };
});
