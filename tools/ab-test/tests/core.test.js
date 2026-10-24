'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../js/core.js');

const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);

test('cdf and inv agree with known values', () => {
  near(t.cdf(0), 0.5, 1e-7);
  near(t.cdf(1.96), 0.9750021, 2e-7);
  near(t.cdf(-1.96), 0.0249979, 2e-7);
  near(t.inv(0.975), 1.959964, 1e-5);
  near(t.inv(0.8), 0.841621, 1e-5);
  near(t.inv(0.005), -2.575829, 1e-5);
  near(t.inv(0.9995), 3.290527, 1e-5);
  assert.throws(() => t.inv(0), /between 0 and 1/);
  assert.throws(() => t.inv(1), /between 0 and 1/);
});

test('check: validation messages', () => {
  assert.deepEqual(t.check({ visitors: 10, conversions: 1 }, { visitors: 10, conversions: 2 }), []);
  assert.match(t.check({ visitors: 0, conversions: 0 }, { visitors: 10, conversions: 1 })[0], /Version A: visitors/);
  assert.match(t.check({ visitors: 10, conversions: 11 }, { visitors: 10, conversions: 1 })[0], /cannot be more than visitors/);
  assert.match(t.check({ visitors: 10, conversions: 1.5 }, { visitors: 10, conversions: 1 })[0], /whole number/);
  assert.match(t.check(null, { visitors: 10, conversions: 1 })[0], /Version A/);
});

test('compare: sample is significant at 95%', () => {
  const s = t.sample();
  const r = t.compare(s.a, s.b);
  near(r.rateA, 0.05, 1e-12);
  near(r.rateB, 0.06, 1e-12);
  near(r.z, 2.1927, 1e-3);
  near(r.pValue, 0.0283, 5e-4);
  near(r.relLift, 0.2, 1e-9);
  assert.ok(r.significant);
  assert.match(r.verdict, /^B is better than A at 95% confidence/);
  near(r.ciLow, 0.0011, 3e-4);
  near(r.ciHigh, 0.0189, 3e-4);
  assert.equal(r.warnings.length, 0);
});

test('compare: not significant, worse, 99%, edge cases', () => {
  const ns = t.compare({ visitors: 1000, conversions: 100 }, { visitors: 1000, conversions: 110 });
  assert.equal(ns.significant, false);
  assert.match(ns.verdict, /No clear winner/);
  const worse = t.compare({ visitors: 5000, conversions: 300 }, { visitors: 5000, conversions: 250 });
  assert.match(worse.verdict, /^A is better than B/);
  assert.equal(t.compare(t.sample().a, t.sample().b, 0.99).significant, false);
  const zero = t.compare({ visitors: 100, conversions: 0 }, { visitors: 100, conversions: 0 });
  assert.deepEqual([zero.pValue, zero.z, zero.relLift], [1, 0, null]);
  assert.ok(zero.warnings.length === 2);
  assert.ok(t.compare({ visitors: 1000, conversions: 50 }, { visitors: 1000, conversions: 60 }).warnings.every((w) => /under 100/.test(w)));
  assert.throws(() => t.compare(t.sample().a, t.sample().b, 0.97), /Confidence must be/);
  assert.throws(() => t.compare({ visitors: 5, conversions: 9 }, t.sample().b), /cannot be more/);
});

test('sampleSize: matches standard calculators', () => {
  const r = t.sampleSize({ baseline: 0.05, mde: 0.2 });
  assert.ok(Math.abs(r.perVersion - 8158) <= 2, String(r.perVersion));
  near(r.target, 0.06, 1e-12);
  assert.equal(r.total, r.perVersion * 2);
  const abs = t.sampleSize({ baseline: 0.05, mde: 0.01, absolute: true });
  assert.equal(abs.perVersion, r.perVersion);
  assert.ok(t.sampleSize({ baseline: 0.05, mde: 0.2, confidence: 0.99, power: 0.9 }).perVersion > r.perVersion);
  assert.throws(() => t.sampleSize({ baseline: 0, mde: 0.2 }), /between 0% and 100%/);
  assert.throws(() => t.sampleSize({ baseline: 0.5, mde: 0 }), /above zero/);
  assert.throws(() => t.sampleSize({ baseline: 0.9, mde: 0.2 }), /outside 0% to 100%/);
  assert.throws(() => t.sampleSize({ baseline: 0.1, mde: 0.2, power: 0.5 }), /Power/);
});

test('duration', () => {
  assert.deepEqual(t.duration(8158, 1200), { days: 14, weeks: 2 });
  assert.deepEqual(t.duration(1000, 100, 3), { days: 30, weeks: 5 });
  assert.throws(() => t.duration(100, 0), /above zero/);
});

test('toText', () => {
  const s = t.sample();
  const x = t.toText(s.name, s.a, s.b, t.compare(s.a, s.b));
  assert.match(
    x,
    /^Diwali landing page - new headline - result\nA: 250 of 5000 converted \(5\.00%\)\nB: 300 of 5000 converted \(6\.00%\)\nDifference: \+1\.00% points \(\+20\.0% relative\)/,
  );
  assert.match(x, /95% range for the difference: 0\.\d\d% to 1\.\d\d%\np-value: 0\.028\d\nVerdict: B is better/);
});

test('save and open repair bad data', () => {
  const s = t.sample();
  assert.deepEqual(t.parse(t.serialize(s)), s);
  const bad = JSON.parse(t.serialize(s));
  bad.test.confidence = 0.5;
  bad.test.a.visitors = -4;
  bad.test.b.conversions = 'x';
  const f = t.parse(JSON.stringify(bad));
  assert.deepEqual([f.confidence, f.a.visitors, f.b.conversions], [0.95, null, null]);
  assert.throws(() => t.parse('x'), /not a saved A\/B test/);
  assert.throws(() => t.parse('{"app":"z"}'), /not a saved A\/B test/);
});

test('buildPdf: one valid page', async () => {
  const PDFLib = require('../vendor/pdf-lib.min.js');
  const s = t.sample();
  const bytes = await t.buildPdf(PDFLib, s.name + ' ₹ —', s.a, s.b, t.compare(s.a, s.b), s.notes);
  assert.equal(Buffer.from(bytes).slice(0, 5).toString(), '%PDF-');
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 1);
});
