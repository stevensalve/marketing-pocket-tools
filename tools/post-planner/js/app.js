/* Social Post Planner - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('today').value = todayIso;
  $('n-date').value = todayIso;
  $('month').value = todayIso.slice(0, 7);
  let state = PostCore.create();

  Object.keys(PostCore.CHANNELS).forEach((c) => $('n-channel').appendChild(el('option', { value: c, text: c })));
  PostCore.STATUSES.forEach((s) => $('n-status').appendChild(el('option', { value: s, text: s })));
  $('f-channel').appendChild(el('option', { value: '', text: 'All channels' }));
  Object.keys(PostCore.CHANNELS).forEach((c) => $('f-channel').appendChild(el('option', { value: c, text: c })));
  $('f-status').appendChild(el('option', { value: '', text: 'All statuses' }));
  PostCore.STATUSES.forEach((s) => $('f-status').appendChild(el('option', { value: s, text: s })));

  const today = () => $('today').value;

  function renderCounter() {
    const c = PostCore.counter($('n-channel').value, $('n-caption').value);
    const el1 = $('counter');
    el1.textContent =
      c.length + (c.limit ? ' / ' + c.limit : '') + ' characters, ' + c.hashtags.length + ' hashtags, ' + c.mentions + ' mentions';
    el1.className = 'counter' + (c.limit && c.length > c.limit ? ' over' : '');
    const w = $('n-warn');
    w.textContent = '';
    c.warnings.forEach((x) => w.appendChild(el('li', { text: x })));
  }

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

  function render() {
    if (!today()) return;
    const s = PostCore.summary(state, today(), 14);
    $('stats').textContent = '';
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    PostCore.STATUSES.forEach((k) => $('stats').appendChild(stat(k, s.byStatus[k])));
    $('stats').appendChild(stat('Overdue', s.overdue, s.overdue > 0));
    $('stats').appendChild(stat('Over the limit', s.overLimit, s.overLimit > 0));
    $('gaps').textContent = s.gaps.length
      ? 'No post planned on ' +
        s.gaps.length +
        ' of the next 14 days: ' +
        s.gaps
          .slice(0, 6)
          .map((d) => OT.formatDate(d, 'dmy').slice(0, 5))
          .join(', ') +
        (s.gaps.length > 6 ? ' and more' : '') +
        '.'
      : 'Every one of the next 14 days has a post.';

    // month grid
    const t = $('t-month');
    t.textContent = '';
    if ($('month').value) {
      const weeks = PostCore.month(state, $('month').value);
      t.appendChild(
        el('thead', {}, [
          el(
            'tr',
            {},
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h) => el('th', { scope: 'col', text: h })),
          ),
        ]),
      );
      const body = el('tbody');
      const chip = (p) =>
        el('span', {
          class: 'chip ' + p.status,
          title: p.channel + ': ' + p.caption,
          text: (p.time ? p.time + ' ' : '') + p.channel + ': ' + p.caption.replace(/\s+/g, ' '),
        });
      const dayCell = (d) =>
        el(
          'td',
          { class: (d.inMonth ? '' : 'out ') + (d.date === today() ? 'today' : '') },
          [el('div', { text: String(Number(d.date.slice(8))) })].concat(d.posts.map(chip)),
        );
      weeks.forEach((w) => body.appendChild(el('tr', {}, w.map(dayCell))));
      t.appendChild(body);
    }

    // list
    const rows = PostCore.list(state, today(), {
      channel: $('f-channel').value,
      status: $('f-status').value,
      search: $('f-text').value,
      overdue: $('f-over').checked,
    });
    const tl = $('t-list');
    tl.textContent = '';
    tl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['When', 'Channel', 'Caption', 'Length', 'Status', 'Owner', ''].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    rows.forEach((r) => {
      const c = PostCore.counter(r.channel, r.caption);
      const st = el(
        'select',
        { 'aria-label': 'Status of post on ' + OT.formatDate(r.date, 'dmy') + ' ' + r.channel },
        PostCore.STATUSES.map((x) => el('option', { value: x, text: x })),
      );
      st.value = r.status;
      st.addEventListener('change', () => apply((s0) => PostCore.update(s0, r.id, { status: st.value })));
      const del = el('button', {
        type: 'button',
        text: 'Delete',
        'aria-label': 'Delete post on ' + OT.formatDate(r.date, 'dmy') + ' ' + r.channel,
      });
      del.addEventListener('click', () => apply((s0) => PostCore.remove(s0, r.id)));
      body.appendChild(
        el('tr', {}, [
          el('td', { class: r.overdue ? 'late' : '', text: OT.formatDate(r.date, 'dmy') + (r.time ? ' ' + r.time : '') }),
          el('td', { text: r.channel }),
          el(
            'td',
            {},
            [el('div', { text: r.caption }), el('div', { class: 'hint', text: [r.link, r.note].filter(Boolean).join(' / ') })].concat(
              c.warnings.map((w) => el('div', { class: 'late', text: w })),
            ),
          ),
          el('td', { class: 'counter' + (c.limit && c.length > c.limit ? ' over' : ''), text: c.length + (c.limit ? '/' + c.limit : '') }),
          el('td', {}, [st]),
          el('td', { text: r.owner }),
          el('td', { class: 'noprint' }, [del]),
        ]),
      );
    });
    tl.appendChild(body);
    $('empty').hidden = rows.length > 0;
  }

  $('add').addEventListener('click', () => {
    const ok = apply((s0) =>
      PostCore.add(s0, {
        channel: $('n-channel').value,
        date: $('n-date').value,
        time: $('n-time').value,
        status: $('n-status').value,
        owner: $('n-owner').value,
        link: $('n-link').value,
        caption: $('n-caption').value,
      }),
    );
    if (ok) {
      ['n-caption', 'n-time', 'n-link'].forEach((id) => ($(id).value = ''));
      renderCounter();
      setStatus($('status'), 'Added.', 'ok');
    }
  });
  $('demo').addEventListener('click', () => {
    state = PostCore.sample(today());
    render();
  });
  ['n-channel', 'n-caption'].forEach((id) => $(id).addEventListener('input', renderCounter));
  ['today', 'month', 'f-channel', 'f-status', 'f-text', 'f-over'].forEach((id) => $(id).addEventListener('input', render));
  $('csv').addEventListener('click', () => downloadBlob(PostCore.toCsv(state, today()), 'post-plan.csv', 'text/csv;charset=utf-8'));
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
    downloadBlob(PostCore.toIcs(state, stamp), 'post-plan.ics', 'text/calendar;charset=utf-8');
    setStatus($('out-status'), 'Calendar file ready: posts already marked Posted are left out.', 'ok');
  });
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () => downloadBlob(PostCore.serialize(state), 'post-plan.json', 'application/json'));
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      state = PostCore.parse(await readText(f));
      render();
      setStatus($('out-status'), 'Plan opened: ' + state.posts.length + ' posts.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  renderCounter();
  render();
})();
