/* Cohort Retention Summary - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readArrayBuffer, el, copyText, formatInr } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  $('asof').value = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  let events = [];
  let rep = null;
  const pct = (x) => (x === null ? '' : (x * 100).toFixed(0) + '%');
  const level = (x) => (x === null ? 'na' : x === 0 ? 'h0' : x < 0.1 ? 'h1' : x < 0.25 ? 'h2' : x < 0.4 ? 'h3' : x < 0.7 ? 'h4' : 'h5');

  function render() {
    $('stats').textContent = '';
    $('narrative').textContent = '';
    $('t-cohort').textContent = '';
    rep = null;
    if (!events.length) return;
    try {
      rep = CohortCore.report(events, { unit: $('unit').value, periods: Number($('periods').value), asOf: $('asof').value });
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    const stat = (label, v) => el('div', { class: 'stat' }, [el('b', { text: String(v) }), label]);
    const u = rep.unit;
    $('stats').appendChild(stat('Customers', formatInr(rep.customers)));
    $('stats').appendChild(stat('Cohorts', rep.cohorts.length));
    if (rep.average[1] !== null) $('stats').appendChild(stat('Average ' + u + ' 1 retention', pct(rep.average[1])));
    if (rep.average[3] !== null) $('stats').appendChild(stat('Average ' + u + ' 3 retention', pct(rep.average[3])));
    $('narrative').textContent =
      (rep.bestCohort
        ? 'Best ' +
          u +
          ' 1 retention: ' +
          rep.bestCohort +
          (rep.weakestCohort ? '. Weakest: ' + rep.weakestCohort : '') +
          '. Cohorts under 10 customers are left out of that comparison. '
        : '') + (rep.skipped ? rep.skipped + ' activity rows dated before the customer start were ignored.' : '');
    const t = $('t-cohort');
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          [el('th', { scope: 'col', text: 'Cohort' }), el('th', { scope: 'col', text: 'Customers' })].concat(
            Array.from({ length: rep.periods + 1 }, (_, p) =>
              el('th', { scope: 'col', text: p === 0 ? 'Start' : (u === 'week' ? 'Week ' : 'Month ') + p }),
            ),
          ),
        ),
      ]),
    );
    const body = el('tbody');
    rep.cohorts.forEach((c) =>
      body.appendChild(
        el(
          'tr',
          {},
          [el('th', { scope: 'row', text: c.label }), el('td', { text: String(c.size) })].concat(
            c.rates.map((x) => el('td', { class: 'heat ' + level(x), text: pct(x) })),
          ),
        ),
      ),
    );
    body.appendChild(
      el(
        'tr',
        {},
        [el('th', { scope: 'row', text: 'Average' }), el('td', { text: String(rep.customers) })].concat(
          rep.average.map((x) => el('td', { class: 'heat ' + level(x), text: pct(x) })),
        ),
      ),
    );
    t.appendChild(body);
  }

  function load(rows, name) {
    const r = CohortCore.rowsToEvents(rows);
    events = r.events;
    if (!events.length) {
      render();
      return setStatus($('status'), 'No usable rows found in ' + name + '. ' + r.problems.slice(0, 3).join(' '), 'error');
    }
    setStatus(
      $('status'),
      name +
        ': ' +
        events.length +
        ' activity rows.' +
        (r.problems.length
          ? ' ' + r.problems.slice(0, 4).join(' ') + (r.problems.length > 4 ? ' (and ' + (r.problems.length - 4) + ' more)' : '')
          : ''),
      r.problems.length ? 'warn' : 'ok',
    );
    render();
  }

  async function loadFile(file) {
    try {
      const wb = XLSX.read(await readArrayBuffer(file), { type: 'array', cellDates: true });
      load(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true, blankrows: false }), file.name);
    } catch (e) {
      setStatus($('status'), 'Could not read that file.', 'error');
    }
  }

  OT.bindDropzone($('drop'), $('file'), (files) => files[0] && loadFile(files[0]));
  $('demo').addEventListener('click', () => {
    $('unit').value = 'month';
    $('periods').value = 5;
    load(CohortCore.sampleRows($('asof').value), 'Sample');
  });
  ['unit', 'periods', 'asof'].forEach((id) => $(id).addEventListener('input', render));
  const need = () => {
    if (!rep) setStatus($('out-status'), 'Load some activity first.', 'warn');
    return rep;
  };
  $('copy').addEventListener('click', async () => {
    if (!need()) return;
    const ok = await copyText(CohortCore.toText(rep));
    setStatus($('out-status'), ok === false ? 'Could not copy. Use the CSV instead.' : 'Summary copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener('click', () => need() && downloadBlob(CohortCore.toCsv(rep), 'cohort-retention.csv', 'text/csv;charset=utf-8'));
  $('print').addEventListener('click', () => window.print());
})();
