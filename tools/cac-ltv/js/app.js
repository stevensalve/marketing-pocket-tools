/* CAC & LTV Calculator - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText, formatInr } = OT;
  const $ = (id) => document.getElementById(id);
  let current = null;
  const money = (x) => (x === null ? '-' : formatInr(x, x % 1 ? 2 : 0));
  const numOrNull = (id) => {
    const v = $(id).value.trim();
    return v === '' ? null : Number(v);
  };
  const intOrNull = (id) => {
    const v = $(id).value.trim();
    return v === '' ? null : /^\d+$/.test(v) ? Number(v) : NaN;
  };
  const pc = (id) => {
    const v = numOrNull(id);
    return v === null ? null : v / 100;
  };

  function read() {
    return {
      model: $('model').value,
      adSpend: numOrNull('ad'),
      otherSpend: numOrNull('other'),
      newCustomers: intOrNull('new'),
      paidCustomers: intOrNull('paid'),
      margin: pc('margin'),
      arpa: numOrNull('arpa'),
      churn: pc('churn'),
      aov: numOrNull('aov'),
      ordersPerYear: numOrNull('orders'),
      lifespanYears: numOrNull('years'),
    };
  }

  function write(i) {
    $('model').value = i.model;
    const set = (id, v, k) => ($(id).value = v === null || v === undefined ? '' : v * (k || 1));
    set('ad', i.adSpend);
    set('other', i.otherSpend);
    set('new', i.newCustomers);
    set('paid', i.paidCustomers);
    set('margin', i.margin, 100);
    set('arpa', i.arpa);
    set('churn', i.churn, 100);
    set('aov', i.aov);
    set('orders', i.ordersPerYear);
    set('years', i.lifespanYears);
    toggle();
  }

  function toggle() {
    const sub = $('model').value === 'subscription';
    $('g-sub').hidden = !sub;
    $('g-rep').hidden = sub;
  }

  function render() {
    toggle();
    const i = read();
    ['stats', 'warn', 't-grid'].forEach((id) => ($(id).textContent = ''));
    $('verdict').textContent = '';
    $('problem').textContent = '';
    current = null;
    const blank = [i.adSpend, i.otherSpend, i.newCustomers, i.margin].some((v) => v === null);
    if (blank) return;
    let r;
    try {
      r = CacCore.compute(i);
    } catch (e) {
      $('problem').textContent = e.message;
      return;
    }
    current = { i: i, r: r };
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: v }), label]);
    $('stats').appendChild(stat('Blended CAC (Rs.)', money(r.blendedCac)));
    if (r.paidCac !== null) $('stats').appendChild(stat('Paid CAC (Rs.)', money(r.paidCac)));
    $('stats').appendChild(stat('LTV (Rs.)', money(r.ltv)));
    $('stats').appendChild(stat('LTV to CAC', r.ratio.toFixed(2) + 'x', r.ratio < 3));
    $('stats').appendChild(stat('Payback', r.paybackMonths.toFixed(1) + ' months', r.paybackMonths > 12));
    $('verdict').textContent = r.verdict + '.';
    r.warnings.forEach((w) => $('warn').appendChild(el('li', { text: w })));
    const g = CacCore.sensitivity(i);
    const t = $('t-grid');
    const keepName = i.model === 'subscription' ? 'churn' : 'lifespan';
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          [el('th', { scope: 'col', text: 'Retention / cost' })].concat(
            g.cost.map((c) =>
              el('th', { scope: 'col', text: c === 1 ? 'As now' : (c > 1 ? '+' : '') + Math.round((c - 1) * 100) + '% cost' }),
            ),
          ),
        ),
      ]),
    );
    const body = el('tbody');
    g.grid.forEach((row, k) =>
      body.appendChild(
        el(
          'tr',
          {},
          [
            el('th', {
              scope: 'row',
              text: g.keep[k] === 1 ? 'As now' : g.keep[k] > 1 ? 'Better ' + keepName + ' (+20%)' : 'Worse ' + keepName + ' (-20%)',
            }),
          ].concat(row.map((v) => el('td', { class: v >= 3 ? 'ok' : v < 1 ? 'late' : '', text: v.toFixed(2) + 'x' }))),
        ),
      ),
    );
    t.appendChild(body);
  }

  ['model', 'ad', 'other', 'new', 'paid', 'margin', 'arpa', 'churn', 'aov', 'orders', 'years'].forEach((id) =>
    $(id).addEventListener('input', render),
  );
  $('demo').addEventListener('click', () => {
    write(CacCore.sample());
    render();
  });
  const need = () => {
    if (!current) setStatus($('out-status'), 'Fill in the numbers first.', 'warn');
    return current;
  };
  $('copy').addEventListener('click', async () => {
    if (!need()) return;
    const ok = await copyText(CacCore.toText(current.i, current.r));
    setStatus($('out-status'), ok === false ? 'Could not copy. Use the CSV instead.' : 'Result copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener(
    'click',
    () => need() && downloadBlob(CacCore.toCsv(current.i, current.r), 'cac-ltv.csv', 'text/csv;charset=utf-8'),
  );
  $('save').addEventListener('click', () => downloadBlob(CacCore.serialize(read()), 'cac-ltv.json', 'application/json'));
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      write(CacCore.parse(await readText(f)));
      render();
      setStatus($('out-status'), 'Calculation opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
