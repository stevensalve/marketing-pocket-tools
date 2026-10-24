'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../js/core.js');

const TODAY = '2026-10-23';

test('hashtags: unique, unicode, ignores urls and mid-word #', () => {
  assert.deepEqual(p.hashtags('Hello #Diwali and #diwali (#Sale) #दिवाली a#b example.com/#top'), ['Diwali', 'Sale', 'दिवाली']);
  assert.deepEqual(p.hashtags(''), []);
});

test('counter: limits, hashtags, mentions, leading hashtag', () => {
  const c = p.counter('X', 'x'.repeat(285));
  assert.deepEqual([c.length, c.limit, c.left], [285, 280, -5]);
  assert.match(c.warnings[0], /X allows 280 characters; this is 5 over/);
  assert.ok(
    p.counter('Instagram', Array.from({ length: 31 }, (_, i) => '#t' + i).join(' ')).warnings.some((w) => /at most 30 hashtags/.test(w)),
  );
  assert.ok(p.counter('X', 'Hi #a #b #c').warnings.some((w) => /two hashtags/.test(w)));
  assert.ok(p.counter('LinkedIn', '#hiring we are').warnings.some((w) => /starts with a hashtag/.test(w)));
  assert.equal(p.counter('Other', 'anything').left, null);
  assert.equal(p.counter('Instagram', 'Hi @asha and @ravi.k').mentions, 2);
  assert.equal(p.counter('Instagram', 'नमस्ते 😀').length, 8);
});

test('add validates, update and remove', () => {
  const s0 = p.create();
  const s1 = p.add(s0, { date: '2026-10-25', channel: 'X', caption: ' Hi ', time: '09:05' });
  assert.equal(s0.posts.length, 0);
  assert.deepEqual(s1.posts[0], {
    id: 1,
    date: '2026-10-25',
    time: '09:05',
    channel: 'X',
    caption: 'Hi',
    status: 'Idea',
    owner: '',
    link: '',
    note: '',
  });
  assert.throws(() => p.add(s0, { date: '2026-10-25', caption: '  ' }), /Write the caption/);
  assert.throws(() => p.add(s0, { date: '2026-02-30', caption: 'x' }), /not a real date/);
  assert.throws(() => p.add(s0, { date: '2026-10-25', caption: 'x', time: '9am' }), /look like 18:30/);
  assert.equal(p.add(s0, { date: '2026-10-25', caption: 'x', channel: 'Pigeon', status: 'Weird' }).posts[0].channel, 'Instagram');
  const s2 = p.update(s1, 1, { status: 'Scheduled', caption: 'Updated' });
  assert.deepEqual([s2.posts[0].status, s2.posts[0].caption], ['Scheduled', 'Updated']);
  assert.throws(() => p.update(s1, 9, {}), /not found/);
  assert.equal(p.remove(s2, 1).posts.length, 0);
});

test('list: order, filters, overdue', () => {
  const s = p.sample(TODAY);
  const all = p.list(s, TODAY);
  assert.deepEqual(
    all.map((x) => x.date),
    ['2026-10-17', '2026-10-21', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-28', '2026-10-31'],
  );
  assert.deepEqual(
    p.list(s, TODAY, { overdue: true }).map((x) => x.id),
    [1],
  );
  assert.equal(p.list(s, TODAY, { channel: 'Instagram' }).length, 3);
  assert.equal(p.list(s, TODAY, { status: 'Scheduled' }).length, 2);
  assert.equal(p.list(s, TODAY, { from: '2026-10-23', to: '2026-10-25' }).length, 3);
  assert.equal(p.list(s, TODAY, { search: 'GIFT' }).length, 4);
});

test('month grid starts on Monday and pads weeks', () => {
  const w = p.month(p.sample(TODAY), '2026-10');
  assert.equal(w.length, 5);
  assert.equal(w[0][0].date, '2026-09-28');
  assert.equal(w[0][0].inMonth, false);
  assert.equal(w[4][6].date, '2026-11-01');
  const day = w.flat().find((d) => d.date === '2026-10-23');
  assert.equal(day.posts.length, 1);
  assert.throws(() => p.month(p.create(), '2026-13'), /look like 2026-10/);
  assert.equal(p.month(p.create(), '2027-02').length, 4);
});

test('summary', () => {
  const r = p.summary(p.sample(TODAY), TODAY, 14);
  assert.equal(r.total, 7);
  assert.deepEqual(r.byStatus, { Idea: 3, Drafted: 1, Scheduled: 2, Posted: 1 });
  assert.equal(r.byChannel.Instagram, 3);
  assert.equal(r.overdue, 1);
  assert.equal(r.gaps.length, 14 - 5);
  assert.ok(r.gaps.includes('2026-10-26'));
  assert.equal(r.overLimit, 0);
  const over = p.add(p.create(), { date: TODAY, channel: 'X', caption: 'x'.repeat(300) });
  assert.equal(p.summary(over, TODAY).overLimit, 1);
});

test('toCsv', () => {
  const c = p.toCsv(p.sample(TODAY), TODAY);
  assert.ok(c.startsWith('\ufeffDate,Time,Channel,Status,Owner,Caption,Characters,Hashtags,Link,Note,Overdue\r\n'));
  assert.match(c, /17\/10\/2026,10:00,LinkedIn,Posted,Ravi,/);
  assert.match(c, /21\/10\/2026,18:00,Instagram,Drafted,Asha,.*,Diwali FestiveSeason Lights,,,yes\r\n/s);
});

test('toIcs: skips posted, timed and all-day events', () => {
  const ics = p.toIcs(p.sample(TODAY), '20261023T000000Z');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.match(ics, /DTSTART:20261023T173000\r\nDTEND:20261023T174500/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026/);
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /SUMMARY:Post on X: Diwali sale starts tomorrow/);
  ics.split('\r\n').forEach((l) => assert.ok(new TextEncoder().encode(l).length <= 75));
  assert.throws(() => p.toIcs(p.create(), 'x'), /timestamp/);
});

test('save and open', () => {
  const s = p.sample(TODAY);
  assert.deepEqual(p.parse(p.serialize(s)), s);
  const bad = JSON.parse(p.serialize(s));
  bad.state.posts.push({ id: 1, date: TODAY, caption: 'dup id', status: 'Bogus' }, { date: 'x', caption: 'bad date' }, null);
  const r = p.parse(JSON.stringify(bad));
  assert.equal(r.posts.length, 8);
  assert.equal(new Set(r.posts.map((x) => x.id)).size, 8);
  assert.equal(r.posts.find((x) => x.caption === 'dup id').status, 'Idea');
  assert.throws(() => p.parse('x'), /not a saved post plan/);
  assert.throws(() => p.parse('{"app":"q"}'), /not a saved post plan/);
});
