/**
 * Content Calendar - core logic (pure).
 *
 * Item: { id, title, type, pillar, funnel, owner, draftDue ('' | date), publishOn (date), status, note }
 * "Today" is always passed in.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.ContentCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const TYPES = ['Blog', 'Video', 'Email', 'Social', 'Webinar', 'Case study', 'Ebook', 'Press', 'Other'];
  const STATUSES = ['Idea', 'Briefed', 'Drafting', 'In review', 'Approved', 'Published'];
  const FUNNEL = ['Awareness', 'Consideration', 'Decision', 'Retention'];
  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const RISK_DAYS = 3;

  const create = () => ({ nextId: 1, items: [] });
  const copy = (s) => JSON.parse(JSON.stringify(s));
  const days = (a, b) => Math.round((OT.parseIsoDate(b) - OT.parseIsoDate(a)) / 86400000);

  function clean(i) {
    const title = norm(i.title);
    if (!title) throw new Error('Give the piece a title.');
    const publishOn = OT.toIsoDate(i.publishOn);
    if (!publishOn) throw new Error('The publish date is not a real date.');
    let draftDue = '';
    if (norm(i.draftDue)) {
      draftDue = OT.toIsoDate(i.draftDue);
      if (!draftDue) throw new Error('The draft due date is not a real date.');
      if (draftDue > publishOn) throw new Error('The draft is due after the publish date.');
    }
    return {
      title: title.slice(0, 120),
      type: TYPES.indexOf(i.type) !== -1 ? i.type : 'Blog',
      pillar: norm(i.pillar).slice(0, 40),
      funnel: FUNNEL.indexOf(i.funnel) !== -1 ? i.funnel : 'Awareness',
      owner: norm(i.owner).slice(0, 40),
      draftDue: draftDue,
      publishOn: publishOn,
      status: STATUSES.indexOf(i.status) !== -1 ? i.status : 'Idea',
      note: norm(i.note).slice(0, 300),
    };
  }

  function add(state, input) {
    const s = copy(state);
    s.items.push(Object.assign({ id: s.nextId++ }, clean(input)));
    return s;
  }

  function update(state, id, patch) {
    const s = copy(state);
    const it = s.items.find((x) => x.id === id);
    if (!it) throw new Error('That piece was not found.');
    Object.assign(it, clean(Object.assign({}, it, patch)));
    return s;
  }

  function remove(state, id) {
    const s = copy(state);
    s.items = s.items.filter((x) => x.id !== id);
    return s;
  }

  /** 'published' | 'late' | 'draft-late' | 'at-risk' | 'on-track' */
  function stateOf(it, today) {
    if (it.status === 'Published') return 'published';
    if (it.publishOn < today) return 'late';
    const earlyStage = STATUSES.indexOf(it.status) < STATUSES.indexOf('In review');
    if (it.draftDue && it.draftDue < today && STATUSES.indexOf(it.status) < STATUSES.indexOf('In review')) return 'draft-late';
    if (earlyStage && days(today, it.publishOn) <= RISK_DAYS) return 'at-risk';
    return 'on-track';
  }

  const LABEL = { published: 'Published', late: 'Late', 'draft-late': 'Draft overdue', 'at-risk': 'At risk', 'on-track': 'On track' };

  /** filter: { type, status, owner, pillar, funnel, from, to, search, problems }. Sorted by publish date. */
  function list(state, today, f) {
    const o = f || {};
    const q = norm(o.search).toLowerCase();
    return state.items
      .map((i) => Object.assign({ state: stateOf(i, today) }, i))
      .filter(
        (i) =>
          (!o.type || i.type === o.type) &&
          (!o.status || i.status === o.status) &&
          (!o.owner || i.owner === o.owner) &&
          (!o.pillar || i.pillar === o.pillar) &&
          (!o.funnel || i.funnel === o.funnel) &&
          (!o.from || i.publishOn >= o.from) &&
          (!o.to || i.publishOn <= o.to) &&
          (!o.problems || ['late', 'draft-late', 'at-risk'].indexOf(i.state) !== -1) &&
          (!q || (i.title + ' ' + i.pillar + ' ' + i.note).toLowerCase().indexOf(q) !== -1),
      )
      .sort((a, b) => a.publishOn.localeCompare(b.publishOn) || a.id - b.id);
  }

  /** Columns for a board: one per status. */
  function board(state, today) {
    return STATUSES.map((s) => ({ status: s, items: list(state, today, { status: s }) }));
  }

  /** Counts for the mix of content. */
  function mix(state, from, to) {
    const items = state.items.filter((i) => (!from || i.publishOn >= from) && (!to || i.publishOn <= to));
    const group = (k, order) => {
      const m = {};
      items.forEach((i) => {
        const v = i[k] || '(none)';
        m[v] = (m[v] || 0) + 1;
      });
      const keys = order
        ? order.filter((x) => m[x]).concat(Object.keys(m).filter((x) => order.indexOf(x) === -1))
        : Object.keys(m).sort((a, b) => m[b] - m[a] || a.localeCompare(b));
      return keys.map((v) => ({ key: v, count: m[v], share: items.length ? m[v] / items.length : 0 }));
    };
    const notes = [];
    const fun = group('funnel', FUNNEL);
    if (items.length >= 8) {
      const top = fun.find((x) => x.share > 0.6);
      if (top) notes.push('More than 60% of the content is ' + top.key + ': check the rest of the funnel is covered.');
      FUNNEL.forEach((f) => {
        if (!fun.some((x) => x.key === f)) notes.push('Nothing planned for the ' + f + ' stage.');
      });
    }
    const owners = group('owner');
    if (items.length >= 6 && owners.length && owners[0].share > 0.5 && owners.length > 1)
      notes.push(owners[0].key + ' owns more than half of the pieces.');
    return { total: items.length, byType: group('type', TYPES), byFunnel: fun, byPillar: group('pillar'), byOwner: owners, notes: notes };
  }

  /** Mondays of the next `weeks` weeks (starting with the week of `from`) with nothing to publish. */
  function emptyWeeks(state, from, weeks) {
    const t = OT.parseIsoDate(from);
    let mon = OT.addDays(from, -((new Date(t).getUTCDay() + 6) % 7));
    const out = [];
    for (let w = 0; w < weeks; w++) {
      const end = OT.addDays(mon, 6);
      if (!state.items.some((i) => i.publishOn >= mon && i.publishOn <= end)) out.push(mon);
      mon = OT.addDays(mon, 7);
    }
    return out;
  }

  function summary(state, today) {
    const s = { total: state.items.length, published: 0, late: 0, 'draft-late': 0, 'at-risk': 0, 'on-track': 0 };
    state.items.forEach((i) => s[stateOf(i, today)]++);
    return s;
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(state, today) {
    const head = ['Publish date', 'Title', 'Type', 'Pillar', 'Funnel stage', 'Owner', 'Draft due', 'Status', 'State', 'Note'];
    const rows = list(state, today).map((i) => [
      OT.formatDate(i.publishOn, 'dmy'),
      i.title,
      i.type,
      i.pillar,
      i.funnel,
      i.owner,
      i.draftDue ? OT.formatDate(i.draftDue, 'dmy') : '',
      i.status,
      LABEL[i.state],
      i.note,
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

  /** All-day events for each unpublished piece: the draft deadline (if any) and the publish date. */
  function toIcs(state, stamp) {
    if (!/^\d{8}T\d{6}Z$/.test(stamp)) throw new Error('The timestamp must look like 20261023T000000Z.');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Marketing Pocket Tools//Content Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    const ev = (i, kind, date, summary) => {
      const d = date.replace(/-/g, '');
      lines.push(
        'BEGIN:VEVENT',
        'UID:content-' + i.id + '-' + kind + '-' + d + '@marketing-pocket-tools',
        'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + d,
        'DTEND;VALUE=DATE:' + OT.addDays(date, 1).replace(/-/g, ''),
        'SUMMARY:' + esc(summary),
        'DESCRIPTION:' + esc(i.type + (i.owner ? ', owner ' + i.owner : '') + ', status ' + i.status),
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:' + esc(summary),
        'TRIGGER:PT9H',
        'END:VALARM',
        'END:VEVENT',
      );
    };
    state.items
      .filter((i) => i.status !== 'Published')
      .forEach((i) => {
        if (i.draftDue && STATUSES.indexOf(i.status) < STATUSES.indexOf('In review')) ev(i, 'draft', i.draftDue, 'Draft due: ' + i.title);
        ev(i, 'publish', i.publishOn, 'Publish: ' + i.title);
      });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  function serialize(state) {
    return JSON.stringify({ app: 'content-calendar', version: 1, state: state }, null, 2);
  }

  function parse(text) {
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved content calendar.');
    }
    const st = j && j.app === 'content-calendar' ? j.state : null;
    if (!st || !Array.isArray(st.items)) throw new Error('That file is not a saved content calendar.');
    const out = create();
    st.items.forEach((raw) => {
      let c;
      try {
        c = clean(raw || {});
      } catch (e) {
        return;
      }
      const id = Number.isInteger(raw.id) && raw.id > 0 && !out.items.some((x) => x.id === raw.id) ? raw.id : out.nextId;
      out.items.push(Object.assign({ id: id }, c));
      out.nextId = Math.max(out.nextId, id + 1);
    });
    return out;
  }

  function sample(today) {
    let s = create();
    const a = (title, type, pillar, funnel, owner, dd, po, status) =>
      (s = add(s, {
        title: title,
        type: type,
        pillar: pillar,
        funnel: funnel,
        owner: owner,
        draftDue: dd === null ? '' : OT.addDays(today, dd),
        publishOn: OT.addDays(today, po),
        status: status,
      }));
    a('How to choose a festive gift for parents', 'Blog', 'Gifting', 'Awareness', 'Asha', -8, -4, 'Published');
    a('Diwali gift guide under Rs. 999', 'Blog', 'Gifting', 'Awareness', 'Asha', -3, 2, 'Drafting');
    a('Behind the scenes: packing a gift box', 'Video', 'Brand', 'Awareness', 'Ravi', 1, 3, 'Briefed');
    a('Diwali sale announcement', 'Email', 'Offers', 'Decision', 'Ravi', -1, 1, 'In review');
    a('Customer story: the family gift hamper', 'Case study', 'Gifting', 'Consideration', 'Meera', 4, 12, 'Idea');
    a('Webinar: gifting for corporate teams', 'Webinar', 'Corporate', 'Consideration', 'Meera', 10, 19, 'Idea');
    a('Thank-you email to repeat customers', 'Email', 'Loyalty', 'Retention', 'Ravi', 14, 24, 'Idea');
    a('Press note: record Diwali sales', 'Press', 'Brand', 'Awareness', 'Asha', null, -1, 'Approved');
    return s;
  }

  return {
    TYPES: TYPES,
    STATUSES: STATUSES,
    FUNNEL: FUNNEL,
    LABEL: LABEL,
    create: create,
    add: add,
    update: update,
    remove: remove,
    stateOf: stateOf,
    list: list,
    board: board,
    mix: mix,
    emptyWeeks: emptyWeeks,
    summary: summary,
    toCsv: toCsv,
    toIcs: toIcs,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
