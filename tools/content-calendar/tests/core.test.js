'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

const TODAY = '2026-10-23';
const base = { title: 'Post', publishOn: '2026-11-01' };

test('add validates and does not mutate', () => {
  const s0 = c.create();
  const s1 = c.add(s0, Object.assign({}, base, { draftDue: '2026-10-28', owner: ' Asha ', type: 'Video' }));
  assert.equal(s0.items.length, 0);
  assert.deepEqual(s1.items[0], {
    id: 1,
    title: 'Post',
    type: 'Video',
    pillar: '',
    funnel: 'Awareness',
    owner: 'Asha',
    draftDue: '2026-10-28',
    publishOn: '2026-11-01',
    status: 'Idea',
    note: '',
  });
  assert.throws(() => c.add(s0, { publishOn: '2026-11-01' }), /title/);
  assert.throws(() => c.add(s0, { title: 'x', publishOn: '2026-02-30' }), /publish date/);
  assert.throws(() => c.add(s0, Object.assign({}, base, { draftDue: 'x' })), /draft due date/);
  assert.throws(() => c.add(s0, Object.assign({}, base, { draftDue: '2026-11-05' })), /after the publish date/);
  assert.equal(c.add(s0, Object.assign({}, base, { type: 'Pigeon', status: 'Weird', funnel: 'Zzz' })).items[0].type, 'Blog');
});

test('update and remove', () => {
  let s = c.add(c.create(), base);
  s = c.update(s, 1, { status: 'Drafting', title: 'New title' });
  assert.deepEqual([s.items[0].status, s.items[0].title], ['Drafting', 'New title']);
  assert.throws(() => c.update(s, 1, { draftDue: '2027-01-01' }), /after the publish date/);
  assert.throws(() => c.update(s, 5, {}), /not found/);
  assert.equal(c.remove(s, 1).items.length, 0);
});

test('stateOf', () => {
  const it = (o) => Object.assign({ status: 'Drafting', draftDue: '', publishOn: '2026-11-10' }, o);
  assert.equal(c.stateOf(it({ status: 'Published', publishOn: '2026-01-01' }), TODAY), 'published');
  assert.equal(c.stateOf(it({ publishOn: '2026-10-22' }), TODAY), 'late');
  assert.equal(c.stateOf(it({ publishOn: TODAY }), TODAY), 'at-risk');
  assert.equal(c.stateOf(it({ draftDue: '2026-10-22', publishOn: '2026-11-10' }), TODAY), 'draft-late');
  assert.equal(c.stateOf(it({ draftDue: '2026-10-22', status: 'In review' }), TODAY), 'on-track');
  assert.equal(c.stateOf(it({ publishOn: '2026-10-26' }), TODAY), 'at-risk');
  assert.equal(c.stateOf(it({ publishOn: '2026-10-27' }), TODAY), 'on-track');
  assert.equal(c.stateOf(it({ status: 'Approved', publishOn: '2026-10-24' }), TODAY), 'on-track');
});

test('list and board', () => {
  const s = c.sample(TODAY);
  const all = c.list(s, TODAY);
  assert.equal(all.length, 8);
  assert.deepEqual(
    all.map((i) => i.publishOn),
    all
      .map((i) => i.publishOn)
      .slice()
      .sort(),
  );
  assert.deepEqual(
    c.list(s, TODAY, { problems: true }).map((i) => [i.title.slice(0, 12), i.state]),
    [
      ['Press note: ', 'late'],
      ['Diwali gift ', 'draft-late'],
      ['Behind the s', 'at-risk'],
    ],
  );
  assert.equal(c.list(s, TODAY, { owner: 'Ravi' }).length, 3);
  assert.equal(c.list(s, TODAY, { type: 'Email' }).length, 2);
  assert.equal(c.list(s, TODAY, { search: 'GIFT' }).length, 5);
  assert.equal(c.list(s, TODAY, { from: '2026-10-23', to: '2026-10-31' }).length, 3);
  const b = c.board(s, TODAY);
  assert.deepEqual(
    b.map((x) => x.items.length),
    [3, 1, 1, 1, 1, 1],
  );
});

test('mix and notes', () => {
  const s = c.sample(TODAY);
  const m = c.mix(s);
  assert.equal(m.total, 8);
  assert.deepEqual(
    m.byFunnel.map((x) => [x.key, x.count]),
    [
      ['Awareness', 4],
      ['Consideration', 2],
      ['Decision', 1],
      ['Retention', 1],
    ],
  );
  assert.equal(m.byType[0].key, 'Blog');
  assert.equal(m.byPillar[0].key, 'Gifting');
  assert.deepEqual(m.notes, []);
  let lopsided = c.create();
  for (let i = 0; i < 8; i++) lopsided = c.add(lopsided, { title: 't' + i, publishOn: '2026-11-0' + (i + 1), owner: 'Asha' });
  const n = c.mix(lopsided).notes;
  assert.ok(n.some((x) => /More than 60% of the content is Awareness/.test(x)));
  assert.ok(n.some((x) => /Nothing planned for the Retention stage/.test(x)));
  assert.equal(c.mix(lopsided, '2026-11-03', '2026-11-04').total, 2);
});

test('emptyWeeks', () => {
  const s = c.sample(TODAY);
  assert.deepEqual(c.emptyWeeks(s, TODAY, 4), []);
  assert.deepEqual(c.emptyWeeks(c.create(), TODAY, 2), ['2026-10-19', '2026-10-26']);
  assert.deepEqual(c.emptyWeeks(c.add(c.create(), { title: 'x', publishOn: '2026-10-27' }), TODAY, 2), ['2026-10-19']);
});

test('summary', () => {
  const r = c.summary(c.sample(TODAY), TODAY);
  assert.deepEqual(r, { total: 8, published: 1, late: 1, 'draft-late': 1, 'at-risk': 1, 'on-track': 4 });
});

test('toCsv and toIcs', () => {
  const s = c.sample(TODAY);
  const csv = c.toCsv(s, TODAY);
  assert.ok(csv.startsWith('\ufeffPublish date,Title,Type'));
  assert.match(csv, /Late/);
  const ics = c.toIcs(s, '20261023T000000Z');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 7 + 5);
  assert.match(ics, /SUMMARY:Draft due: Behind the scenes: packing a gift box/);
  assert.doesNotMatch(ics, /SUMMARY:Draft due: Diwali sale announcement/);
  assert.doesNotMatch(ics, /How to choose a festive gift/);
  ics.split('\r\n').forEach((l) => assert.ok(new TextEncoder().encode(l).length <= 75));
  assert.throws(() => c.toIcs(s, 'x'), /timestamp/);
});

test('save and open', () => {
  const s = c.sample(TODAY);
  assert.deepEqual(c.parse(c.serialize(s)), s);
  const bad = JSON.parse(c.serialize(s));
  bad.state.items.push({ id: 1, title: 'dup', publishOn: '2026-12-01', status: 'Bogus' }, { title: '', publishOn: '2026-12-01' }, null);
  const r = c.parse(JSON.stringify(bad));
  assert.equal(r.items.length, 9);
  assert.equal(new Set(r.items.map((i) => i.id)).size, 9);
  assert.throws(() => c.parse('x'), /not a saved content calendar/);
  assert.throws(() => c.parse('{"app":"z"}'), /not a saved content calendar/);
});
