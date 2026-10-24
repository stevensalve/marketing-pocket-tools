'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

const S = c.sample();

test('validate lists plain problems', () => {
  assert.deepEqual(c.validate(S), []);
  assert.match(c.validate(Object.assign({}, S, { newCustomers: 0 }))[0], /New customers/);
  assert.match(c.validate(Object.assign({}, S, { paidCustomers: 999 }))[0], /paid channels/);
  assert.match(c.validate(Object.assign({}, S, { margin: 0 }))[0], /Gross margin/);
  assert.match(c.validate(Object.assign({}, S, { churn: 0 }))[0], /churn/);
  assert.match(c.validate(Object.assign({}, S, { churn: 1 }))[0], /churn/);
  assert.match(c.validate(Object.assign({}, S, { model: 'repeat', aov: 0 }))[0], /order value/);
  assert.match(c.validate(Object.assign({}, S, { model: 'repeat', lifespanYears: 99 }))[0], /lifespan/);
  assert.match(c.validate(Object.assign({}, S, { adSpend: 0, otherSpend: 0 }))[0], /some spend/);
  assert.match(c.validate(Object.assign({}, S, { model: 'x' }))[0], /subscription or repeat/);
  assert.match(c.validate(Object.assign({}, S, { adSpend: -1 }))[0], /Ad spend/);
});

test('compute: subscription sample', () => {
  const r = c.compute(S);
  assert.equal(r.totalSpend, 800000);
  assert.equal(r.blendedCac, 2000);
  assert.equal(r.paidCac, 2400);
  assert.equal(r.monthlyProfit, 699.3);
  assert.equal(r.lifetimeMonths, 12.5);
  assert.equal(r.ltv, 8741.25);
  assert.equal(r.ratio, 4.37);
  assert.equal(r.paybackMonths, 2.86);
  assert.equal(r.verdict, 'Healthy');
  assert.deepEqual(r.warnings, []);
});

test('compute: repeat purchase and verdict bands', () => {
  const r = c.compute(Object.assign({}, S, { model: 'repeat' }));
  assert.equal(r.monthlyProfit, 262.5);
  assert.equal(r.lifetimeMonths, 24);
  assert.equal(r.ltv, 6300);
  assert.equal(r.ratio, 3.15);
  assert.equal(c.compute(Object.assign({}, S, { adSpend: 6000000 })).verdict, 'Losing money on every customer');
  assert.match(c.compute(Object.assign({}, S, { adSpend: 1000000 })).verdict, /^Thin/);
  assert.match(c.compute(Object.assign({}, S, { adSpend: 100000, otherSpend: 0 })).verdict, /^Very strong/);
  assert.equal(c.compute(Object.assign({}, S, { paidCustomers: null })).paidCac, null);
});

test('compute: warnings', () => {
  const w = c.compute(Object.assign({}, S, { churn: 0.01, adSpend: 6000000 })).warnings;
  assert.ok(w.some((x) => /over 5 years/.test(x)) && w.some((x) => /more than 12 months/.test(x)));
  assert.ok(c.compute(Object.assign({}, S, { paidCustomers: 100 })).warnings.some((x) => /more than double/.test(x)));
  assert.ok(c.compute(Object.assign({}, S, { model: 'repeat', lifespanYears: 8 })).warnings.some((x) => /Lifespans over 5/.test(x)));
  assert.throws(() => c.compute(Object.assign({}, S, { margin: 2 })), /Gross margin/);
});

test('sensitivity grid', () => {
  const g = c.sensitivity(S);
  assert.equal(g.grid.length, 3);
  assert.equal(g.grid[0].length, 5);
  assert.equal(g.grid[1][2], 4.37);
  assert.ok(g.grid[2][0] > g.grid[1][2] && g.grid[0][4] < g.grid[1][2]);
  const rep = c.sensitivity(Object.assign({}, S, { model: 'repeat' }));
  assert.equal(rep.grid[1][2], 3.15);
  assert.ok(rep.grid[2][2] > 3.15);
});

test('toText and toCsv', () => {
  const r = c.compute(S);
  const t = c.toText(S, r);
  assert.match(
    t,
    /^CAC AND LTV\nBlended CAC Rs\. 2,000, paid CAC Rs\. 2,400\nLTV Rs\. 8,741\.25 \(Rs\. 699\.30 gross profit a month for 12\.5 months\)\nLTV to CAC 4\.37x, payback 2\.9 months\nVerdict: Healthy\./,
  );
  const csv = c.toCsv(S, r);
  assert.ok(csv.startsWith('﻿Item,Value\r\n'));
  assert.match(csv, /\r\nLTV to CAC,4\.37\r\n/);
  assert.match(csv, /Verdict,Healthy$/);
});

test('save and open', () => {
  assert.deepEqual(c.parse(c.serialize(S)), S);
  const bad = JSON.parse(c.serialize(S));
  bad.inputs.model = 'x';
  bad.inputs.adSpend = 'a';
  bad.inputs.newCustomers = 2.5;
  const p = c.parse(JSON.stringify(bad));
  assert.deepEqual([p.model, p.adSpend, p.newCustomers], ['subscription', null, null]);
  assert.throws(() => c.parse('x'), /not a saved CAC/);
  assert.throws(() => c.parse('{"app":"a"}'), /not a saved CAC/);
});
