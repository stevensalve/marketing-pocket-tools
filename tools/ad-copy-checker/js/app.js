/* Ad Copy Length Checker - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  let audit = null;
  let building = false;

  AdCore.PRESETS.forEach((p) => $('preset').appendChild(el('option', { value: p.id, text: p.name })));
  $('preset').value = 'google-rsa';

  function preset() {
    return AdCore.PRESETS.find((p) => p.id === $('preset').value);
  }

  function buildFields(values, limits) {
    building = true;
    const box = $('fields');
    box.textContent = '';
    preset().fields.forEach((f) => {
      const lim = el('input', {
        type: 'number',
        id: 'lim-' + f.id,
        min: '1',
        max: '100000',
        step: '1',
        value: String((limits && limits[f.id]) || f.limit),
        'aria-label': f.label + ' limit',
      });
      const ta = el('textarea', { id: 'txt-' + f.id, rows: f.max === 1 ? '1' : '4' });
      ta.value = (values && values[f.id]) || '';
      lim.addEventListener('input', render);
      ta.addEventListener('input', render);
      box.appendChild(
        el('div', { class: 'field-block' }, [
          el('label', {
            for: 'txt-' + f.id,
            text: f.label + (f.min ? ' (at least ' + f.min + ')' : '') + (f.max > 1 ? ', up to ' + f.max : ''),
          }),
          ta,
          el('div', { class: 'grid' }, [el('div', {}, [el('label', { for: 'lim-' + f.id, text: 'Character limit' }), lim])]),
          el('div', { id: 'res-' + f.id }),
        ]),
      );
    });
    building = false;
  }

  function values() {
    const v = {};
    const l = {};
    preset().fields.forEach((f) => {
      v[f.id] = $('txt-' + f.id).value;
      const n = Number($('lim-' + f.id).value);
      if (Number.isInteger(n) && n > 0) l[f.id] = n;
    });
    return { v: v, l: l };
  }

  function render() {
    if (building) return;
    const x = values();
    audit = AdCore.audit($('preset').value, x.v, x.l);
    audit.fields.forEach((f) => {
      const box = $('res-' + f.id);
      box.textContent = '';
      f.results.forEach((r) => {
        const row = el('div', { class: 'hint' }, [
          el('span', {
            class: 'counter ' + r.status,
            text: r.length + '/' + r.limit + (r.status === 'over' ? ' (' + -r.left + ' too long) ' : ' '),
          }),
        ]);
        row.appendChild(document.createTextNode(r.shown));
        if (r.status === 'over') row.appendChild(el('span', { class: 'cutmark', text: r.text.slice(r.shown.length) }));
        r.flags.forEach((fl) => row.appendChild(el('div', { class: 'late', text: fl })));
        box.appendChild(row);
      });
    });
    const pb = $('problems');
    pb.textContent = '';
    audit.problems.forEach((p) => pb.appendChild(el('li', { text: p })));
    const st = $('stats');
    st.textContent = '';
    const total = audit.fields.reduce((a, f) => a + f.results.length, 0);
    st.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(total) }), 'Lines checked']));
    st.appendChild(el('div', { class: 'stat' + (audit.over ? ' bad' : '') }, [el('b', { text: String(audit.over) }), 'Over the limit']));
    st.appendChild(
      el('div', { class: 'stat' + (audit.problems.length ? ' bad' : '') }, [el('b', { text: String(audit.problems.length) }), 'To fix']),
    );
  }

  function renderSms() {
    const t = $('sms').value;
    const s = AdCore.sms(t);
    $('sms-out').textContent = t
      ? s.encoding +
        ': ' +
        s.units +
        ' characters, ' +
        s.segments +
        (s.segments === 1 ? ' message' : ' messages') +
        ', ' +
        s.left +
        ' left in the last one.' +
        (s.encoding === 'Unicode' ? ' A non-GSM character (such as Hindi script or an emoji) cuts each message to 70 characters.' : '')
      : '';
  }

  $('preset').addEventListener('change', () => {
    buildFields(null, null);
    render();
  });
  $('demo').addEventListener('click', () => {
    const s = AdCore.sample();
    $('preset').value = s.preset;
    buildFields(s.values, s.limits);
    render();
  });
  $('clear').addEventListener('click', () => {
    buildFields(null, null);
    render();
  });
  $('sms').addEventListener('input', renderSms);
  $('copy').addEventListener('click', async () => {
    const ok = await copyText(AdCore.toText(audit));
    setStatus($('out-status'), ok === false ? 'Could not copy. Use the CSV instead.' : 'Report copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener('click', () => downloadBlob(AdCore.toCsv(audit), 'ad-copy-check.csv', 'text/csv;charset=utf-8'));
  $('save').addEventListener('click', () => {
    const x = values();
    downloadBlob(AdCore.serialize($('preset').value, x.v, x.l), 'ad-copy.json', 'application/json');
  });
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const d = AdCore.parse(await readText(f));
      $('preset').value = d.preset;
      buildFields(d.values, d.limits);
      render();
      setStatus($('out-status'), 'Ad opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  buildFields(null, null);
  render();
})();
