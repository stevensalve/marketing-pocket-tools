/**
 * Budget Pacing Tracker - core logic (pure).
 *
 * Channel row: { name, budget, spent, start, end }   (start and end default to the plan period)
 * "Today" is always passed in; spend is "to date, including today".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.PacingCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const DAY = 86400000;
  const days = (a, b) => Math.round((OT.parseIsoDate(b) - OT.parseIsoDate(a)) / DAY);
  const r0 = (x) => Math.round(x);
  const MAX_ROWS = 100;
  const LOW = 0.9;
  const HIGH = 1.1;

  function amount(text) {
    const t = norm(text).replace(/^(?:rs\.?|inr|₹)\s*/i, '');
    if (t === '') return null;
    const n = OT.parseAmount(t);
    return n === null ? NaN : n;
  }

  /** Lines: channel | budget | spent so far | start (optional) | end (optional). Returns { rows, errors }. */
  function parseRows(text, period) {
    const rows = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const at = 'Line ' + (i + 1) + (p[0] ? ' (' + p[0] + ')' : '') + ': ';
        if (!p[0]) return errors.push('Line ' + (i + 1) + ' has no channel name.');
        const budget = amount(p[1]);
        if (budget === null || Number.isNaN(budget) || budget <= 0) return errors.push(at + 'the budget must be a number above zero.');
        const spent = p[2] === undefined || p[2] === '' ? 0 : amount(p[2]);
        if (spent === null || Number.isNaN(spent)) return errors.push(at + 'the spend so far is not a number.');
        const start = p[3] ? OT.toIsoDate(p[3]) : period.start;
        const end = p[4] ? OT.toIsoDate(p[4]) : period.end;
        if (!start || !end) return errors.push(at + 'the start or end date is not a real date.');
        if (end < start) return errors.push(at + 'the end date is before the start date.');
        if (rows.length < MAX_ROWS) rows.push({ name: p[0].slice(0, 60), budget: budget, spent: spent, start: start, end: end });
      });
    return { rows: rows, errors: errors };
  }

  const rowsToText = (rows) => rows.map((r) => [r.name, r.budget, r.spent, r.start, r.end].join(' | ')).join('\n');

  function checkPeriod(p) {
    try {
      OT.parseIsoDate(p.start);
      OT.parseIsoDate(p.end);
    } catch (e) {
      throw new Error('Choose a valid start and end date for the plan.');
    }
    if (p.end < p.start) throw new Error('The plan ends before it starts.');
  }

  /** Pacing for one channel. */
  function pace(r, today) {
    const total = days(r.start, r.end) + 1;
    const elapsed = Math.min(total, Math.max(0, days(r.start, today) + 1));
    const left = total - elapsed;
    const expected = (r.budget * elapsed) / total;
    const pacing = expected > 0 ? r.spent / expected : null;
    const projected = elapsed > 0 ? (r.spent / elapsed) * total : null;
    let status;
    if (elapsed === 0) status = 'Not started';
    else if (r.spent > r.budget) status = 'Overspent';
    else if (left === 0) status = r.spent / r.budget < LOW ? 'Underspent' : 'Finished';
    else if (pacing < LOW) status = 'Behind';
    else if (pacing > HIGH) status = 'Ahead';
    else status = 'On pace';
    return {
      name: r.name,
      budget: r.budget,
      spent: r.spent,
      remaining: r.budget - r.spent,
      totalDays: total,
      elapsed: elapsed,
      left: left,
      expected: r0(expected),
      pacing: pacing,
      projected: projected === null ? null : r0(projected),
      projectedGap: projected === null ? null : r0(projected - r.budget),
      currentDaily: elapsed > 0 ? r0(r.spent / elapsed) : null,
      allowedDaily: left > 0 ? r0(Math.max(0, r.budget - r.spent) / left) : null,
      status: status,
    };
  }

  /** All channels plus a total (totals assume the plan period for expected spend by summing channel figures). */
  function report(rows, period, today) {
    checkPeriod(period);
    OT.parseIsoDate(today);
    if (!rows.length) throw new Error('Add at least one channel.');
    const list = rows.map((r) => pace(r, today));
    const sum = (k) => list.reduce((a, c) => a + (c[k] === null ? 0 : c[k]), 0);
    const budget = sum('budget');
    const spent = sum('spent');
    const expected = sum('expected');
    const projected = list.every((c) => c.projected !== null) ? sum('projected') : null;
    const flags = [];
    list.forEach((c) => {
      if (c.status === 'Overspent') flags.push(c.name + ' has spent more than its budget (Rs. ' + OT.formatInr(-c.remaining) + ' over).');
      else if (c.status === 'Ahead')
        flags.push(
          c.name +
            ' is spending ' +
            Math.round((c.pacing - 1) * 100) +
            '% faster than plan: at this rate it will run out about ' +
            Math.max(0, Math.floor(c.left - (c.budget - c.spent) / (c.currentDaily || 1))) +
            ' days early.',
        );
      else if (c.status === 'Behind')
        flags.push(
          c.name +
            ' is ' +
            Math.round((1 - c.pacing) * 100) +
            '% behind plan: Rs. ' +
            OT.formatInr(c.expected - c.spent) +
            ' of expected spend has not happened.',
        );
      else if (c.status === 'Underspent') flags.push(c.name + ' finished with Rs. ' + OT.formatInr(c.remaining) + ' unspent.');
    });
    return {
      channels: list,
      total: {
        budget: budget,
        spent: spent,
        expected: expected,
        pacing: expected > 0 ? spent / expected : null,
        projected: projected,
        remaining: budget - spent,
        projectedGap: projected === null ? null : projected - budget,
      },
      flags: flags,
    };
  }

  const money = (x) => 'Rs. ' + OT.formatInr(x);
  const pct = (x) => (x === null ? '' : Math.round(x * 100) + '%');

  function toText(rep) {
    const t = rep.total;
    const L = ['BUDGET PACING'];
    L.push(
      'Budget ' +
        money(t.budget) +
        ', spent ' +
        money(t.spent) +
        ' (' +
        pct(t.budget ? t.spent / t.budget : 0) +
        ')' +
        (t.pacing !== null ? ', pacing ' + pct(t.pacing) + ' of plan' : ''),
    );
    if (t.projected !== null)
      L.push(
        'At the current pace the total reaches ' +
          money(t.projected) +
          (t.projectedGap > 0
            ? ', ' + money(t.projectedGap) + ' over budget'
            : t.projectedGap < 0
              ? ', leaving ' + money(-t.projectedGap) + ' unspent'
              : ', exactly on budget'),
      );
    L.push('');
    rep.channels.forEach((c) =>
      L.push(
        '- ' +
          c.name +
          ': ' +
          money(c.spent) +
          ' of ' +
          money(c.budget) +
          ', ' +
          c.status.toLowerCase() +
          (c.pacing !== null ? ' (' + pct(c.pacing) + ' of plan)' : ''),
      ),
    );
    if (rep.flags.length) {
      L.push('', 'Watch:');
      rep.flags.forEach((f) => L.push('- ' + f));
    }
    return L.join('\n');
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(rep) {
    const head = [
      'Channel',
      'Budget',
      'Spent',
      'Remaining',
      'Expected by today',
      'Pacing',
      'Projected total',
      'Projected vs budget',
      'Spend per day so far',
      'Allowed per day from now',
      'Days left',
      'Status',
    ];
    const rows = rep.channels.map((c) => [
      c.name,
      c.budget,
      c.spent,
      c.remaining,
      c.expected,
      pct(c.pacing),
      c.projected,
      c.projectedGap,
      c.currentDaily,
      c.allowedDaily,
      c.left,
      c.status,
    ]);
    const t = rep.total;
    rows.push(['Total', t.budget, t.spent, t.remaining, t.expected, pct(t.pacing), t.projected, t.projectedGap, '', '', '', '']);
    return (
      '﻿' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(rows, period) {
    return JSON.stringify({ app: 'budget-pacing', version: 1, period: period, rows: rows }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved pacing plan.');
    }
    if (!j || j.app !== 'budget-pacing' || !Array.isArray(j.rows) || !j.period) throw new Error('That file is not a saved pacing plan.');
    const start = OT.toIsoDate(j.period.start);
    const end = OT.toIsoDate(j.period.end);
    if (!start || !end || end < start) throw new Error('That file is not a saved pacing plan.');
    const lines = j.rows.map((r) =>
      [
        String((r && r.name) || '').replace(/[|\r\n]/g, ' '),
        r && typeof r.budget === 'number' ? r.budget : '',
        r && typeof r.spent === 'number' ? r.spent : '',
        (r && r.start) || '',
        (r && r.end) || '',
      ].join(' | '),
    );
    return { period: { start: start, end: end }, rows: parseRows(lines.join('\n'), { start: start, end: end }).rows };
  }

  /** Sample plan: a 30-day month, today is day 12. */
  function sample(today) {
    const start = OT.addDays(today, -11);
    const end = OT.addDays(today, 18);
    const period = { start: start, end: end };
    return {
      period: period,
      rows: parseRows(
        [
          'Google Search | 300000 | 150000',
          'Meta Ads | 250000 | 80000',
          'YouTube | 100000 | 38000',
          'Influencers | 150000 | 160000',
          'Email and SMS | 40000 | 15000',
        ].join('\n'),
        period,
      ).rows,
    };
  }

  return {
    parseRows: parseRows,
    rowsToText: rowsToText,
    pace: pace,
    report: report,
    toText: toText,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
