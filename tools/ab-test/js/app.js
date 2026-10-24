/* A/B Test Significance - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText, safeFileName, formatInr } = OT;
  const $ = (id) => document.getElementById(id);
  let current = null;
  const intOrNull = (id) => {
    const v = $(id).value.trim();
    return v === '' ? null : /^\d+$/.test(v) ? Number(v) : NaN;
  };
  const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: v }), label]);
  const pct = (x, d) => (x * 100).toFixed(d === undefined ? 2 : d) + '%';

  function read() {
    return {
      name: $('name').value.trim(),
      notes: $('notes').value.trim(),
      a: { visitors: intOrNull('a-v'), conversions: intOrNull('a-c') },
      b: { visitors: intOrNull('b-v'), conversions: intOrNull('b-c') },
      confidence: Number($('conf').value),
    };
  }

  function write(t) {
    $('name').value = t.name;
    $('notes').value = t.notes;
    [
      ['a-v', t.a.visitors],
      ['a-c', t.a.conversions],
      ['b-v', t.b.visitors],
      ['b-c', t.b.conversions],
    ].forEach((x) => ($(x[0]).value = x[1] === null ? '' : x[1]));
    $('conf').value = String(t.confidence);
  }

  function renderResult() {
    const t = read();
    const stats = $('stats');
    stats.textContent = '';
    $('warn').textContent = '';
    $('report').textContent = '';
    $('verdict').firstChild.textContent = '';
    current = null;
    const empty = [t.a.visitors, t.a.conversions, t.b.visitors, t.b.conversions].some((v) => v === null);
    const problems = empty ? [] : AbCore.check(t.a, t.b);
    $('problem').textContent = problems[0] || '';
    if (empty || problems.length) return;
    const r = AbCore.compare(t.a, t.b, t.confidence);
    current = { t: t, r: r };
    stats.appendChild(stat('Version A', pct(r.rateA)));
    stats.appendChild(stat('Version B', pct(r.rateB)));
    stats.appendChild(
      stat(
        'Relative lift',
        r.relLift === null ? 'n/a' : (r.relLift >= 0 ? '+' : '') + pct(r.relLift, 1),
        r.relLift !== null && r.relLift < 0,
      ),
    );
    stats.appendChild(stat('p-value', r.pValue < 0.0001 ? '<0.0001' : r.pValue.toFixed(4)));
    $('verdict').firstChild.textContent = r.verdict;
    r.warnings.forEach((w) => $('warn').appendChild(el('li', { text: w })));
    $('report').textContent = AbCore.toText(t.name, t.a, t.b, r);
  }

  function renderPlan() {
    const stats = $('p-stats');
    stats.textContent = '';
    $('p-problem').textContent = '';
    try {
      const base = Number($('p-base').value) / 100;
      const raw = Number($('p-mde').value);
      const abs = $('p-kind').value === 'abs';
      const r = AbCore.sampleSize({
        baseline: base,
        mde: abs ? raw / 100 : raw / 100,
        absolute: abs,
        confidence: Number($('p-conf').value),
        power: Number($('p-power').value),
      });
      stats.appendChild(stat('Visitors per version', formatInr(r.perVersion)));
      stats.appendChild(stat('Total visitors', formatInr(r.total)));
      stats.appendChild(stat('Target rate for B', pct(r.target)));
      const daily = Number($('p-daily').value);
      if (daily > 0) {
        const d = AbCore.duration(r.perVersion, daily, 2);
        stats.appendChild(stat('Time needed', d.days + ' days (' + d.weeks + (d.weeks === 1 ? ' week' : ' weeks') + ')'));
      }
    } catch (e) {
      $('p-problem').textContent = e.message;
    }
  }

  ['name', 'notes', 'a-v', 'a-c', 'b-v', 'b-c', 'conf'].forEach((id) => $(id).addEventListener('input', renderResult));
  ['p-base', 'p-mde', 'p-kind', 'p-conf', 'p-power', 'p-daily'].forEach((id) => $(id).addEventListener('input', renderPlan));
  $('demo').addEventListener('click', () => {
    write(AbCore.sample());
    renderResult();
  });
  const need = () => {
    if (!current) setStatus($('out-status'), 'Fill in both versions first.', 'warn');
    return current;
  };
  $('copy').addEventListener('click', async () => {
    if (!need()) return;
    const ok = await copyText($('report').textContent);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text and copy it yourself.' : 'Result copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('pdf').addEventListener('click', async () => {
    if (!need()) return;
    try {
      downloadBlob(
        await AbCore.buildPdf(PDFLib, current.t.name, current.t.a, current.t.b, current.r, current.t.notes),
        safeFileName(current.t.name || 'ab-test') + '.pdf',
        'application/pdf',
      );
      setStatus($('out-status'), 'PDF ready.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  $('save').addEventListener('click', () =>
    downloadBlob(AbCore.serialize(read()), safeFileName($('name').value || 'ab-test') + '.json', 'application/json'),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      write(AbCore.parse(await readText(f)));
      renderResult();
      setStatus($('out-status'), 'Test opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  renderResult();
  renderPlan();
})();
