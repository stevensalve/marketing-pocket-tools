/**
 * Funnel Report - core logic (pure; SheetJS only reads the file in app.js).
 *
 * Lead: { channel, stage (index of the furthest stage reached, 0-based), value }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.FunnelCore = factory(root.OT);
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
  const MAX = 100000;
  const DEFAULT_STAGES = ['Lead', 'Qualified', 'Proposal', 'Won'];
  const LOST = ['lost', 'dropped', 'disqualified', 'rejected', 'closedlost', 'junk', 'spam'];
  const ALIASES = {
    channel: ['channel', 'source', 'leadsource', 'utmsource', 'medium', 'utmmedium', 'origin', 'campaign'],
    stage: ['stage', 'status', 'funnelstage', 'leadstatus', 'furtheststage', 'dealstage'],
    value: ['value', 'amount', 'revenue', 'dealvalue', 'dealamount', 'ordervalue'],
  };

  function parseStages(text) {
    const list = String(text || '')
      .split(/[\n,>]/)
      .map(norm)
      .filter(Boolean);
    if (list.length < 2) throw new Error('Give at least two stages, for example: Lead, Qualified, Proposal, Won.');
    if (list.length > 10) throw new Error('Use ten stages or fewer.');
    const seen = {};
    list.forEach((s) => {
      if (seen[key(s)]) throw new Error('The stage "' + s + '" is listed twice.');
      seen[key(s)] = true;
    });
    return list;
  }

  function pick(row, names) {
    const map = {};
    Object.keys(row).forEach((k) => (map[key(k)] = row[k]));
    for (let i = 0; i < names.length; i++) if (map[names[i]] !== undefined && norm(map[names[i]]) !== '') return map[names[i]];
    return '';
  }

  function amount(v) {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
    const t = norm(v).replace(/^(?:rs\.?|inr|₹)\s*/i, '');
    if (t === '') return 0;
    const n = OT.parseAmount(t);
    return n === null ? null : n;
  }

  /** rows (objects) -> { leads, problems, lost }. Lost leads count only at the first stage. */
  function rowsToLeads(rows, stages) {
    const idx = {};
    stages.forEach((s, i) => (idx[key(s)] = i));
    const leads = [];
    const problems = [];
    let lost = 0;
    (rows || []).slice(0, MAX).forEach((row, i) => {
      if (Object.keys(row).every((k) => norm(row[k]) === '')) return;
      const at = 'Row ' + (i + 2) + ': ';
      const st = key(pick(row, ALIASES.stage));
      let s = idx[st];
      if (s === undefined) {
        if (LOST.indexOf(st) !== -1) {
          s = 0;
          lost++;
        } else return problems.push(at + 'the stage "' + norm(pick(row, ALIASES.stage)) + '" is not one of your stages.');
      }
      const v = amount(pick(row, ALIASES.value));
      if (v === null) problems.push(at + 'the value is not a number; it was treated as 0.');
      leads.push({ channel: norm(pick(row, ALIASES.channel)) || '(none)', stage: s, value: v || 0 });
    });
    return { leads: leads, problems: problems, lost: lost };
  }

  /** Steps from stage counts. Counts must not rise from one stage to the next. */
  function funnel(stages, counts) {
    if (stages.length !== counts.length) throw new Error('Each stage needs a count.');
    counts.forEach((c, i) => {
      if (!Number.isInteger(c) || c < 0) throw new Error('The count for ' + stages[i] + ' must be a whole number.');
      if (i && c > counts[i - 1])
        throw new Error(
          stages[i] + ' (' + c + ') is higher than ' + stages[i - 1] + ' (' + counts[i - 1] + '). Counts should shrink down the funnel.',
        );
    });
    const top = counts[0];
    const steps = stages.map((s, i) => ({
      stage: s,
      count: counts[i],
      fromPrev: i === 0 ? null : counts[i - 1] ? counts[i] / counts[i - 1] : null,
      fromTop: top ? counts[i] / top : null,
      lost: i === 0 ? 0 : counts[i - 1] - counts[i],
    }));
    let leak = null;
    steps.forEach((s, i) => {
      if (i && s.fromPrev !== null && (leak === null || s.fromPrev < steps[leak].fromPrev)) leak = i;
    });
    return { steps: steps, biggestLeak: leak === null ? null : { from: stages[leak - 1], to: stages[leak], keep: steps[leak].fromPrev } };
  }

  /** "Lead 1200" lines (or "Lead: 1200", "Lead | 1200") -> { stages, counts }. */
  function parseCounts(text) {
    const stages = [];
    const counts = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const l = raw.trim();
        if (!l || l[0] === '#') return;
        const m = /^(.*?)\s*[:|]?\s*([\d,]+)$/.exec(l);
        if (!m || !norm(m[1])) throw new Error('Line ' + (i + 1) + ' should look like "Qualified 400".');
        stages.push(norm(m[1]));
        counts.push(Number(m[2].replace(/,/g, '')));
      });
    parseStages(stages.join(','));
    return { stages: stages, counts: counts };
  }

  /** Full report from leads. */
  function report(leads, stages) {
    if (!leads.length) throw new Error('There are no leads to report on.');
    const n = stages.length;
    const counts = stages.map((s, i) => leads.filter((l) => l.stage >= i).length);
    const f = funnel(stages, counts);
    const last = n - 1;
    const byKey = {};
    leads.forEach((l) => {
      const c = (byKey[l.channel] = byKey[l.channel] || { channel: l.channel, counts: stages.map(() => 0), revenue: 0 });
      for (let i = 0; i <= l.stage; i++) c.counts[i]++;
      if (l.stage === last) c.revenue += l.value;
    });
    const channels = Object.keys(byKey)
      .map((k) => {
        const c = byKey[k];
        const won = c.counts[last];
        return {
          channel: c.channel,
          leads: c.counts[0],
          counts: c.counts,
          won: won,
          rate: c.counts[0] ? won / c.counts[0] : 0,
          revenue: c.revenue,
          avgValue: won ? Math.round(c.revenue / won) : null,
          share: c.counts[0] / leads.length,
        };
      })
      .sort((a, b) => b.rate - a.rate || b.leads - a.leads || a.channel.localeCompare(b.channel));
    const reliable = channels.filter((c) => c.leads >= 20);
    return {
      stages: stages,
      funnel: f,
      total: leads.length,
      won: counts[last],
      rate: counts[last] / counts[0],
      revenue: leads.filter((l) => l.stage === last).reduce((a, l) => a + l.value, 0),
      channels: channels,
      bestChannel: reliable.length ? reliable[0].channel : null,
      weakestChannel: reliable.length > 1 ? reliable[reliable.length - 1].channel : null,
      smallChannels: channels.filter((c) => c.leads < 20).length,
    };
  }

  const pct = (x) => (x === null ? '' : (x * 100).toFixed(1) + '%');
  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(rep) {
    const a = [['Stage', 'Count', 'Kept from previous', 'Kept from top', 'Lost at this step']].concat(
      rep.funnel.steps.map((s) => [s.stage, s.count, pct(s.fromPrev), pct(s.fromTop), s.lost]),
    );
    const b = [
      ['Channel', 'Leads', 'Share of leads'].concat(rep.stages.slice(1), [
        'Conversion to ' + rep.stages[rep.stages.length - 1],
        'Revenue',
        'Average value',
      ]),
    ].concat(
      rep.channels.map((c) =>
        [c.channel, c.leads, pct(c.share)].concat(c.counts.slice(1), [pct(c.rate), c.revenue, c.avgValue === null ? '' : c.avgValue]),
      ),
    );
    return (
      '﻿' +
      a
        .concat([[]], b)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function toText(rep) {
    const L = ['FUNNEL: ' + rep.total + ' leads, ' + rep.won + ' ' + rep.stages[rep.stages.length - 1] + ' (' + pct(rep.rate) + ')'];
    rep.funnel.steps.forEach((s, i) =>
      L.push('- ' + s.stage + ': ' + s.count + (i ? ' (' + pct(s.fromPrev) + ' of ' + rep.stages[i - 1] + ')' : '')),
    );
    if (rep.funnel.biggestLeak)
      L.push(
        'Biggest leak: ' +
          rep.funnel.biggestLeak.from +
          ' to ' +
          rep.funnel.biggestLeak.to +
          ' keeps only ' +
          pct(rep.funnel.biggestLeak.keep) +
          '.',
      );
    if (rep.bestChannel)
      L.push(
        'Best channel: ' +
          rep.bestChannel +
          (rep.weakestChannel ? '. Weakest: ' + rep.weakestChannel : '') +
          '. (Channels with under 20 leads are left out of this comparison.)',
      );
    return L.join('\n');
  }

  function sampleRows() {
    const out = [];
    // dist[i] = number of leads whose furthest stage is DEFAULT_STAGES[i]
    const add = (channel, dist, value) =>
      dist.forEach((cnt, stage) => {
        for (let i = 0; i < cnt; i++)
          out.push({
            'Lead ID': 'L' + (1000 + out.length),
            Source: channel,
            Stage: DEFAULT_STAGES[stage],
            'Deal value': stage === 3 ? value : '',
          });
      });
    add('Google Ads', [60, 40, 25, 15], 85000);
    add('Meta Ads', [90, 30, 8, 4], 60000);
    add('Referral', [10, 10, 12, 18], 120000);
    add('Organic search', [40, 25, 10, 5], 70000);
    add('Webinar', [8, 4, 2, 1], 90000);
    return out;
  }

  return {
    DEFAULT_STAGES: DEFAULT_STAGES,
    parseStages: parseStages,
    rowsToLeads: rowsToLeads,
    funnel: funnel,
    parseCounts: parseCounts,
    report: report,
    toCsv: toCsv,
    toText: toText,
    sampleRows: sampleRows,
  };
});
