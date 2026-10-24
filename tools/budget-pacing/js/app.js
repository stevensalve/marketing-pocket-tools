/* Budget Pacing Tracker - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText, formatInr } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('today').value = todayIso;
  $('start').value = todayIso.slice(0, 8) + '01';
  $('end').value = OT.addDays(OT.addDays(todayIso.slice(0, 7) + '-01', 32).slice(0, 8) + '01', -1);
  let rep = null;
  const money = (x) => (x === null ? '-' : formatInr(x));
  const pct = (x) => (x === null ? '-' : Math.round(x * 100) + '%');
  const period = () => ({ start: $('start').value, end: $('end').value });

  function bar(c) {
    const wrap = el('div', { class: 'pacebar' });
    const full = Math.max(c.budget, c.spent, 1);
    const s = el('span', { class: 'spent' + (c.spent > c.budget ? ' over' : '') });
    s.style.width = (c.spent / full) * 100 + '%';
    const m = el('span', { class: 'mark' });
    m.style.left = (c.expected / full) * 100 + '%';
    wrap.appendChild(s);
    wrap.appendChild(m);
    return wrap;
  }

  function render() {
    ['stats', 'flags', 't-out', 'errors'].forEach((id) => ($(id).textContent = ''));
    $('projection').textContent = '';
    rep = null;
    let parsed;
    try {
      parsed = PacingCore.parseRows($('rows').value, period());
    } catch (e) {
      return;
    }
    parsed.errors.forEach((e) => $('errors').appendChild(el('li', { text: e })));
    if (!parsed.rows.length) return;
    try {
      rep = PacingCore.report(parsed.rows, period(), $('today').value);
    } catch (e) {
      $('errors').appendChild(el('li', { text: e.message }));
      return;
    }
    const t = rep.total;
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: v }), label]);
    $('stats').appendChild(stat('Budget (Rs.)', money(t.budget)));
    $('stats').appendChild(stat('Spent (Rs.)', money(t.spent)));
    $('stats').appendChild(stat('Pacing', pct(t.pacing), t.pacing !== null && (t.pacing > 1.1 || t.pacing < 0.9)));
    $('stats').appendChild(stat('Remaining (Rs.)', money(t.remaining), t.remaining < 0));
    if (t.projected !== null)
      $('projection').textContent =
        'At the current pace the total reaches Rs. ' +
        money(t.projected) +
        (t.projectedGap > 0
          ? ', which is Rs. ' + money(t.projectedGap) + ' over budget.'
          : t.projectedGap < 0
            ? ', leaving Rs. ' + money(-t.projectedGap) + ' unspent.'
            : ', exactly on budget.');
    rep.flags.forEach((f) => $('flags').appendChild(el('li', { text: f })));
    const tbl = $('t-out');
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Channel', 'Budget', 'Spent', 'Pacing', '', 'Projected', 'Per day now', 'Allowed per day', 'Days left', 'Status'].map((h) =>
            el('th', { scope: 'col', text: h }),
          ),
        ),
      ]),
    );
    const body = el('tbody');
    rep.channels.forEach((c) =>
      body.appendChild(
        el('tr', {}, [
          el('td', {}, [el('strong', { text: c.name })]),
          el('td', { text: money(c.budget) }),
          el('td', { text: money(c.spent) }),
          el('td', { text: pct(c.pacing) }),
          el('td', {}, [bar(c)]),
          el('td', { text: money(c.projected) }),
          el('td', { text: money(c.currentDaily) }),
          el('td', { text: money(c.allowedDaily) }),
          el('td', { text: String(c.left) }),
          el('td', {}, [el('span', { class: 'pill ' + c.status.replace(/ /g, '-'), text: c.status })]),
        ]),
      ),
    );
    tbl.appendChild(body);
  }

  ['rows', 'start', 'end', 'today'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    const s = PacingCore.sample($('today').value);
    $('start').value = s.period.start;
    $('end').value = s.period.end;
    $('rows').value = PacingCore.rowsToText(s.rows);
    render();
  });
  $('clear').addEventListener('click', () => {
    $('rows').value = '';
    render();
  });
  const need = () => {
    if (!rep) setStatus($('out-status'), 'Add some channels first.', 'warn');
    return rep;
  };
  $('copy').addEventListener('click', async () => {
    if (!need()) return;
    const ok = await copyText(PacingCore.toText(rep));
    setStatus($('out-status'), ok === false ? 'Could not copy. Use the CSV instead.' : 'Summary copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener('click', () => need() && downloadBlob(PacingCore.toCsv(rep), 'budget-pacing.csv', 'text/csv;charset=utf-8'));
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(
      PacingCore.serialize(PacingCore.parseRows($('rows').value, period()).rows, period()),
      'budget-pacing.json',
      'application/json',
    ),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const d = PacingCore.parse(await readText(f));
      $('start').value = d.period.start;
      $('end').value = d.period.end;
      $('rows').value = PacingCore.rowsToText(d.rows);
      render();
      setStatus($('out-status'), 'Plan opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
