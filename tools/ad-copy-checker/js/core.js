/**
 * Ad Copy Length Checker - core logic (pure, no dependencies).
 * Limits are common published figures at the time of writing and change often:
 * every field limit can be edited, and the tool says so.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) => String(s === null || s === undefined ? '' : s).trim();

  // limit = characters; min/max = how many lines the field takes; hard = platform rejects text over the limit (false = it is cut or ignored in the feed)
  const PRESETS = [
    {
      id: 'google-rsa',
      name: 'Google Search (responsive ad)',
      doubleWidth: true,
      unique: true,
      fields: [
        { id: 'headline', label: 'Headlines', limit: 30, min: 3, max: 15, hard: true },
        { id: 'description', label: 'Descriptions', limit: 90, min: 2, max: 4, hard: true },
        { id: 'path1', label: 'Display path 1', limit: 15, min: 0, max: 1, hard: true },
        { id: 'path2', label: 'Display path 2', limit: 15, min: 0, max: 1, hard: true },
      ],
    },
    {
      id: 'meta-feed',
      name: 'Meta feed (Facebook and Instagram)',
      doubleWidth: false,
      unique: false,
      fields: [
        { id: 'primary', label: 'Primary text', limit: 125, min: 1, max: 5, hard: false },
        { id: 'headline', label: 'Headline', limit: 40, min: 0, max: 5, hard: false },
        { id: 'description', label: 'Link description', limit: 30, min: 0, max: 5, hard: false },
      ],
    },
    {
      id: 'linkedin',
      name: 'LinkedIn single image ad',
      doubleWidth: false,
      unique: false,
      fields: [
        { id: 'intro', label: 'Introductory text', limit: 150, min: 1, max: 5, hard: false },
        { id: 'headline', label: 'Headline', limit: 70, min: 0, max: 5, hard: false },
        { id: 'description', label: 'Description', limit: 100, min: 0, max: 5, hard: false },
      ],
    },
    {
      id: 'x-post',
      name: 'X post',
      doubleWidth: false,
      unique: false,
      fields: [{ id: 'post', label: 'Post', limit: 280, min: 1, max: 5, hard: true }],
    },
    {
      id: 'email',
      name: 'Email',
      doubleWidth: false,
      unique: false,
      fields: [
        { id: 'subject', label: 'Subject lines', limit: 60, min: 1, max: 10, hard: false },
        { id: 'preheader', label: 'Preheaders', limit: 100, min: 0, max: 10, hard: false },
      ],
    },
    {
      id: 'custom',
      name: 'Custom limit',
      doubleWidth: false,
      unique: false,
      fields: [{ id: 'text', label: 'Text', limit: 100, min: 0, max: 20, hard: false }],
    },
  ];

  const preset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) throw new Error('Unknown ad type.');
    return p;
  };

  // Wide characters (CJK, full-width forms) count as two on Google Ads.
  const isWide = (cp) =>
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6);

  /** Length of a line the way the platform counts it. */
  function length(text, doubleWidth) {
    let n = 0;
    for (const ch of String(text)) n += doubleWidth && isWide(ch.codePointAt(0)) ? 2 : 1;
    return n;
  }

  /** The text cut at the limit, as it would show. */
  function cut(text, limit, doubleWidth) {
    let n = 0;
    let out = '';
    for (const ch of String(text)) {
      const w = doubleWidth && isWide(ch.codePointAt(0)) ? 2 : 1;
      if (n + w > limit) break;
      out += ch;
      n += w;
    }
    return out;
  }

  const REVIEW = [
    /\b(best|cheapest|number\s*1|no\.?\s*1)\b/i,
    /#\s*1\b/,
    /\bguarantee[ds]?\b/i,
    /\b100\s*%/,
    /\b(cure[sd]?|miracle)\b/i,
    /\bclick here\b/i,
    /\bfree\b/i,
  ];

  /** Check one line. Returns { text, length, limit, left, status, shown, flags }. */
  function checkLine(text, limit, opts) {
    const o = opts || {};
    const t = norm(text);
    const len = length(t, o.doubleWidth);
    const flags = [];
    const words = t.split(/\s+/);
    if (words.some((w) => w.length > 4 && /^[A-Z0-9!?'"-]+$/.test(w) && /[A-Z]{5}/.test(w)))
      flags.push('Uses ALL CAPS words, which many platforms reject or reduce.');
    if (/[!?]{2,}/.test(t) || (t.match(/!/g) || []).length > 1) flags.push('Repeated or multiple exclamation marks.');
    if (/\s{2,}/.test(String(text).trim())) flags.push('Has double spaces.');
    if (REVIEW.some((r) => r.test(t)))
      flags.push(
        'Contains wording that ad reviewers often check (such as best, #1, guaranteed, free, click here): make sure you can support it.',
      );
    const emoji = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
    if (emoji > 2) flags.push('Uses ' + emoji + ' emoji; some platforms limit or ignore them.');
    const status = len > limit ? 'over' : len >= Math.ceil(limit * 0.9) ? 'near' : 'ok';
    return {
      text: t,
      length: len,
      limit: limit,
      left: limit - len,
      status: status,
      shown: len > limit ? cut(t, limit, o.doubleWidth) : t,
      flags: flags,
    };
  }

  const parseLines = (text) =>
    String(text || '')
      .split(/\r?\n/)
      .map(norm)
      .filter(Boolean);

  /**
   * Audit a whole ad. values = { fieldId: 'one line each' }; limits = optional { fieldId: number } overrides.
   * Returns { fields: [...], problems: [...], over: count }.
   */
  function audit(presetId, values, limits) {
    const p = preset(presetId);
    const v = values || {};
    const fields = p.fields.map((f) => {
      const limit = limits && Number.isInteger(limits[f.id]) && limits[f.id] > 0 ? limits[f.id] : f.limit;
      const lines = parseLines(v[f.id]);
      const results = lines.map((l) => checkLine(l, limit, { doubleWidth: p.doubleWidth }));
      const problems = [];
      if (lines.length < f.min) problems.push(f.label + ': add at least ' + f.min + ' (you have ' + lines.length + ').');
      if (lines.length > f.max) problems.push(f.label + ': ' + lines.length + ' lines is more than the ' + f.max + ' allowed.');
      if (p.unique) {
        const seen = {};
        results.forEach((r) => {
          const k = r.text.toLowerCase();
          if (seen[k]) problems.push(f.label + ': "' + r.text + '" is repeated; each must be different.');
          seen[k] = true;
        });
      }
      return { id: f.id, label: f.label, limit: limit, hard: f.hard, min: f.min, max: f.max, results: results, problems: problems };
    });
    const over = fields.reduce((a, f) => a + f.results.filter((r) => r.status === 'over').length, 0);
    const problems = [];
    fields.forEach((f) => f.problems.forEach((x) => problems.push(x)));
    return { preset: p.id, name: p.name, fields: fields, over: over, problems: problems };
  }

  const GSM = new Set(
    Array.from(
      '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
    ),
  );
  const GSM_EXT = new Set(Array.from('^{}\\[~]|€'));

  /** SMS segments: GSM-7 (160, or 153 per part) or Unicode (70, or 67 per part). */
  function sms(text) {
    const t = String(text);
    let septets = 0;
    let gsm = true;
    for (const ch of t) {
      if (GSM.has(ch)) septets++;
      else if (GSM_EXT.has(ch)) septets += 2;
      else {
        gsm = false;
        break;
      }
    }
    const units = gsm ? septets : Array.from(t).reduce((a, ch) => a + (ch.codePointAt(0) > 0xffff ? 2 : 1), 0);
    const single = gsm ? 160 : 70;
    const per = gsm ? 153 : 67;
    const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / per);
    return {
      encoding: gsm ? 'GSM-7' : 'Unicode',
      units: units,
      segments: segments,
      left: segments <= 1 ? single - units : segments * per - units,
    };
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(a) {
    const rows = [['Ad type', 'Field', 'Text', 'Length', 'Limit', 'Status', 'Notes']];
    a.fields.forEach((f) => f.results.forEach((r) => rows.push([a.name, f.label, r.text, r.length, r.limit, r.status, r.flags.join(' ')])));
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }

  function toText(a) {
    const L = ['AD COPY CHECK - ' + a.name];
    a.fields.forEach((f) => {
      if (!f.results.length) return;
      L.push('', f.label + ' (limit ' + f.limit + '):');
      f.results.forEach((r) =>
        L.push('- ' + r.text + ' [' + r.length + '/' + r.limit + (r.status === 'over' ? ', ' + -r.left + ' too long' : '') + ']'),
      );
    });
    if (a.problems.length) {
      L.push('', 'To fix:');
      a.problems.forEach((p) => L.push('- ' + p));
    }
    return L.join('\n');
  }

  function serialize(presetId, values, limits) {
    return JSON.stringify({ app: 'ad-copy-checker', version: 1, preset: presetId, values: values, limits: limits || {} }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved ad.');
    }
    if (!j || j.app !== 'ad-copy-checker' || !PRESETS.some((p) => p.id === j.preset)) throw new Error('That file is not a saved ad.');
    const p = preset(j.preset);
    const values = {};
    const limits = {};
    p.fields.forEach((f) => {
      values[f.id] = j.values && typeof j.values[f.id] === 'string' ? j.values[f.id].slice(0, 5000) : '';
      if (j.limits && Number.isInteger(j.limits[f.id]) && j.limits[f.id] > 0 && j.limits[f.id] <= 100000) limits[f.id] = j.limits[f.id];
    });
    return { preset: p.id, values: values, limits: limits };
  }

  function sample() {
    return {
      preset: 'google-rsa',
      values: {
        headline: [
          'Diwali Sale: Up To 40% Off',
          'Free Delivery Across India',
          'Shop Gifts Under Rs. 999',
          'Official Store With Easy 10 Day Returns',
          'THE BEST LAPTOP DEALS EVER!!',
          'Free Delivery Across India',
        ].join('\n'),
        description: [
          'Browse 500+ festive gifts for family and friends. Order by 28 Oct for Diwali delivery.',
          'Easy 10-day returns and secure payments on every order, plus a free gift wrap on orders above Rs. 1,499.',
        ].join('\n'),
        path1: 'diwali',
        path2: 'sale-2026-offers',
      },
      limits: {},
    };
  }

  return {
    PRESETS: PRESETS,
    length: length,
    cut: cut,
    checkLine: checkLine,
    parseLines: parseLines,
    audit: audit,
    sms: sms,
    toCsv: toCsv,
    toText: toText,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
