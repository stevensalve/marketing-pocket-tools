/**
 * ROAS & Campaign ROI Calculator - core logic (pure).
 *
 * Row: { name, spend, impressions, clicks, conversions, revenue }   (numbers; blanks = null)
 * Margin: gross margin as a fraction (0.4 = 40%), or null when unknown.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.RoasCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const MAX_ROWS = 300;

  /** "Rs. 1,20,000" or "1.2L"-free plain numbers; blank gives null, bad text gives NaN. */
  function num(text) {
    const t = norm(text).replace(/^(?:rs\.?|inr|₹)\s*/i, '');
    if (t === '' || t === '-') return null;
    const n = OT.parseAmount(t);
    return n === null ? NaN : n;
  }

  /** Lines: name | spend | impressions | clicks | conversions | revenue. Returns { rows, errors }. */
  function parseRows(text) {
    const rows = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const label = 'Line ' + (i + 1);
        if (!p[0]) return errors.push(label + ' has no name.');
        const f = [p[1], p[2], p[3], p[4], p[5]].map(num);
        const names = ['spend', 'impressions', 'clicks', 'conversions', 'revenue'];
        const bad = f.findIndex((v) => Number.isNaN(v));
        if (bad !== -1) return errors.push(label + ' (' + p[0] + '): ' + names[bad] + ' is not a number.');
        if (f[0] === null) return errors.push(label + ' (' + p[0] + '): add the spend.');
        if (f[2] !== null && f[1] !== null && f[2] > f[1]) return errors.push(label + ' (' + p[0] + '): clicks are more than impressions.');
        if (f[3] !== null && f[2] !== null && f[3] > f[2]) return errors.push(label + ' (' + p[0] + '): conversions are more than clicks.');
        if (rows.length < MAX_ROWS)
          rows.push({ name: p[0].slice(0, 80), spend: f[0], impressions: f[1], clicks: f[2], conversions: f[3], revenue: f[4] });
      });
    return { rows: rows, errors: errors };
  }

  const rowsToText = (rows) =>
    rows
      .map((r) =>
        [r.name, r.spend, r.impressions, r.clicks, r.conversions, r.revenue]
          .map((v) => (v === null ? '' : v))
          .join(' | ')
          .replace(/( \| )+$/, ''),
      )
      .join('\n');

  const div = (a, b) => (a === null || b === null || b === 0 ? null : a / b);
  const r2 = (x) => (x === null ? null : Math.round(x * 100) / 100);

  /** All the ratios for one row (or a total). */
  function metrics(r, margin) {
    const m = margin === undefined ? null : margin;
    if (m !== null && !(m > 0 && m <= 1)) throw new Error('Gross margin must be between 0% and 100%.');
    const roas = div(r.revenue, r.spend);
    const grossProfit = r.revenue === null || m === null ? null : r.revenue * m;
    const profit = grossProfit === null ? null : grossProfit - r.spend;
    return {
      ctr: div(r.clicks, r.impressions),
      cpc: r2(div(r.spend, r.clicks)),
      cpm: r2(r.impressions ? (r.spend / r.impressions) * 1000 : null),
      cvr: div(r.conversions, r.clicks),
      cpa: r2(div(r.spend, r.conversions)),
      aov: r2(div(r.revenue, r.conversions)),
      roas: roas === null ? null : Math.round(roas * 100) / 100,
      roi: r.revenue === null ? null : (r.revenue - r.spend) / r.spend,
      profit: r2(profit),
      profitRoi: profit === null ? null : profit / r.spend,
    };
  }

  /** Break-even ROAS for a gross margin, and the most you can pay per sale. */
  function breakEven(margin, aov) {
    if (!(margin > 0 && margin <= 1)) throw new Error('Gross margin must be between 0% and 100%.');
    return { roas: Math.round((1 / margin) * 100) / 100, maxCpa: aov > 0 ? r2(aov * margin) : null };
  }

  const sum = (rows, k) => {
    const v = rows.map((r) => r[k]).filter((x) => x !== null);
    return v.length === rows.length && v.length ? v.reduce((a, b) => a + b, 0) : null;
  };

  /** Per-campaign metrics, a total row and a verdict against break-even. */
  function report(rows, margin) {
    if (!rows.length) throw new Error('Add at least one campaign.');
    const be = margin ? breakEven(margin, null).roas : null;
    const list = rows.map((r) => {
      const m = metrics(r, margin);
      let verdict = '';
      if (be !== null && m.roas !== null) verdict = m.roas >= be ? 'Profitable' : 'Losing money';
      return Object.assign({}, r, m, { verdict: verdict });
    });
    const total = {
      name: 'Total',
      spend: sum(rows, 'spend'),
      impressions: sum(rows, 'impressions'),
      clicks: sum(rows, 'clicks'),
      conversions: sum(rows, 'conversions'),
      revenue: sum(rows, 'revenue'),
    };
    const tm = metrics(total, margin);
    let tv = '';
    if (be !== null && tm.roas !== null) tv = tm.roas >= be ? 'Profitable' : 'Losing money';
    const ranked = list.filter((r) => r.roas !== null).sort((a, b) => b.roas - a.roas);
    return {
      rows: list,
      total: Object.assign({}, total, tm, { verdict: tv }),
      breakEvenRoas: be,
      best: ranked.length ? ranked[0].name : null,
      worst: ranked.length > 1 ? ranked[ranked.length - 1].name : null,
    };
  }

  const pct = (x) => (x === null ? '' : (x * 100).toFixed(2) + '%');
  const money = (x, d) => (x === null ? '' : 'Rs. ' + OT.formatInr(x, d === undefined ? 0 : d));

  function toText(rep) {
    const t = rep.total;
    const L = ['CAMPAIGN RETURN'];
    L.push(
      'Spend ' +
        money(t.spend) +
        (t.revenue !== null ? ', revenue ' + money(t.revenue) : '') +
        (t.roas !== null ? ', ROAS ' + t.roas.toFixed(2) + 'x' : ''),
    );
    if (rep.breakEvenRoas !== null)
      L.push('Break-even ROAS ' + rep.breakEvenRoas.toFixed(2) + 'x' + (t.verdict ? ': overall ' + t.verdict.toLowerCase() : ''));
    if (t.profit !== null) L.push('Profit after ad spend ' + (t.profit < 0 ? '-' : '') + money(Math.abs(t.profit)));
    L.push('');
    rep.rows.forEach((r) =>
      L.push(
        '- ' +
          r.name +
          ': spend ' +
          money(r.spend) +
          (r.roas !== null ? ', ROAS ' + r.roas.toFixed(2) + 'x' : '') +
          (r.cpa !== null ? ', CPA ' + money(r.cpa) : '') +
          (r.verdict ? ' (' + r.verdict.toLowerCase() + ')' : ''),
      ),
    );
    if (rep.best && rep.worst) L.push('', 'Best ROAS: ' + rep.best + '. Weakest: ' + rep.worst + '.');
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
      'Campaign',
      'Spend',
      'Impressions',
      'Clicks',
      'Conversions',
      'Revenue',
      'CTR',
      'CPC',
      'CPM',
      'Conversion rate',
      'CPA',
      'Average order value',
      'ROAS',
      'ROI',
      'Profit after spend',
      'Verdict',
    ];
    const body = rep.rows
      .concat([rep.total])
      .map((r) => [
        r.name,
        r.spend,
        r.impressions,
        r.clicks,
        r.conversions,
        r.revenue,
        pct(r.ctr),
        r.cpc,
        r.cpm,
        pct(r.cvr),
        r.cpa,
        r.aov,
        r.roas,
        pct(r.roi),
        r.profit,
        r.verdict,
      ]);
    return (
      '﻿' +
      [head]
        .concat(body)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(rows, margin) {
    return JSON.stringify({ app: 'roas-calculator', version: 1, margin: margin === undefined ? null : margin, rows: rows }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved campaign list.');
    }
    if (!j || j.app !== 'roas-calculator' || !Array.isArray(j.rows)) throw new Error('That file is not a saved campaign list.');
    const cl = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : '');
    const lines = j.rows.map((r) =>
      [
        String((r && r.name) || '').replace(/[|\r\n]/g, ' '),
        cl(r && r.spend),
        cl(r && r.impressions),
        cl(r && r.clicks),
        cl(r && r.conversions),
        cl(r && r.revenue),
      ].join(' | '),
    );
    return {
      rows: parseRows(lines.join('\n')).rows,
      margin: typeof j.margin === 'number' && j.margin > 0 && j.margin <= 1 ? j.margin : null,
    };
  }

  function sample() {
    return {
      margin: 0.4,
      rows: parseRows(
        [
          'Google Search - brand | 120000 | 400000 | 24000 | 960 | 480000',
          'Google Search - generic | 300000 | 2500000 | 50000 | 900 | 540000',
          'Meta - prospecting | 250000 | 6000000 | 90000 | 720 | 360000',
          'Meta - retargeting | 80000 | 800000 | 16000 | 560 | 392000',
          'YouTube | 150000 | 5000000 | 40000 | 200 | 100000',
        ].join('\n'),
      ).rows,
    };
  }

  return {
    parseRows: parseRows,
    rowsToText: rowsToText,
    metrics: metrics,
    breakEven: breakEven,
    report: report,
    toText: toText,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
