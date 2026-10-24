/**
 * CAC & LTV Calculator - core logic (pure).
 *
 * Inputs: { model: 'subscription' | 'repeat', adSpend, otherSpend, newCustomers, paidCustomers|null,
 *           margin (0-1), arpa, churn (monthly, 0-1)            // subscription
 *           aov, ordersPerYear, lifespanYears }                 // repeat purchase
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.CacCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const MODELS = ['subscription', 'repeat'];
  const r2 = (x) => Math.round(x * 100) / 100;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  function validate(i) {
    const e = [];
    if (MODELS.indexOf(i.model) === -1) e.push('Choose subscription or repeat purchase.');
    if (!isNum(i.adSpend) || i.adSpend < 0) e.push('Ad spend must be zero or more.');
    if (!isNum(i.otherSpend) || i.otherSpend < 0) e.push('Other marketing cost must be zero or more.');
    if (!Number.isInteger(i.newCustomers) || i.newCustomers < 1) e.push('New customers must be a whole number above zero.');
    if (
      i.paidCustomers !== null &&
      i.paidCustomers !== undefined &&
      (!Number.isInteger(i.paidCustomers) || i.paidCustomers < 1 || i.paidCustomers > i.newCustomers)
    )
      e.push('Customers from paid channels must be a whole number from 1 up to the new customers.');
    if (!isNum(i.margin) || !(i.margin > 0 && i.margin <= 1)) e.push('Gross margin must be between 0% and 100%.');
    if (i.model === 'subscription') {
      if (!isNum(i.arpa) || !(i.arpa > 0)) e.push('Monthly revenue per customer must be above zero.');
      if (!isNum(i.churn) || !(i.churn > 0 && i.churn < 1)) e.push('Monthly churn must be above 0% and below 100%.');
    } else if (i.model === 'repeat') {
      if (!isNum(i.aov) || !(i.aov > 0)) e.push('Average order value must be above zero.');
      if (!isNum(i.ordersPerYear) || !(i.ordersPerYear > 0)) e.push('Orders per year must be above zero.');
      if (!isNum(i.lifespanYears) || !(i.lifespanYears > 0 && i.lifespanYears <= 50))
        e.push('Customer lifespan must be above zero and at most 50 years.');
    }
    if (isNum(i.adSpend) && isNum(i.otherSpend) && i.adSpend + i.otherSpend === 0) e.push('Enter some spend.');
    return e;
  }

  const verdictFor = (ratio) =>
    ratio < 1
      ? 'Losing money on every customer'
      : ratio < 3
        ? 'Thin: below the usual 3x target'
        : ratio <= 5
          ? 'Healthy'
          : 'Very strong: you may be under-investing in growth';

  /** Core calculation. Throws the first problem found. */
  function compute(i) {
    const p = validate(i);
    if (p.length) throw new Error(p[0]);
    const total = i.adSpend + i.otherSpend;
    const blended = total / i.newCustomers;
    const paid = i.paidCustomers ? i.adSpend / i.paidCustomers : null;
    let monthlyProfit;
    let lifetimeMonths;
    let ltv;
    if (i.model === 'subscription') {
      monthlyProfit = i.arpa * i.margin;
      lifetimeMonths = 1 / i.churn;
      ltv = monthlyProfit * lifetimeMonths;
    } else {
      monthlyProfit = (i.aov * i.ordersPerYear * i.margin) / 12;
      lifetimeMonths = i.lifespanYears * 12;
      ltv = monthlyProfit * lifetimeMonths;
    }
    const ratio = ltv / blended;
    const payback = blended / monthlyProfit;
    const warnings = [];
    if (i.model === 'subscription' && lifetimeMonths > 60)
      warnings.push('A churn this low means a customer lifetime over 5 years: treat the LTV as optimistic.');
    if (i.model === 'repeat' && i.lifespanYears > 5)
      warnings.push('Lifespans over 5 years are rarely supported by data: treat the LTV as optimistic.');
    if (payback > 12) warnings.push('Payback takes more than 12 months: check you can fund that wait.');
    if (i.paidCustomers && paid !== null && paid > blended * 2)
      warnings.push('Paid CAC is more than double the blended CAC: organic customers are hiding the real cost of paid growth.');
    return {
      totalSpend: total,
      blendedCac: r2(blended),
      paidCac: paid === null ? null : r2(paid),
      monthlyProfit: r2(monthlyProfit),
      lifetimeMonths: r2(lifetimeMonths),
      ltv: r2(ltv),
      ratio: r2(ratio),
      paybackMonths: r2(payback),
      verdict: verdictFor(ratio),
      warnings: warnings,
    };
  }

  /** LTV:CAC for CAC x cost multipliers against retention multipliers (churn goes down / lifespan goes up when the multiplier is above 1). */
  function sensitivity(i) {
    compute(i);
    const cost = [0.8, 0.9, 1, 1.1, 1.2];
    const keep = [0.8, 1, 1.2];
    return {
      cost: cost,
      keep: keep,
      grid: keep.map((k) =>
        cost.map((c) => {
          const j = Object.assign({}, i, { adSpend: i.adSpend * c, otherSpend: i.otherSpend * c });
          if (i.model === 'subscription') j.churn = Math.min(0.999, i.churn / k);
          else j.lifespanYears = i.lifespanYears * k;
          return compute(j).ratio;
        }),
      ),
    };
  }

  const money = (x) => 'Rs. ' + OT.formatInr(x, x % 1 ? 2 : 0);

  function toText(i, r) {
    const L = ['CAC AND LTV'];
    L.push('Blended CAC ' + money(r.blendedCac) + (r.paidCac !== null ? ', paid CAC ' + money(r.paidCac) : ''));
    L.push('LTV ' + money(r.ltv) + ' (' + money(r.monthlyProfit) + ' gross profit a month for ' + r.lifetimeMonths + ' months)');
    L.push('LTV to CAC ' + r.ratio.toFixed(2) + 'x, payback ' + r.paybackMonths.toFixed(1) + ' months');
    L.push('Verdict: ' + r.verdict + '.');
    r.warnings.forEach((w) => L.push('Note: ' + w));
    return L.join('\n');
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };

  function toCsv(i, r) {
    const rows = [
      ['Item', 'Value'],
      ['Total marketing spend', r.totalSpend],
      ['New customers', i.newCustomers],
      ['Blended CAC', r.blendedCac],
      ['Paid CAC', r.paidCac === null ? '' : r.paidCac],
      ['Gross profit per customer per month', r.monthlyProfit],
      ['Customer lifetime (months)', r.lifetimeMonths],
      ['LTV', r.ltv],
      ['LTV to CAC', r.ratio],
      ['Payback (months)', r.paybackMonths],
      ['Verdict', r.verdict],
    ];
    return '\ufeff' + rows.map((x) => x.map(cell).join(',')).join('\r\n');
  }

  function serialize(i) {
    return JSON.stringify({ app: 'cac-ltv', version: 1, inputs: i }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved CAC and LTV calculation.');
    }
    const s = j && j.app === 'cac-ltv' ? j.inputs : null;
    if (!s || typeof s !== 'object') throw new Error('That file is not a saved CAC and LTV calculation.');
    const n = (v) => (isNum(v) ? v : null);
    return {
      model: MODELS.indexOf(s.model) !== -1 ? s.model : 'subscription',
      adSpend: n(s.adSpend),
      otherSpend: n(s.otherSpend),
      newCustomers: Number.isInteger(s.newCustomers) ? s.newCustomers : null,
      paidCustomers: Number.isInteger(s.paidCustomers) ? s.paidCustomers : null,
      margin: n(s.margin),
      arpa: n(s.arpa),
      churn: n(s.churn),
      aov: n(s.aov),
      ordersPerYear: n(s.ordersPerYear),
      lifespanYears: n(s.lifespanYears),
    };
  }

  function sample() {
    return {
      model: 'subscription',
      adSpend: 600000,
      otherSpend: 200000,
      newCustomers: 400,
      paidCustomers: 250,
      margin: 0.7,
      arpa: 999,
      churn: 0.08,
      aov: 1500,
      ordersPerYear: 3,
      lifespanYears: 2,
    };
  }

  return {
    MODELS: MODELS,
    validate: validate,
    compute: compute,
    sensitivity: sensitivity,
    toText: toText,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
