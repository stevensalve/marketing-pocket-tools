/**
 * A/B Test Significance - core logic (pure).
 * Two-proportion z-test, sample-size planning and a one-page PDF summary.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AbCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const CONFIDENCE = [0.8, 0.9, 0.95, 0.99];

  /** Standard normal CDF (complementary error function, Numerical Recipes, error below 1.2e-7). */
  function cdf(z) {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.5 * x);
    const erfc =
      t *
      Math.exp(
        -x * x -
          1.26551223 +
          t *
            (1.00002368 +
              t *
                (0.37409196 +
                  t *
                    (0.09678418 +
                      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
      );
    return z >= 0 ? 1 - erfc / 2 : erfc / 2;
  }

  /** Inverse standard normal CDF (Acklam's algorithm, relative error about 1e-9). */
  function inv(p) {
    if (!(p > 0 && p < 1)) throw new Error('The probability must be between 0 and 1.');
    const a = [
      -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    ];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const lo = 0.02425;
    let q;
    let r;
    if (p < lo) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - lo) return -inv(1 - p);
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= 1e9;

  /** Validate the two groups. Returns a list of plain-language problems. */
  function check(a, b) {
    const p = [];
    [
      ['A', a],
      ['B', b],
    ].forEach((g) => {
      const v = g[1];
      if (!v || !isCount(v.visitors) || v.visitors < 1) p.push('Version ' + g[0] + ': visitors must be a whole number above zero.');
      else if (!isCount(v.conversions)) p.push('Version ' + g[0] + ': conversions must be a whole number.');
      else if (v.conversions > v.visitors) p.push('Version ' + g[0] + ': conversions cannot be more than visitors.');
    });
    return p;
  }

  /** Compare two versions. confidence is 0.8, 0.9, 0.95 or 0.99. */
  function compare(a, b, confidence) {
    const conf = confidence === undefined ? 0.95 : confidence;
    if (CONFIDENCE.indexOf(conf) === -1) throw new Error('Confidence must be 80%, 90%, 95% or 99%.');
    const problems = check(a, b);
    if (problems.length) throw new Error(problems[0]);
    const pa = a.conversions / a.visitors;
    const pb = b.conversions / b.visitors;
    const pool = (a.conversions + b.conversions) / (a.visitors + b.visitors);
    const se0 = Math.sqrt(pool * (1 - pool) * (1 / a.visitors + 1 / b.visitors));
    const z = se0 === 0 ? 0 : (pb - pa) / se0;
    const pValue = se0 === 0 ? 1 : 2 * (1 - cdf(Math.abs(z)));
    const zc = inv(1 - (1 - conf) / 2);
    const se1 = Math.sqrt((pa * (1 - pa)) / a.visitors + (pb * (1 - pb)) / b.visitors);
    const diff = pb - pa;
    const warnings = [];
    [
      ['A', a],
      ['B', b],
    ].forEach((g) => {
      if (g[1].conversions < 5 || g[1].visitors - g[1].conversions < 5)
        warnings.push('Version ' + g[0] + ' has fewer than 5 conversions or non-conversions: this test is unreliable.');
      else if (g[1].conversions < 100) warnings.push('Version ' + g[0] + ' has under 100 conversions: treat the result as a hint.');
    });
    const significant = pValue < 1 - conf;
    let verdict;
    if (significant)
      verdict = (diff > 0 ? 'B' : 'A') + ' is better than ' + (diff > 0 ? 'A' : 'B') + ' at ' + Math.round(conf * 100) + '% confidence.';
    else verdict = 'No clear winner at ' + Math.round(conf * 100) + '% confidence: the difference could be chance.';
    return {
      rateA: pa,
      rateB: pb,
      diff: diff,
      relLift: pa === 0 ? null : diff / pa,
      z: z,
      pValue: pValue,
      confidence: conf,
      significant: significant,
      ciLow: diff - zc * se1,
      ciHigh: diff + zc * se1,
      verdict: verdict,
      warnings: warnings,
    };
  }

  /** Visitors needed per version to detect a change from baseline. mde is relative (0.2 = 20% better) unless absolute is true. */
  function sampleSize(o) {
    const base = o.baseline;
    const conf = o.confidence === undefined ? 0.95 : o.confidence;
    const power = o.power === undefined ? 0.8 : o.power;
    if (!(base > 0 && base < 1)) throw new Error('The current conversion rate must be between 0% and 100%.');
    if (!(o.mde > 0)) throw new Error('The change you want to detect must be above zero.');
    if (CONFIDENCE.indexOf(conf) === -1) throw new Error('Confidence must be 80%, 90%, 95% or 99%.');
    if ([0.7, 0.8, 0.9].indexOf(power) === -1) throw new Error('Power must be 70%, 80% or 90%.');
    const p2 = o.absolute ? base + o.mde : base * (1 + o.mde);
    if (!(p2 > 0 && p2 < 1)) throw new Error('That change would take the rate outside 0% to 100%.');
    const za = inv(1 - (1 - conf) / 2);
    const zb = inv(power);
    const pbar = (base + p2) / 2;
    const n =
      Math.pow(za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(base * (1 - base) + p2 * (1 - p2)), 2) / Math.pow(p2 - base, 2);
    return { perVersion: Math.ceil(n), total: Math.ceil(n) * 2, target: p2 };
  }

  /** Days needed given daily visitors to the whole test (split evenly). */
  function duration(perVersion, dailyVisitors, versions) {
    const v = versions || 2;
    if (!(dailyVisitors > 0)) throw new Error('Daily visitors must be above zero.');
    const days = Math.ceil((perVersion * v) / dailyVisitors);
    return { days: days, weeks: Math.ceil(days / 7) };
  }

  const pct = (x, d) => (x * 100).toFixed(d === undefined ? 2 : d) + '%';

  function toText(name, a, b, r) {
    const L = [(norm(name) || 'A/B test') + ' - result'];
    L.push('A: ' + a.conversions + ' of ' + a.visitors + ' converted (' + pct(r.rateA) + ')');
    L.push('B: ' + b.conversions + ' of ' + b.visitors + ' converted (' + pct(r.rateB) + ')');
    L.push(
      'Difference: ' +
        (r.diff >= 0 ? '+' : '') +
        pct(r.diff) +
        ' points' +
        (r.relLift === null ? '' : ' (' + (r.relLift >= 0 ? '+' : '') + pct(r.relLift, 1) + ' relative)'),
    );
    L.push(Math.round(r.confidence * 100) + '% range for the difference: ' + pct(r.ciLow) + ' to ' + pct(r.ciHigh));
    L.push('p-value: ' + (r.pValue < 0.0001 ? 'below 0.0001' : r.pValue.toFixed(4)));
    L.push('Verdict: ' + r.verdict);
    r.warnings.forEach((w) => L.push('Note: ' + w));
    return L.join('\n');
  }

  function sanitize(s) {
    return String(s)
      .replace(/₹/g, 'Rs.')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^ -~\u00a0-ÿ]/g, '?');
  }

  /** One-page PDF summary for stakeholders. */
  async function buildPdf(PDFLib, name, a, b, r, notes) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.setTitle(sanitize('A/B test: ' + (norm(name) || 'result')));
    pdf.setCreator('Marketing Pocket Tools');
    const W = 595.28;
    const H = 841.89;
    const M = 48;
    const page = pdf.addPage([W, H]);
    let y = H - M;
    const ink = rgb(0.1, 0.1, 0.12);
    const grey = rgb(0.45, 0.47, 0.52);
    const line = (s, size, f, color, x) => {
      page.drawText(sanitize(s), { x: x === undefined ? M : x, y: y, size: size, font: f || font, color: color || ink });
      y -= size + 6;
    };
    const wrap = (s, size, f, width) => {
      const out = [];
      let cur = '';
      sanitize(s)
        .split(/\s+/)
        .forEach((w) => {
          const t = cur ? cur + ' ' + w : w;
          if ((f || font).widthOfTextAtSize(t, size) <= width) cur = t;
          else {
            out.push(cur);
            cur = w;
          }
        });
      if (cur) out.push(cur);
      return out;
    };
    line('A/B test result', 11, font, grey);
    line(norm(name) || 'Untitled test', 20, bold);
    y -= 6;
    const col = r.significant ? rgb(0.09, 0.45, 0.25) : rgb(0.6, 0.38, 0);
    page.drawRectangle({ x: M, y: y - 14, width: W - 2 * M, height: 34, color: r.significant ? rgb(0.9, 0.97, 0.92) : rgb(1, 0.96, 0.86) });
    page.drawText(sanitize(r.verdict), { x: M + 10, y: y - 2, size: 12, font: bold, color: col });
    y -= 46;
    const rows = [
      ['', 'Visitors', 'Conversions', 'Rate'],
      ['A', String(a.visitors), String(a.conversions), pct(r.rateA)],
      ['B', String(b.visitors), String(b.conversions), pct(r.rateB)],
    ];
    rows.forEach((row, i) => {
      [0, 1, 2, 3].forEach((c) =>
        page.drawText(sanitize(row[c]), {
          x: M + [0, 60, 170, 290][c],
          y: y,
          size: 11,
          font: i === 0 ? bold : font,
          color: i === 0 ? grey : ink,
        }),
      );
      y -= 20;
    });
    y -= 8;
    [
      [
        'Difference',
        (r.diff >= 0 ? '+' : '') +
          pct(r.diff) +
          ' points' +
          (r.relLift === null ? '' : ', ' + (r.relLift >= 0 ? '+' : '') + pct(r.relLift, 1) + ' relative'),
      ],
      [Math.round(r.confidence * 100) + '% range', pct(r.ciLow) + ' to ' + pct(r.ciHigh) + ' points'],
      ['p-value', r.pValue < 0.0001 ? 'below 0.0001' : r.pValue.toFixed(4)],
    ].forEach((kv) => {
      page.drawText(sanitize(kv[0]), { x: M, y: y, size: 11, font: bold, color: grey });
      page.drawText(sanitize(kv[1]), { x: M + 110, y: y, size: 11, font: font, color: ink });
      y -= 20;
    });
    if (r.warnings.length) {
      y -= 8;
      line('Cautions', 12, bold);
      r.warnings.forEach((w) => wrap('- ' + w, 10, font, W - 2 * M).forEach((l) => line(l, 10, font)));
    }
    if (norm(notes)) {
      y -= 8;
      line('Notes', 12, bold);
      wrap(norm(notes), 10, font, W - 2 * M).forEach((l) => line(l, 10, font));
    }
    y = M + 24;
    wrap(
      'Two-proportion z-test (two-sided). It assumes visitors were split randomly and the result was read once at the planned sample size; looking early and stopping when it looks good inflates false positives.',
      8,
      font,
      W - 2 * M,
    ).forEach((l) => {
      page.drawText(l, { x: M, y: y, size: 8, font: font, color: grey });
      y -= 11;
    });
    return pdf.save();
  }

  function serialize(s) {
    return JSON.stringify({ app: 'ab-test', version: 1, test: s }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved A/B test.');
    }
    const t = j && j.app === 'ab-test' ? j.test : null;
    if (!t || typeof t !== 'object') throw new Error('That file is not a saved A/B test.');
    const num = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e9 ? v : null);
    return {
      name: norm(t.name).slice(0, 120),
      notes: norm(t.notes).slice(0, 500),
      a: { visitors: num(t.a && t.a.visitors), conversions: num(t.a && t.a.conversions) },
      b: { visitors: num(t.b && t.b.visitors), conversions: num(t.b && t.b.conversions) },
      confidence: CONFIDENCE.indexOf(t.confidence) !== -1 ? t.confidence : 0.95,
    };
  }

  function sample() {
    return {
      name: 'Diwali landing page - new headline',
      notes: 'Ran 14 days, traffic split 50/50 from paid social.',
      a: { visitors: 5000, conversions: 250 },
      b: { visitors: 5000, conversions: 300 },
      confidence: 0.95,
    };
  }

  return {
    CONFIDENCE: CONFIDENCE,
    cdf: cdf,
    inv: inv,
    check: check,
    compare: compare,
    sampleSize: sampleSize,
    duration: duration,
    toText: toText,
    sanitize: sanitize,
    buildPdf: buildPdf,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
