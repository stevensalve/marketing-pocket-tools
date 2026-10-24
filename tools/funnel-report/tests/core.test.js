'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../js/core.js');

const S = f.DEFAULT_STAGES;

test('parseStages', () => {
  assert.deepEqual(f.parseStages('Lead, MQL > SQL\nWon'), ['Lead', 'MQL', 'SQL', 'Won']);
  assert.throws(() => f.parseStages('Lead'), /at least two/);
  assert.throws(() => f.parseStages('a,b,a'), /listed twice/);
  assert.throws(() => f.parseStages('1,2,3,4,5,6,7,8,9,10,11'), /ten stages or fewer/);
});

test('rowsToLeads: flexible headers, lost, problems', () => {
  const r = f.rowsToLeads(
    [
      { Source: 'Google', Status: 'won', Amount: 'Rs. 50,000' },
      { 'Lead Source': 'Meta', 'Funnel Stage': 'Qualified' },
      { Channel: 'Meta', Stage: 'Lost' },
      { Channel: 'X', Stage: 'Mystery' },
      { Channel: 'Y', Stage: 'Won', Value: 'abc' },
      {},
      { Stage: 'Lead' },
    ],
    S,
  );
  assert.deepEqual(r.leads, [
    { channel: 'Google', stage: 3, value: 50000 },
    { channel: 'Meta', stage: 1, value: 0 },
    { channel: 'Meta', stage: 0, value: 0 },
    { channel: 'Y', stage: 3, value: 0 },
    { channel: '(none)', stage: 0, value: 0 },
  ]);
  assert.equal(r.lost, 1);
  assert.deepEqual(r.problems, [
    'Row 5: the stage "Mystery" is not one of your stages.',
    'Row 6: the value is not a number; it was treated as 0.',
  ]);
});

test('funnel: steps, leak and validation', () => {
  const r = f.funnel(S, [1000, 400, 100, 40]);
  assert.deepEqual(
    r.steps.map((s) => s.fromPrev),
    [null, 0.4, 0.25, 0.4],
  );
  assert.deepEqual(
    r.steps.map((s) => s.lost),
    [0, 600, 300, 60],
  );
  assert.equal(r.steps[3].fromTop, 0.04);
  assert.deepEqual(r.biggestLeak, { from: 'Qualified', to: 'Proposal', keep: 0.25 });
  assert.throws(() => f.funnel(S, [10, 20, 5, 1]), /Qualified \(20\) is higher than Lead \(10\)/);
  assert.throws(() => f.funnel(S, [10, 5]), /Each stage needs a count/);
  assert.throws(() => f.funnel(S, [10, 5.5, 1, 0]), /whole number/);
  assert.equal(f.funnel(S, [0, 0, 0, 0]).biggestLeak, null);
});

test('parseCounts', () => {
  assert.deepEqual(f.parseCounts('# c\nLead: 1,200\nQualified | 400\nWon 40'), {
    stages: ['Lead', 'Qualified', 'Won'],
    counts: [1200, 400, 40],
  });
  assert.throws(() => f.parseCounts('Lead\nWon 4'), /Line 1 should look like/);
  assert.throws(() => f.parseCounts('Lead 5'), /at least two/);
});

test('report on sample', () => {
  const r = f.rowsToLeads(f.sampleRows(), S);
  assert.deepEqual([r.leads.length, r.problems.length], [417, 0]);
  const rep = f.report(r.leads, S);
  assert.deepEqual(
    rep.funnel.steps.map((s) => s.count),
    [417, 209, 100, 43],
  );
  assert.equal(rep.revenue, 4115000);
  assert.deepEqual(rep.funnel.biggestLeak, { from: 'Proposal', to: 'Won', keep: 0.43 });
  assert.deepEqual(
    rep.channels.map((c) => c.channel),
    ['Referral', 'Google Ads', 'Webinar', 'Organic search', 'Meta Ads'],
  );
  assert.equal(rep.channels[0].rate, 0.36);
  assert.equal(rep.channels[0].avgValue, 120000);
  assert.equal(rep.bestChannel, 'Referral');
  assert.equal(rep.weakestChannel, 'Meta Ads');
  assert.equal(rep.smallChannels, 1);
  assert.throws(() => f.report([], S), /no leads/);
});

test('toCsv and toText', () => {
  const rep = f.report(f.rowsToLeads(f.sampleRows(), S).leads, S);
  const c = f.toCsv(rep);
  assert.ok(c.startsWith('﻿Stage,Count,Kept from previous'));
  assert.match(c, /\r\nQualified,209,50\.1%,50\.1%,208\r\n/);
  assert.match(
    c,
    /\r\n\r\nChannel,Leads,Share of leads,Qualified,Proposal,Won,Conversion to Won,Revenue,Average value\r\nReferral,50,12\.0%,40,30,18,36\.0%,2160000,120000/,
  );
  const t = f.toText(rep);
  assert.match(t, /^FUNNEL: 417 leads, 43 Won \(10\.3%\)\n- Lead: 417\n- Qualified: 209 \(50\.1% of Lead\)/);
  assert.match(t, /Biggest leak: Proposal to Won keeps only 43\.0%\./);
  assert.match(t, /Best channel: Referral\. Weakest: Meta Ads\./);
});
