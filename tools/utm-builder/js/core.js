/**
 * UTM Link Builder - core logic (pure, no dependencies).
 *
 * Row: { url, source, medium, campaign, term, content }
 * Rules: { lowercase: true, separator: '-' | '_', allowedMedium: [] }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UtmCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIELDS = ['source', 'medium', 'campaign', 'term', 'content'];
  const REQUIRED = ['source', 'medium', 'campaign'];
  const COMMON_MEDIUMS = ['cpc', 'paid-social', 'email', 'social', 'organic', 'referral', 'display', 'affiliate', 'sms', 'whatsapp'];
  const MAX_URL = 2000;

  const defaultRules = () => ({ lowercase: true, separator: '-', allowedMedium: COMMON_MEDIUMS.slice() });

  function checkRules(r) {
    const o = Object.assign(defaultRules(), r || {});
    if (o.separator !== '-' && o.separator !== '_') throw new Error('The separator must be - or _.');
    o.lowercase = o.lowercase !== false;
    o.allowedMedium = (Array.isArray(o.allowedMedium) ? o.allowedMedium : []).map((m) => String(m).trim().toLowerCase()).filter(Boolean);
    return o;
  }

  /** Apply the naming rules to one value. */
  function clean(value, rules) {
    const r = checkRules(rules);
    let s = String(value === null || value === undefined ? '' : value).trim();
    if (r.lowercase) s = s.toLowerCase();
    s = s.replace(/[\s_-]+/g, r.separator);
    s = s.replace(/[^\p{L}\p{M}\p{N}.+|-]/gu, (c) => (c === '_' ? c : ''));
    // keep separator tidy
    s = s
      .replace(new RegExp('\\' + r.separator + '{2,}', 'g'), r.separator)
      .replace(new RegExp('^\\' + r.separator + '|\\' + r.separator + '$', 'g'), '');
    return s;
  }

  /** Build one tagged link. Returns { url, errors, warnings, values }. */
  function build(row, rules) {
    const r = checkRules(rules);
    const errors = [];
    const warnings = [];
    const values = {};
    let u = null;
    const raw = String((row && row.url) || '').trim();
    if (!raw) errors.push('Add the page address.');
    else {
      try {
        u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          errors.push('Only http and https addresses can be tagged.');
          u = null;
        } else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) warnings.push('No https:// was typed, so https:// was added.');
        else if (u.protocol === 'http:') warnings.push('This address uses http, not https.');
      } catch (e) {
        errors.push('That page address is not valid.');
      }
    }
    FIELDS.forEach((f) => {
      const before = String((row && row[f]) || '').trim();
      const after = clean(before, r);
      values[f] = after;
      if (REQUIRED.indexOf(f) !== -1 && !after) errors.push('Add the ' + f + '.');
      if (before && after !== before) warnings.push(f + ' "' + before + '" was changed to "' + after + '".');
    });
    if (values.medium && r.allowedMedium.length && r.allowedMedium.indexOf(values.medium) === -1)
      warnings.push('Medium "' + values.medium + '" is not in your allowed list (' + r.allowedMedium.join(', ') + ').');
    let url = '';
    if (u && !errors.length) {
      const replaced = [];
      ['source', 'medium', 'campaign', 'term', 'content', 'id'].forEach((k) => {
        if (u.searchParams.has('utm_' + k)) {
          replaced.push('utm_' + k);
          u.searchParams.delete('utm_' + k);
        }
      });
      if (replaced.length) warnings.push('The address already had ' + replaced.join(', ') + '; they were replaced.');
      FIELDS.forEach((f) => values[f] && u.searchParams.set('utm_' + f, values[f]));
      url = u.toString();
      if (url.length > MAX_URL)
        warnings.push('The link is ' + url.length + ' characters long; some systems cut links over ' + MAX_URL + '.');
    }
    return { url: url, errors: errors, warnings: warnings, values: values };
  }

  /** Lines: url | source | medium | campaign | term | content. # comments and blank lines are skipped. */
  function parseBatch(text) {
    const rows = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const l = line.trim();
        if (!l || l[0] === '#') return;
        const p = l.split('|').map((x) => x.trim());
        if (rows.length < 500)
          rows.push({
            line: i + 1,
            url: p[0] || '',
            source: p[1] || '',
            medium: p[2] || '',
            campaign: p[3] || '',
            term: p[4] || '',
            content: p[5] || '',
          });
      });
    return rows;
  }

  const batchToText = (rows) =>
    rows.map((r) => [r.url, r.source, r.medium, r.campaign, r.term, r.content].join(' | ').replace(/( \| )+$/, '')).join('\n');

  function buildBatch(rows, rules) {
    const out = rows.map((r) => Object.assign({ line: r.line }, build(r, rules)));
    const seen = {};
    out.forEach((o) => {
      if (!o.url) return;
      if (seen[o.url]) o.warnings.push('Same link as line ' + seen[o.url] + '.');
      else seen[o.url] = o.line;
    });
    return out;
  }

  /** Find names that differ only by case, spaces, hyphens or underscores. */
  function audit(rows) {
    const groups = {};
    rows.forEach((r) => {
      FIELDS.slice(0, 3).forEach((f) => {
        const v = String(r[f] || '').trim();
        if (!v) return;
        const k = f + ':' + v.toLowerCase().replace(/[\s_-]+/g, '');
        groups[k] = groups[k] || { field: f, names: [] };
        if (groups[k].names.indexOf(v) === -1) groups[k].names.push(v);
      });
    });
    return Object.keys(groups)
      .map((k) => groups[k])
      .filter((g) => g.names.length > 1);
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(results) {
    const head = ['Line', 'Link', 'Source', 'Medium', 'Campaign', 'Term', 'Content', 'Problems', 'Notes'];
    const rows = results.map((r) => [
      r.line,
      r.url,
      r.values.source,
      r.values.medium,
      r.values.campaign,
      r.values.term,
      r.values.content,
      r.errors.join('; '),
      r.warnings.join('; '),
    ]);
    return (
      '﻿' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(rows, rules) {
    return JSON.stringify(
      {
        app: 'utm-builder',
        version: 1,
        rules: checkRules(rules),
        rows: rows.map((r) => ({ url: r.url, source: r.source, medium: r.medium, campaign: r.campaign, term: r.term, content: r.content })),
      },
      null,
      2,
    );
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved link list.');
    }
    if (!j || j.app !== 'utm-builder' || !Array.isArray(j.rows)) throw new Error('That file is not a saved link list.');
    let rules;
    try {
      rules = checkRules(j.rules);
    } catch (e) {
      rules = defaultRules();
    }
    return {
      rules: rules,
      rows: parseBatch(
        batchToText(
          j.rows.map((r) =>
            ['url', 'source', 'medium', 'campaign', 'term', 'content'].reduce(
              (o, f) => ((o[f] = String((r && r[f]) || '').replace(/[|\r\n]/g, ' ')), o),
              {},
            ),
          ),
        ),
      ),
    };
  }

  function sample() {
    return parseBatch(
      [
        'https://example.com/diwali-sale | Google | CPC | Diwali Sale 2026 | festive offers | headline-a',
        'https://example.com/diwali-sale | facebook | paid social | diwali_sale_2026 | | video 15s',
        'example.com/newsletter?ref=footer | newsletter | email | Diwali Sale 2026 | | ',
        'https://example.com/diwali-sale | whatsapp | broadcast | diwali-sale-2026',
      ].join('\n'),
    );
  }

  return {
    FIELDS: FIELDS,
    COMMON_MEDIUMS: COMMON_MEDIUMS,
    defaultRules: defaultRules,
    clean: clean,
    build: build,
    parseBatch: parseBatch,
    batchToText: batchToText,
    buildBatch: buildBatch,
    audit: audit,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
