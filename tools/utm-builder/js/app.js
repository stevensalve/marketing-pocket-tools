/* UTM Link Builder - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  $('mediums').value = UtmCore.COMMON_MEDIUMS.join(', ');
  let results = [];

  function rules() {
    return { lowercase: $('lower').checked, separator: $('sep').value, allowedMedium: $('mediums').value.split(',') };
  }

  function render() {
    const rows = UtmCore.parseBatch($('rows').value);
    results = UtmCore.buildBatch(rows, rules());
    const audit = $('audit');
    audit.textContent = '';
    UtmCore.audit(rows).forEach((g) =>
      audit.appendChild(el('li', { text: 'Different spellings of one ' + g.field + ': ' + g.names.join(', ') + '. Pick one.' })),
    );
    const tbl = $('t-out');
    tbl.textContent = '';
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Line', 'Tagged link', 'Notes', ''].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    results.forEach((r) => {
      const btn = el('button', { type: 'button', text: 'Copy', 'aria-label': 'Copy link from line ' + r.line });
      btn.disabled = !r.url;
      btn.addEventListener('click', async () => {
        const ok = await copyText(r.url);
        setStatus(
          $('out-status'),
          ok === false ? 'Could not copy. Select the link and copy it yourself.' : 'Link copied.',
          ok === false ? 'warn' : 'ok',
        );
      });
      const notes = r.errors
        .map((e) => el('div', { class: 'late', text: e }))
        .concat(r.warnings.map((w) => el('div', { class: 'hint', text: w })));
      body.appendChild(
        el('tr', {}, [
          el('td', { text: String(r.line) }),
          el('td', { class: 'url', text: r.url || '(not built)' }),
          el('td', {}, notes),
          el('td', { class: 'noprint' }, [btn]),
        ]),
      );
    });
    tbl.appendChild(body);
    $('empty').hidden = results.length > 0;
  }

  ['rows', 'lower', 'sep', 'mediums'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    $('rows').value = UtmCore.batchToText(UtmCore.sample());
    render();
  });
  $('clear').addEventListener('click', () => {
    $('rows').value = '';
    render();
  });
  $('copy-all').addEventListener('click', async () => {
    const links = results.filter((r) => r.url).map((r) => r.url);
    if (!links.length) return setStatus($('out-status'), 'There are no finished links to copy.', 'warn');
    const ok = await copyText(links.join('\n'));
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Use the CSV instead.' : links.length + ' links copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('csv').addEventListener('click', () => downloadBlob(UtmCore.toCsv(results), 'utm-links.csv', 'text/csv;charset=utf-8'));
  $('save').addEventListener('click', () =>
    downloadBlob(UtmCore.serialize(UtmCore.parseBatch($('rows').value), rules()), 'utm-links.json', 'application/json'),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const d = UtmCore.parse(await readText(f));
      $('lower').checked = d.rules.lowercase;
      $('sep').value = d.rules.separator;
      $('mediums').value = d.rules.allowedMedium.join(', ');
      $('rows').value = UtmCore.batchToText(d.rows);
      render();
      setStatus($('out-status'), 'List opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
