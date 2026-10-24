/**
 * Social Post Planner - core logic (pure).
 *
 * Post: { id, date 'YYYY-MM-DD', time ''|'HH:MM', channel, caption, status, owner, link, note }
 * "Today" is always passed in.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.PostCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  // limit = characters in one post; maxTags = most hashtags the platform accepts (null = no fixed limit).
  // Common published figures; platforms change them, so the tool tells people to check.
  const CHANNELS = {
    Instagram: { limit: 2200, maxTags: 30 },
    Facebook: { limit: 63206, maxTags: null },
    LinkedIn: { limit: 3000, maxTags: null },
    X: { limit: 280, maxTags: null },
    YouTube: { limit: 5000, maxTags: 15 },
    WhatsApp: { limit: 1024, maxTags: null },
    Other: { limit: null, maxTags: null },
  };
  const STATUSES = ['Idea', 'Drafted', 'Scheduled', 'Posted'];
  const norm = (s) => String(s === null || s === undefined ? '' : s).trim();
  const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  const create = () => ({ nextId: 1, posts: [] });
  const copy = (s) => JSON.parse(JSON.stringify(s));

  /** Hashtags in a caption, without the # and de-duplicated ignoring case. */
  function hashtags(text) {
    const seen = {};
    const out = [];
    (String(text || '').match(/(?:^|[\s(])#([\p{L}\p{M}\p{N}_]+)/gu) || []).forEach((m) => {
      const tag = m.replace(/^[\s(]*#/, '');
      if (!seen[tag.toLowerCase()]) {
        seen[tag.toLowerCase()] = true;
        out.push(tag);
      }
    });
    return out;
  }

  /** Length and checks for one caption on one channel. */
  function counter(channel, caption) {
    const c = CHANNELS[channel] || CHANNELS.Other;
    const text = String(caption || '');
    const length = Array.from(text).length;
    const tags = hashtags(text);
    const warnings = [];
    if (c.limit && length > c.limit)
      warnings.push(channel + ' allows ' + c.limit + ' characters; this is ' + (length - c.limit) + ' over.');
    if (c.maxTags && tags.length > c.maxTags)
      warnings.push(channel + ' accepts at most ' + c.maxTags + ' hashtags; this has ' + tags.length + '.');
    if (channel === 'X' && tags.length > 2) warnings.push('More than two hashtags on X usually reduces engagement.');
    const first = text.trim().split(/\s+/)[0] || '';
    if (/^#/.test(first)) warnings.push('The caption starts with a hashtag: lead with the message instead.');
    return {
      length: length,
      limit: c.limit,
      left: c.limit === null ? null : c.limit - length,
      hashtags: tags,
      mentions: (text.match(/(?:^|\s)@[\w.]+/g) || []).length,
      warnings: warnings,
    };
  }

  function clean(i) {
    const caption = String(i.caption === undefined || i.caption === null ? '' : i.caption)
      .replace(/\r\n/g, '\n')
      .trim();
    if (!caption) throw new Error('Write the caption or a short idea.');
    let date;
    try {
      date = OT.toIsoDate(i.date);
      if (!date) throw new Error();
    } catch (e) {
      throw new Error('The post date is not a real date.');
    }
    const time = norm(i.time);
    if (time && !isTime(time)) throw new Error('The time must look like 18:30.');
    return {
      date: date,
      time: time,
      channel: CHANNELS[i.channel] ? i.channel : 'Instagram',
      caption: caption.slice(0, 5000),
      status: STATUSES.indexOf(i.status) !== -1 ? i.status : 'Idea',
      owner: norm(i.owner).slice(0, 40),
      link: norm(i.link).slice(0, 300),
      note: norm(i.note).slice(0, 300),
    };
  }

  function add(state, input) {
    const s = copy(state);
    s.posts.push(Object.assign({ id: s.nextId++ }, clean(input)));
    return s;
  }

  function update(state, id, patch) {
    const s = copy(state);
    const p = s.posts.find((x) => x.id === id);
    if (!p) throw new Error('That post was not found.');
    Object.assign(p, clean(Object.assign({}, p, patch)));
    return s;
  }

  function remove(state, id) {
    const s = copy(state);
    s.posts = s.posts.filter((x) => x.id !== id);
    return s;
  }

  /** filter: { channel, status, from, to, search, overdue }. Sorted by date and time. */
  function list(state, today, f) {
    const o = f || {};
    const q = norm(o.search).toLowerCase();
    return state.posts
      .map((p) => Object.assign({ overdue: p.status !== 'Posted' && p.date < today }, p))
      .filter(
        (p) =>
          (!o.channel || p.channel === o.channel) &&
          (!o.status || p.status === o.status) &&
          (!o.from || p.date >= o.from) &&
          (!o.to || p.date <= o.to) &&
          (!o.overdue || p.overdue) &&
          (!q || (p.caption + ' ' + p.owner + ' ' + p.note).toLowerCase().indexOf(q) !== -1),
      )
      .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')) || a.id - b.id);
  }

  /** Month grid: weeks (Monday first) of days { date, inMonth, posts }. month = 'YYYY-MM'. */
  function month(state, ym) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw new Error('The month must look like 2026-10.');
    const first = ym + '-01';
    const t = OT.parseIsoDate(first);
    const dow = (new Date(t).getUTCDay() + 6) % 7;
    let day = OT.addDays(first, -dow);
    const weeks = [];
    do {
      const w = [];
      for (let i = 0; i < 7; i++) {
        const d = day;
        w.push({
          date: d,
          inMonth: d.slice(0, 7) === ym,
          posts: state.posts
            .filter((p) => p.date === d)
            .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.id - b.id),
        });
        day = OT.addDays(day, 1);
      }
      weeks.push(w);
    } while (day.slice(0, 7) === ym);
    return weeks;
  }

  /** Counts, overdue items and empty days in the next `days` days. */
  function summary(state, today, days) {
    const n = days || 14;
    const byStatus = {};
    STATUSES.forEach((s) => (byStatus[s] = 0));
    const byChannel = {};
    state.posts.forEach((p) => {
      byStatus[p.status]++;
      byChannel[p.channel] = (byChannel[p.channel] || 0) + 1;
    });
    const gaps = [];
    for (let i = 0; i < n; i++) {
      const d = OT.addDays(today, i);
      if (!state.posts.some((p) => p.date === d)) gaps.push(d);
    }
    const warn = state.posts.filter((p) => counter(p.channel, p.caption).warnings.some((w) => /allows|accepts/.test(w))).length;
    return {
      total: state.posts.length,
      byStatus: byStatus,
      byChannel: byChannel,
      overdue: state.posts.filter((p) => p.status !== 'Posted' && p.date < today).length,
      gaps: gaps,
      overLimit: warn,
    };
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(state, today) {
    const head = ['Date', 'Time', 'Channel', 'Status', 'Owner', 'Caption', 'Characters', 'Hashtags', 'Link', 'Note', 'Overdue'];
    const rows = list(state, today).map((p) => [
      OT.formatDate(p.date, 'dmy'),
      p.time,
      p.channel,
      p.status,
      p.owner,
      p.caption,
      counter(p.channel, p.caption).length,
      hashtags(p.caption).join(' '),
      p.link,
      p.note,
      p.overdue ? 'yes' : '',
    ]);
    return (
      '\ufeff' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    const out = [];
    let cur = '';
    let bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (bytes + b > 73) {
        out.push(cur);
        cur = ' ';
        bytes = 1;
      }
      cur += ch;
      bytes += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  /** Events for posts that are not yet posted. Timed posts last 15 minutes with a reminder 30 minutes before; dated ones are all-day. */
  function toIcs(state, stamp) {
    if (!/^\d{8}T\d{6}Z$/.test(stamp)) throw new Error('The timestamp must look like 20261023T000000Z.');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Marketing Pocket Tools//Post Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    state.posts
      .filter((p) => p.status !== 'Posted')
      .forEach((p) => {
        const d = p.date.replace(/-/g, '');
        lines.push('BEGIN:VEVENT', 'UID:post-' + p.id + '-' + d + '@marketing-pocket-tools', 'DTSTAMP:' + stamp);
        if (p.time) {
          const [h, m] = p.time.split(':').map(Number);
          const end = h * 60 + m + 15;
          const ed = end >= 1440 ? OT.addDays(p.date, 1).replace(/-/g, '') : d;
          const e = end % 1440;
          lines.push(
            'DTSTART:' + d + 'T' + p.time.replace(':', '') + '00',
            'DTEND:' + ed + 'T' + String(Math.floor(e / 60)).padStart(2, '0') + String(e % 60).padStart(2, '0') + '00',
          );
        } else lines.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + OT.addDays(p.date, 1).replace(/-/g, ''));
        const title = 'Post on ' + p.channel + ': ' + Array.from(p.caption.replace(/\s+/g, ' ')).slice(0, 50).join('');
        lines.push(
          'SUMMARY:' + esc(title),
          'DESCRIPTION:' + esc(p.caption + (p.owner ? '\nOwner: ' + p.owner : '')),
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:' + esc(title),
          p.time ? 'TRIGGER:-PT30M' : 'TRIGGER:PT9H',
          'END:VALARM',
          'END:VEVENT',
        );
      });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  function serialize(state) {
    return JSON.stringify({ app: 'post-planner', version: 1, state: state }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved post plan.');
    }
    const st = j && j.app === 'post-planner' ? j.state : null;
    if (!st || !Array.isArray(st.posts)) throw new Error('That file is not a saved post plan.');
    const out = create();
    st.posts.forEach((raw) => {
      let c;
      try {
        c = clean(raw || {});
      } catch (e) {
        return;
      }
      const id = Number.isInteger(raw.id) && raw.id > 0 && !out.posts.some((x) => x.id === raw.id) ? raw.id : out.nextId;
      out.posts.push(Object.assign({ id: id }, c));
      out.nextId = Math.max(out.nextId, id + 1);
    });
    return out;
  }

  function sample(today) {
    let s = create();
    const a = (offset, time, channel, caption, status, owner) =>
      (s = add(s, { date: OT.addDays(today, offset), time: time, channel: channel, caption: caption, status: status, owner: owner }));
    a(
      -2,
      '18:00',
      'Instagram',
      'Festive lights are up in the store. Which corner is your favourite? #Diwali #FestiveSeason #Lights',
      'Drafted',
      'Asha',
    );
    a(
      -6,
      '10:00',
      'LinkedIn',
      'We just crossed 10,000 orders delivered across India. Thank you to the team and to every customer.',
      'Posted',
      'Ravi',
    );
    a(
      0,
      '17:30',
      'X',
      'Diwali sale starts tomorrow. Up to 40% off on gifts under Rs. 999. Details: example.com/diwali #Diwali #Sale',
      'Scheduled',
      'Asha',
    );
    a(
      1,
      '09:00',
      'Instagram',
      'Sale is LIVE. Tap the link in bio to shop gifts for everyone. #Diwali #Sale #GiftIdeas #FestiveOffers #Shopping',
      'Scheduled',
      'Asha',
    );
    a(2, '', 'Facebook', 'Behind the scenes: how we pack a Diwali gift box. Watch the 30-second reel.', 'Idea', 'Ravi');
    a(5, '12:00', 'WhatsApp', 'Last 48 hours of the Diwali sale. Reply YES for our gift guide.', 'Idea', 'Ravi');
    a(8, '19:00', 'Instagram', 'Thank you for a record Diwali. Here are the highlights. ' + '#Thanks '.repeat(1), 'Idea', 'Asha');
    return s;
  }

  return {
    CHANNELS: CHANNELS,
    STATUSES: STATUSES,
    create: create,
    hashtags: hashtags,
    counter: counter,
    add: add,
    update: update,
    remove: remove,
    list: list,
    month: month,
    summary: summary,
    toCsv: toCsv,
    toIcs: toIcs,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
