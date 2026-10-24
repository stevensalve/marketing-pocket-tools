/* ROAS & Campaign ROI Calculator - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText, formatInr } = OT;
  const $ = (id) => document.getElementById(id);
  let report = null;
  const pct = (x) => (x === null ? '-' : (x * 100).toFixed(2) + '%');
  const money = (x) => (x === null ? '-' : formatInr(x, x % 1 ? 2 : 0));
  const x2 = (x) => (x === null ? '-' : x.toFixed(2) + 'x');
  const margin = () => {
    const v = $('margin').value.trim();
    return v === '' ? null : Number(v) / 100;
  };

  function render() {
    const parsed = RoasCore.parseRows($('rows').value);
    const err = $('errors');
    err.textContent = '';
    parsed.errors.forEach((e) => err.appendChild(el('li', { text: e })));
    const stats = $('stats');
    stats.textContent = '';
    const tbl = $('t-out');
    tbl.textContent = '';
    $('summary').textContent = '';
    report = null;
    if (!parsed.rows.length) return;
    try {
      report = RoasCore.report(parsed.rows, margin());
    } catch (e) {
      err.appendChild(el('li', { text: e.message }));
      return;
    }
    const t = report.total;
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: v }), label]);
    stats.appendChild(stat('Spend (Rs.)', money(t.spend)));
    stats.appendChild(stat('Revenue (Rs.)', money(t.revenue)));
    stats.appendChild(stat('ROAS', x2(t.roas), report.breakEvenRoas !== null && t.roas !== null && t.roas < report.breakEvenRoas));
    stats.appendChild(stat('CPA (Rs.)', money(t.cpa)));
    if (report.breakEvenRoas !== null) stats.appendChild(stat('Break-even ROAS', x2(report.breakEvenRoas)));
    if (t.profit !== null) stats.appendChild(stat('Profit after spend (Rs.)', money(t.profit), t.profit < 0));
    $('summary').textContent = report.best && report.worst ? 'Best ROAS: ' + report.best + '. Weakest: ' + report.worst + '.' : '';
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Campaign', 'Spend', 'CTR', 'CPC', 'CPM', 'Conv. rate', 'CPA', 'ROAS', 'ROI', 'Profit', ''].map((h) =>
            el('th', { scope: 'col', text: h }),
          ),
        ),
      ]),
    );
    const body = el('tbody');
    report.rows.concat([t]).forEach((r) => {
      body.appendChild(
        el('tr', {}, [
          el('td', {}, [el('strong', { text: r.name })]),
          el('td', { text: money(r.spend) }),
          el('td', { text: pct(r.ctr) }),
          el('td', { text: money(r.cpc) }),
          el('td', { text: money(r.cpm) }),
          el('td', { text: pct(r.cvr) }),
          el('td', { text: money(r.cpa) }),
          el('td', { text: x2(r.roas) }),
          el('td', { text: pct(r.roi) }),
          el('td', { text: money(r.profit) }),
          el(
            'td',
            {},
            r.verdict ? [el('span', { class: 'pill ' + (r.verdict === 'Profitable' ? 'done' : 'overdue'), text: r.verdict })] : [],
          ),
        ]),
      );
    });
    tbl.appendChild(body);
  }

  function renderBe() {
    const out = $('b-out');
    try {
      const b = RoasCore.breakEven(Number($('b-margin').value) / 100, Number($('b-aov').value));
      out.textContent =
        'Break-even ROAS is ' +
        b.roas.toFixed(2) +
        'x.' +
        (b.maxCpa === null
          ? ''
          : ' You can pay up to Rs. ' +
            formatInr(b.maxCpa, b.maxCpa % 1 ? 2 : 0) +
            ' to win a customer on one order before you lose money.');
    } catch (e) {
      out.textContent = e.message;
    }
  }

  ['rows', 'margin'].forEach((id) => $(id).addEventListener('input', render));
  ['b-aov', 'b-margin'].forEach((id) => $(id).addEventListener('input', renderBe));
  $('demo').addEventListener('click', () => {
    const s = RoasCore.sample();
    $('rows').value = RoasCore.rowsToText(s.rows);
    $('margin').value = s.margin * 100;
    render();
  });
  $('clear').addEventListener('click', () => {
    $('rows').value = '';
    render();
  });
  const need = () => {
    if (!report) setStatus($('out-status'), 'Add some campaigns first.', 'warn');
    return report;
  };
  $('copy').addEventListener('click', async () => {
    if (!need()) return;
    const ok = await copyText(RoasCore.toText(report));
    setStatus($('out-status'), ok === false ? 'Could not copy. Use the CSV instead.' : 'Summary copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener('click', () => need() && downloadBlob(RoasCore.toCsv(report), 'campaign-roas.csv', 'text/csv;charset=utf-8'));
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(RoasCore.serialize(RoasCore.parseRows($('rows').value).rows, margin()), 'campaigns.json', 'application/json'),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const d = RoasCore.parse(await readText(f));
      $('rows').value = RoasCore.rowsToText(d.rows);
      $('margin').value = d.margin === null ? '' : d.margin * 100;
      render();
      setStatus($('out-status'), 'Campaigns opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
  renderBe();
})();
