/* Content Calendar - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('today').value = todayIso;
  $('n-pub').value = todayIso;
  let state = ContentCore.create();

  const opts = (sel, items, first) => {
    if (first) sel.appendChild(el('option', { value: '', text: first }));
    items.forEach((x) => sel.appendChild(el('option', { value: x, text: x })));
  };
  opts($('n-type'), ContentCore.TYPES);
  opts($('n-funnel'), ContentCore.FUNNEL);
  opts($('n-status'), ContentCore.STATUSES);
  opts($('f-type'), ContentCore.TYPES, 'All types');
  const today = () => $('today').value;
  const fmt = (d) => OT.formatDate(d, 'dmy');

  function apply(fn) {
    try {
      state = fn(state);
      render();
      return true;
    } catch (e) {
      setStatus($('status'), e.message, 'error');
      return false;
    }
  }

  function simpleTable(id, rows, head) {
    const t = $(id);
    t.textContent = '';
    if (!rows.length) return;
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          [head, 'Pieces', 'Share'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const b = el('tbody');
    rows.forEach((r) =>
      b.appendChild(
        el('tr', {}, [el('td', { text: r.key }), el('td', { text: String(r.count) }), el('td', { text: Math.round(r.share * 100) + '%' })]),
      ),
    );
    t.appendChild(b);
  }

  function fillOwners() {
    const sel = $('f-owner');
    const keep = sel.value;
    sel.textContent = '';
    opts(sel, Array.from(new Set(state.items.map((i) => i.owner).filter(Boolean))).sort(), 'Everyone');
    sel.value = Array.from(sel.options).some((o) => o.value === keep) ? keep : '';
  }

  function render() {
    if (!today()) return;
    const s = ContentCore.summary(state, today());
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    const st = $('stats');
    st.textContent = '';
    st.appendChild(stat('Pieces', s.total));
    st.appendChild(stat('Published', s.published));
    st.appendChild(stat('Late', s.late, s.late > 0));
    st.appendChild(stat('Draft overdue', s['draft-late'], s['draft-late'] > 0));
    st.appendChild(stat('At risk', s['at-risk'], s['at-risk'] > 0));
    const empty = ContentCore.emptyWeeks(state, today(), 6);
    $('gaps').textContent = empty.length
      ? 'Nothing is due to publish in the week of ' + empty.slice(0, 4).map(fmt).join(', ') + (empty.length > 4 ? ' and more' : '') + '.'
      : 'Something is due to publish in each of the next 6 weeks.';
    fillOwners();

    const bd = $('board');
    bd.textContent = '';
    ContentCore.board(state, today()).forEach((c) => {
      const col = el('div', { class: 'col' }, [el('h3', { text: c.status + ' (' + c.items.length + ')' })]);
      c.items.forEach((i) => {
        const next = ContentCore.STATUSES[ContentCore.STATUSES.indexOf(i.status) + 1];
        const nodes = [
          el('strong', { text: i.title }),
          el('div', { class: 'hint', text: [i.type, i.owner, 'publish ' + fmt(i.publishOn)].filter(Boolean).join(' / ') }),
        ];
        if (next) {
          const b = el('button', { type: 'button', text: 'Move to ' + next, 'aria-label': 'Move ' + i.title + ' to ' + next });
          b.addEventListener('click', () => apply((x) => ContentCore.update(x, i.id, { status: next })));
          nodes.push(b);
        }
        col.appendChild(el('div', { class: 'cardlet ' + i.state }, nodes));
      });
      bd.appendChild(col);
    });

    const rows = ContentCore.list(state, today(), {
      type: $('f-type').value,
      owner: $('f-owner').value,
      search: $('f-text').value,
      problems: $('f-prob').checked,
    });
    const tl = $('t-list');
    tl.textContent = '';
    tl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Publish', 'Title', 'Type', 'Owner', 'Draft due', 'Status', 'State', ''].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    rows.forEach((r) => {
      const sel = el(
        'select',
        { 'aria-label': 'Status of ' + r.title },
        ContentCore.STATUSES.map((x) => el('option', { value: x, text: x })),
      );
      sel.value = r.status;
      sel.addEventListener('change', () => apply((x) => ContentCore.update(x, r.id, { status: sel.value })));
      const del = el('button', { type: 'button', text: 'Delete', 'aria-label': 'Delete ' + r.title });
      del.addEventListener('click', () => apply((x) => ContentCore.remove(x, r.id)));
      body.appendChild(
        el('tr', {}, [
          el('td', { class: r.state === 'late' ? 'late' : '', text: fmt(r.publishOn) }),
          el('td', {}, [
            el('strong', { text: r.title }),
            el('div', { class: 'hint', text: [r.pillar, r.funnel].filter(Boolean).join(' / ') }),
          ]),
          el('td', { text: r.type }),
          el('td', { text: r.owner }),
          el('td', { text: r.draftDue ? fmt(r.draftDue) : '' }),
          el('td', {}, [sel]),
          el('td', {}, [el('span', { class: 'pill ' + r.state, text: ContentCore.LABEL[r.state] })]),
          el('td', { class: 'noprint' }, [del]),
        ]),
      );
    });
    tl.appendChild(body);
    $('empty').hidden = rows.length > 0;

    const m = ContentCore.mix(state);
    const mn = $('mix-notes');
    mn.textContent = '';
    m.notes.forEach((n) => mn.appendChild(el('li', { text: n })));
    simpleTable('t-funnel', m.byFunnel, 'Funnel stage');
    simpleTable('t-type', m.byType, 'Type');
    simpleTable('t-owner', m.byOwner, 'Owner');
  }

  $('add').addEventListener('click', () => {
    const ok = apply((x) =>
      ContentCore.add(x, {
        title: $('n-title').value,
        type: $('n-type').value,
        pillar: $('n-pillar').value,
        funnel: $('n-funnel').value,
        owner: $('n-owner').value,
        draftDue: $('n-draft').value,
        publishOn: $('n-pub').value,
        status: $('n-status').value,
        note: $('n-note').value,
      }),
    );
    if (ok) {
      ['n-title', 'n-note', 'n-draft'].forEach((id) => ($(id).value = ''));
      setStatus($('status'), 'Added.', 'ok');
    }
  });
  $('demo').addEventListener('click', () => {
    state = ContentCore.sample(today());
    render();
  });
  ['today', 'f-type', 'f-owner', 'f-text', 'f-prob'].forEach((id) => $(id).addEventListener('input', render));
  $('csv').addEventListener('click', () =>
    downloadBlob(ContentCore.toCsv(state, today()), 'content-calendar.csv', 'text/csv;charset=utf-8'),
  );
  $('ics').addEventListener('click', () => {
    const d = new Date();
    const stamp =
      d.getUTCFullYear() +
      p2(d.getUTCMonth() + 1) +
      p2(d.getUTCDate()) +
      'T' +
      p2(d.getUTCHours()) +
      p2(d.getUTCMinutes()) +
      p2(d.getUTCSeconds()) +
      'Z';
    downloadBlob(ContentCore.toIcs(state, stamp), 'content-calendar.ics', 'text/calendar;charset=utf-8');
    setStatus($('out-status'), 'Calendar file ready: published pieces are left out.', 'ok');
  });
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () => downloadBlob(ContentCore.serialize(state), 'content-calendar.json', 'application/json'));
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      state = ContentCore.parse(await readText(f));
      render();
      setStatus($('out-status'), 'Calendar opened: ' + state.items.length + ' pieces.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
