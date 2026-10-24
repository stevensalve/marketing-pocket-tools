/* Funnel Report - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readArrayBuffer, el, copyText, formatInr } = OT;
  const $ = (id) => document.getElementById(id);
  let leads = [];
  let fromCounts = null;
  let rep = null;
  const pct = (x) => (x === null ? '-' : (x * 100).toFixed(1) + '%');

  function table(id, heads, rows) {
    const t = $(id);
    t.textContent = '';
    if (!rows.length) return;
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          heads.map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const b = el('tbody');
    rows.forEach((r) =>
      b.appendChild(
        el(
          'tr',
          {},
          r.map((c) => (c instanceof Node ? el('td', {}, [c]) : el('td', { text: String(c) }))),
        ),
      ),
    );
    t.appendChild(b);
  }
  function bar(value, max, old) {
    const wrap = el('div', { class: 'hbar' + (old ? ' old' : '') });
    const s = el('span');
    s.style.width = (max ? (value / max) * 100 : 0) + '%';
    wrap.appendChild(s);
    return wrap;
  }

  function stages() {
    return FunnelCore.parseStages($('stages').value);
  }

  function render() {
    ['stats', 'narrative'].forEach((id) => ($(id).textContent = ''));
    ['t-funnel', 't-chan'].forEach((id) => ($(id).textContent = ''));
    rep = null;
    let st;
    try {
      st = stages();
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    let steps;
    let channels = [];
    try {
      if (fromCounts) {
        const f = FunnelCore.funnel(fromCounts.stages, fromCounts.counts);
        rep = {
          stages: fromCounts.stages,
          funnel: f,
          total: fromCounts.counts[0],
          won: fromCounts.counts[fromCounts.counts.length - 1],
          rate: fromCounts.counts[0] ? fromCounts.counts[fromCounts.counts.length - 1] / fromCounts.counts[0] : 0,
          revenue: 0,
          channels: [],
          bestChannel: null,
          weakestChannel: null,
          smallChannels: 0,
        };
      } else if (leads.length) rep = FunnelCore.report(leads, st);
      else return;
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    steps = rep.funnel.steps;
    channels = rep.channels;
    const stat = (label, v) => el('div', { class: 'stat' }, [el('b', { text: String(v) }), label]);
    const lastName = rep.stages[rep.stages.length - 1];
    $('stats').appendChild(stat('Leads', formatInr(rep.total)));
    $('stats').appendChild(stat(lastName, formatInr(rep.won)));
    $('stats').appendChild(stat('Lead to ' + lastName, pct(rep.rate)));
    if (rep.revenue) $('stats').appendChild(stat('Revenue (Rs.)', formatInr(rep.revenue)));
    const leak = rep.funnel.biggestLeak;
    $('narrative').textContent =
      (leak ? 'The biggest leak is ' + leak.from + ' to ' + leak.to + ': only ' + pct(leak.keep) + ' go on. ' : '') +
      (rep.bestChannel ? 'Best channel: ' + rep.bestChannel + (rep.weakestChannel ? '. Weakest: ' + rep.weakestChannel : '') + '. ' : '') +
      (rep.smallChannels ? rep.smallChannels + ' channel(s) have under 20 leads and are left out of that comparison.' : '');
    const top = steps[0].count;
    table(
      't-funnel',
      ['Stage', 'Count', 'Kept from previous', 'Kept from top', 'Lost at this step', ''],
      steps.map((s) => [
        s.stage,
        formatInr(s.count),
        pct(s.fromPrev),
        pct(s.fromTop),
        formatInr(s.lost),
        bar(s.count, top, !!leak && leak.to === s.stage),
      ]),
    );
    if (channels.length)
      table(
        't-chan',
        ['Channel', 'Leads', 'Share'].concat(rep.stages.slice(1), ['To ' + lastName, 'Revenue (Rs.)', 'Avg value (Rs.)']),
        channels.map((c) =>
          [c.channel, c.leads, pct(c.share)].concat(c.counts.slice(1), [
            pct(c.rate),
            formatInr(c.revenue),
            c.avgValue === null ? '-' : formatInr(c.avgValue),
          ]),
        ),
      );
  }

  function load(rows, name) {
    fromCounts = null;
    let r;
    try {
      r = FunnelCore.rowsToLeads(rows, stages());
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    leads = r.leads;
    if (!leads.length) {
      render();
      return setStatus($('status'), 'No usable leads found in ' + name + '. ' + r.problems.slice(0, 3).join(' '), 'error');
    }
    const msg = name + ': ' + leads.length + ' leads' + (r.lost ? ', ' + r.lost + ' marked lost' : '') + '.';
    setStatus(
      $('status'),
      msg +
        (r.problems.length
          ? ' ' + r.problems.slice(0, 4).join(' ') + (r.problems.length > 4 ? ' (and ' + (r.problems.length - 4) + ' more)' : '')
          : ''),
      r.problems.length ? 'warn' : 'ok',
    );
    render();
  }

  async function loadFile(file) {
    try {
      const wb = XLSX.read(await readArrayBuffer(file), { type: 'array' });
      load(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true, blankrows: false }), file.name);
    } catch (e) {
      setStatus($('status'), 'Could not read that file.', 'error');
    }
  }

  OT.bindDropzone($('drop'), $('file'), (files) => files[0] && loadFile(files[0]));
  $('demo').addEventListener('click', () => {
    $('stages').value = FunnelCore.DEFAULT_STAGES.join(', ');
    load(FunnelCore.sampleRows(), 'Sample');
  });
  $('stages').addEventListener('input', () => {
    if (!fromCounts) render();
  });
  $('counts').addEventListener('input', () => {
    const v = $('counts').value.trim();
    if (!v) {
      fromCounts = null;
      setStatus($('status'), '', '');
      return render();
    }
    try {
      fromCounts = FunnelCore.parseCounts(v);
      setStatus($('status'), 'Using the typed counts.', 'ok');
    } catch (e) {
      fromCounts = null;
      setStatus($('status'), e.message, 'error');
    }
    render();
  });
  const need = () => {
    if (!rep) setStatus($('out-status'), 'Load some leads first.', 'warn');
    return rep;
  };
  $('copy').addEventListener('click', async () => {
    if (!need()) return;
    const ok = await copyText(FunnelCore.toText(rep));
    setStatus($('out-status'), ok === false ? 'Could not copy. Use the CSV instead.' : 'Summary copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener('click', () => need() && downloadBlob(FunnelCore.toCsv(rep), 'funnel-report.csv', 'text/csv;charset=utf-8'));
  $('print').addEventListener('click', () => window.print());
})();
