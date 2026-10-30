// Interface: liga as etapas (arquivo, peças, estampa, grade, gerar) ao motor.
const App = (() => {
  const $ = s => document.querySelector(s);
  const TYPES = { saia: 'Saia da blusa', peito: 'Peito', circ: 'Círculo', vies: 'Viés', ret: 'Retângulo', outra: 'Outra peça' };
  const RULES = { barra: 'Segue a barra', fixa: 'Estampa fixa', esticar: 'Estica com a peça', fundo: 'Só fundo' };
  const ANCH = { left: 'esquerda', right: 'direita', center: 'centro', top: 'em cima', bottom: 'embaixo' };
  const PCT = { saia: { w: 4, h: 2 }, peito: { w: 4, h: 3 }, circ: { w: 2, h: 2 }, vies: { w: 4, h: 0 }, ret: { w: 4, h: 2 }, outra: { w: 4, h: 2 } };

  const st = {
    file: null, sizes: [], base: 'M', dpi: 200, an: null, pieces: [], groups: [],
    bg: [255, 255, 255], thick: 4, outline: [26, 26, 26],
    mode: 'auto', autoPct: JSON.parse(JSON.stringify(PCT)), pdf: null, mapping: {}, overrides: {}, targets: {},
    rollCm: 150, marginMm: 10, gapMm: 10, bleedMm: 0, results: {},
    groupName: g => TYPES[g.type] + (g.letter ? ' ' + g.letter : ''),
  };

  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && e.append(k));
    return e;
  };
  const opts = (map, cur) => Object.entries(map).map(([v, t]) => el('option', { value: v, selected: v === cur, text: t }));
  const cmW = g => U.cm(g.w, st.dpi), cmH = g => U.cm(g.h, st.dpi);

  // ---------- Etapa 1 ----------
  function readSizes() {
    const list = $('#sizes').value.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    st.sizes = [...new Set(list)];
    const cur = $('#baseSize').value || st.base;
    $('#baseSize').replaceChildren(...st.sizes.map(s => el('option', { value: s, selected: s === cur, text: s })));
    st.base = $('#baseSize').value;
  }

  function setFile(file) {
    st.file = file;
    const chip = $('#fBaseName');
    if (file) {
      chip.className = 'chip';
      chip.replaceChildren(`${file.name} · ${U.fmt(file.size / 1048576)} MB`, el('button', { class: 'x', type: 'button', title: 'Remover arquivo', text: '✕ Remover', onclick: removeFile }));
    } else {
      chip.className = 'chip empty';
      chip.textContent = 'Nenhum arquivo escolhido';
    }
    $('#btnLer').disabled = !file;
  }

  // Tira o arquivo base e tudo que foi lido dele; as abas voltam a ficar travadas.
  function removeFile() {
    if (busy) return;
    $('#fBase').value = '';
    setFile(null);
    Object.assign(st, { an: null, pieces: [], groups: [], targets: {}, overrides: {}, results: {} });
    $('#log1').replaceChildren();
    $('#status1').textContent = '';
    ['#preview', '#tblPecas', '#tblAuto', '#tblGrade', '#results'].forEach(s => $(s).replaceChildren());
    $('#check').className = 'check'; $('#check').textContent = '';
    $('#status5').textContent = '';
    lockTabs(true);
    showTab('arquivo');
    window.dispatchEvent(new CustomEvent('pp:limpo'));
  }

  function removePdf() {
    $('#fPdf').value = '';
    st.pdf = null; st.mapping = {};
    $('#pdfName').className = 'chip empty'; $('#pdfName').textContent = 'Nenhum PDF escolhido';
    ['#pdfInfo', '#tblPdf', '#tblMap'].forEach(s => $(s).replaceChildren());
    if (st.an) { computeTargets(); renderGrade(); }
  }

  // ---------- Abas ----------
  function showTab(name) {
    const tab = document.querySelector(`.tab[data-tab="${name}"]`);
    if (!tab || tab.classList.contains('locked')) return;
    document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('on', t === tab); t.setAttribute('aria-selected', t === tab); });
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.dataset.panel === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('pp:aba', { detail: name }));
  }

  function lockTabs(lock) {
    document.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab !== 'arquivo') t.classList.toggle('locked', lock); });
  }

  function logStep(txt) {
    const li = el('li', { text: txt });
    const prev = $('#log1').lastElementChild; if (prev) prev.classList.add('done');
    $('#log1').append(li);
  }

  let busy = false;
  async function ler() {
    if (busy) return;
    busy = true;
    $('#btnLer').disabled = true;
    $('#log1').replaceChildren();
    const t0 = U.now();
    try {
      logStep('Abrindo o arquivo…'); await U.tick();
      const img = await Tiff.readImage(st.file);
      if (img.dpi) $('#dpi').value = img.dpi;
      st.dpi = Math.round(U.num($('#dpi').value)) || 200;
      logStep(`Arquivo aberto: ${img.width} × ${img.height} px, ${st.dpi} dpi = ${U.fmt(U.cm(img.width, st.dpi))} × ${U.fmt(U.cm(img.height, st.dpi))} cm`);
      const an = await Analyze.run(img, st.dpi, logStep);
      img.data = null;
      st.an = an; st.pieces = an.pieces; st.bg = an.bg; st.thick = an.thick; st.outline = an.outline;
      logStep(`${an.pieces.length} peças encontradas` + (an.ignored ? ` (${an.ignored} marcas pequenas ignoradas, como textos)` : ''));
      $('#log1').lastElementChild.classList.add('done');
      $('#status1').textContent = `Leitura completa em ${U.secs(U.now() - t0)}`;
      regroup();
      renderAll();
      lockTabs(false);
      runCheck();
      window.dispatchEvent(new CustomEvent('pp:lido'));
      if ($('#autoGerar').checked) {
        // Um clique só: lê e já monta todos os tamanhos da grade.
        showTab('gerar');
        busy = false;
        await gerar();
        $('#status1').textContent = `Leitura e grade completa em ${U.secs(U.now() - t0)}. ${$('#check').textContent}`;
      } else showTab('pecas');
    } catch (e) {
      console.error(e);
      $('#log1').append(el('li', { class: 'err', text: 'Não consegui ler o arquivo: ' + e.message }));
    } finally { busy = false; $('#btnLer').disabled = !st.file; }
  }

  function runCheck() {
    const c = Grade.selfCheck(st), box = $('#check');
    const bad = c.per.filter(p => p.score < 0.98);
    box.className = 'check ' + (bad.length ? 'alerta' : 'ok');
    box.textContent = bad.length
      ? `Conferência: refazendo o tamanho ${st.base} pelo motor, as peças ${bad.map(p => p.n).join(', ')} não bateram com o original (${bad.map(p => U.fmt(p.score * 100) + '%').join(', ')}). Confira o tipo e a regra delas.`
      : `Conferência: refazendo o tamanho ${st.base} pelo motor, o resultado bate ${U.fmt(c.score * 100)}% com o arquivo original, pixel a pixel.`;
  }

  // ---------- Etapa 2 ----------
  function drawPreview() {
    const an = st.an, src = an.preview, cv = el('canvas');
    cv.width = src.width; cv.height = src.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(src, 0, 0);
    const f = an.pf;
    ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeStyle = '#EF9F27';
    ctx.font = '600 13px Segoe UI, sans-serif';
    for (const p of st.pieces) {
      const x = p.x * f, y = p.y * f, w = p.w * f, h = p.h * f;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      ctx.setLineDash([]); ctx.fillStyle = '#EF9F27'; ctx.fillRect(x - 2, y - 2, 22, 20);
      ctx.fillStyle = '#412402'; ctx.fillText(String(p.n), x + (p.n > 9 ? 1 : 5), y + 13); ctx.setLineDash([6, 4]);
    }
    $('#preview').replaceChildren(cv);
  }

  function renderPieces() {
    const head = el('tr', {}, ['Nº', 'Tipo', 'Medida (cm)', 'Estampa', 'Regra', 'Âncora'].map(t => el('th', { text: t })));
    const rows = st.pieces.map(p => el('tr', {},
      el('td', {}, el('span', { class: 'tag', text: p.n })),
      el('td', {}, el('select', { onchange: e => { p.type = e.target.value; regroup(); renderGrade(); renderAuto(); renderMap(); } }, opts(TYPES, p.type))),
      el('td', { text: `${U.fmt(U.cm(p.w, st.dpi))} × ${U.fmt(U.cm(p.h, st.dpi))}` }),
      el('td', { text: p.artFrac > 0.005 ? `${U.fmt(p.artFrac * 100, 0)}% da peça` : 'sem estampa' }),
      el('td', {}, el('select', { onchange: e => { p.rule = e.target.value; runCheck(); } }, opts(RULES, p.rule))),
      el('td', { text: p.rule === 'barra' || p.type === 'saia' ? `barra ${ANCH[p.edge]}` : (p.artFrac > 0.005 ? `${ANCH[p.anchorX]}, ${ANCH[p.anchorY]}` : '—') }),
    ));
    $('#tblPecas').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  // ---------- Etapa 3 ----------
  function renderEstampa() {
    $('#bgColor').value = U.hex(st.bg).toLowerCase();
    $('#bgHex').textContent = U.hex(st.bg);
    $('#thick').value = st.thickOverride != null ? (st.thickOverride / st.dpi * 25.4).toFixed(2) : '';
    const withArt = st.pieces.filter(p => p.artFrac > 0.005).length;
    const mm = st.pieces.map(p => p.thick / st.dpi * 25.4), lo = Math.min(...mm), hi = Math.max(...mm);
    const faixa = Math.abs(hi - lo) < 0.05 ? `${U.fmt(lo, 1)} mm` : `de ${U.fmt(lo, 1)} a ${U.fmt(hi, 1)} mm, conforme a peça,`;
    $('#info3').textContent = `Fundo sólido ${U.hex(st.bg)}. Estampa encontrada em ${withArt} de ${st.pieces.length} peças. O contorno de corte tem ${faixa} e é redesenhado em cada tamanho com a mesma espessura.`;
  }

  // ---------- Etapa 4 ----------
  function regroup() {
    st.groups = Analyze.group(st.pieces);
    computeTargets();
  }

  function autoValue(g, dim, size) {
    const steps = st.sizes.indexOf(size) - st.sizes.indexOf(st.base);
    const pct = (st.autoPct[g.type] || st.autoPct.outra)[dim];
    const base = dim === 'w' ? cmW(g) : cmH(g);
    return base * (1 + pct / 100 * steps);
  }

  function pdfValue(g, dim, size) {
    const m = (st.mapping[g.id] || {})[dim];
    if (!st.pdf || !m || m.kind === 'auto') return null;
    const med = st.pdf.medidas[m.med];
    if (!med) return null;
    if (m.kind === 'direto') return med[size] > 0 ? med[size] : null;
    const base = dim === 'w' ? cmW(g) : cmH(g);
    if (!(med[size] > 0) || !(med[st.base] > 0)) return null;
    return base * med[size] / med[st.base];
  }

  function computeTargets() {
    st.targets = {};
    for (const g of st.groups) {
      const t = st.targets[g.id] = {};
      for (const size of st.sizes) {
        if (size === st.base) { t[size] = { w: cmW(g), h: cmH(g), src: { w: 'base', h: 'base' } }; continue; }
        const cell = { src: {} };
        for (const dim of ['w', 'h']) {
          const ov = ((st.overrides[g.id] || {})[size] || {})[dim];
          if (ov > 0) { cell[dim] = ov; cell.src[dim] = 'manual'; continue; }
          if (st.mode === 'pdf') {
            const m = (st.mapping[g.id] || {})[dim];
            const v = pdfValue(g, dim, size);
            if (v != null) { cell[dim] = v; cell.src[dim] = 'pdf'; continue; }
            cell.src[dim] = m && m.kind !== 'auto' ? 'falta' : 'auto';
          } else cell.src[dim] = 'auto';
          cell[dim] = autoValue(g, dim, size);
        }
        t[size] = cell;
      }
    }
  }

  function renderAuto() {
    const types = [...new Set(st.groups.map(g => g.type))];
    const head = el('tr', {}, el('th', { text: 'Tipo de peça' }), el('th', { text: 'Largura por tamanho' }), el('th', { text: 'Altura por tamanho' }));
    const rows = types.map(t => {
      const pc = st.autoPct[t] || (st.autoPct[t] = { ...PCT.outra });
      const inp = dim => el('input', { type: 'number', step: '0.5', value: pc[dim], oninput: e => { pc[dim] = U.num(e.target.value) || 0; computeTargets(); renderGrade(); } });
      return el('tr', {}, el('td', { text: TYPES[t] }), el('td', {}, inp('w'), ' %'), el('td', {}, inp('h'), ' %'));
    });
    $('#tblAuto').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  async function onPdf(file) {
    $('#pdfName').className = 'chip';
    $('#pdfName').replaceChildren(file.name, el('button', { class: 'x', type: 'button', title: 'Remover PDF', text: '✕ Remover', onclick: removePdf }));
    $('#pdfInfo').replaceChildren(el('p', { class: 'muted', text: 'Lendo o PDF…' }));
    try {
      const rows = await PdfGrade.readRows(file);
      const res = PdfGrade.parse(rows);
      if (!res) {
        st.pdf = null;
        $('#pdfInfo').replaceChildren(el('p', { class: 'err', text: rows.length
          ? 'Li o texto do PDF, mas não achei uma tabela com tamanhos (P, M, G…) e números. Se o PDF for só desenho do molde, digite as medidas direto na tabela abaixo.'
          : 'Esse PDF não tem texto (parece ser imagem ou desenho). Digite as medidas direto na tabela abaixo.' }));
        $('#tblPdf').replaceChildren(); $('#tblMap').replaceChildren();
        return;
      }
      st.pdf = res;
      const missing = st.sizes.filter(s => !res.sizes.includes(s));
      const info = [el('p', { class: 'muted', text: `Tabela encontrada (${res.formato}): ${Object.keys(res.medidas).length} medidas, tamanhos ${res.sizes.join(', ')}. Confira os números; dá para corrigir qualquer um.` })];
      if (missing.length) info.push(el('p', { class: 'err' }, `O PDF não tem os tamanhos ${missing.join(', ')} da sua grade. `,
        el('button', { text: 'Usar os tamanhos do PDF', onclick: () => { $('#sizes').value = res.sizes.join(', '); readSizes(); computeTargets(); renderGrade(); renderPdfTable(); } })));
      $('#pdfInfo').replaceChildren(...info);
      guessMapping();
      renderPdfTable(); renderMap();
      computeTargets(); renderGrade();
    } catch (e) {
      console.error(e);
      $('#pdfInfo').replaceChildren(el('p', { class: 'err', text: 'Não consegui ler o PDF: ' + e.message }));
    }
  }

  function guessMapping() {
    const names = Object.keys(st.pdf.medidas);
    const find = re => names.find(n => re.test(n));
    for (const g of st.groups) {
      const wRe = g.type === 'peito' ? /busto|t[oó]rax|peito/i : g.type === 'saia' ? /cintura|quadril|barra|saia/i : /busto|cintura|largura/i;
      const hRe = /compr|altura/i;
      const w = g.type === 'circ' ? null : find(wRe), h = g.type === 'circ' || g.type === 'vies' ? null : find(hRe);
      st.mapping[g.id] = { w: w ? { kind: 'prop', med: w } : { kind: 'auto' }, h: h ? { kind: 'prop', med: h } : { kind: 'auto' } };
    }
  }

  function renderPdfTable() {
    if (!st.pdf) return;
    const sizes = st.pdf.sizes;
    const head = el('tr', {}, el('th', { text: 'Medida da modelista' }), sizes.map(s => el('th', { text: s })));
    const rows = Object.entries(st.pdf.medidas).map(([name, vals]) => el('tr', {}, el('td', { text: name }),
      sizes.map(s => el('td', {}, el('input', { type: 'number', step: '0.1', value: vals[s] != null ? vals[s] : '',
        oninput: e => { const v = U.num(e.target.value); if (v > 0) vals[s] = v; else delete vals[s]; computeTargets(); renderGrade(); } })))));
    $('#tblPdf').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  function renderMap() {
    if (!st.pdf) { $('#tblMap').replaceChildren(); return; }
    const names = Object.keys(st.pdf.medidas);
    const choice = (g, dim) => {
      const m = (st.mapping[g.id] = st.mapping[g.id] || { w: { kind: 'auto' }, h: { kind: 'auto' } })[dim];
      const cur = m.kind === 'auto' ? 'auto' : m.kind + '|' + m.med;
      const o = [el('option', { value: 'auto', selected: cur === 'auto', text: 'Automático (%)' })];
      names.forEach(n => {
        o.push(el('option', { value: 'prop|' + n, selected: cur === 'prop|' + n, text: `Proporcional a ${n}` }));
        o.push(el('option', { value: 'direto|' + n, selected: cur === 'direto|' + n, text: `Igual a ${n}` }));
      });
      return el('select', { onchange: e => { const [kind, ...rest] = e.target.value.split('|'); st.mapping[g.id][dim] = kind === 'auto' ? { kind } : { kind, med: rest.join('|') }; computeTargets(); renderGrade(); } }, o);
    };
    const head = el('tr', {}, el('th', { text: 'Peça' }), el('th', { text: 'Largura segue' }), el('th', { text: 'Altura segue' }));
    const rows = st.groups.map(g => el('tr', {}, el('td', { text: `${st.groupName(g)} ×${g.items.length}` }), el('td', {}, choice(g, 'w')), el('td', {}, choice(g, 'h'))));
    const cap = el('caption', { class: 'hint', style: 'text-align:left', text: 'Qual medida da modelista comanda cada peça. O motor já sugeriu pelos nomes das medidas; confira antes de gerar. "Proporcional" mantém a proporção do tamanho lido; "Igual a" usa o número do PDF como medida da peça.' });
    $('#tblMap').replaceChildren(cap, el('thead', {}, head), el('tbody', {}, rows));
  }

  function renderGrade() {
    const head = el('tr', {}, el('th', { text: 'Peça' }), st.sizes.map(s => el('th', { text: s + (s === st.base ? ' (lido)' : '') })));
    const badge = src => src === 'manual' ? el('span', { class: 'src manual', text: 'manual' }) : src === 'pdf' ? el('span', { class: 'src pdf', text: 'PDF' }) : src === 'falta' ? el('span', { class: 'src falta', text: 'falta no PDF' }) : null;
    const rows = st.groups.map(g => el('tr', {},
      el('td', {}, `${st.groupName(g)} `, el('span', { class: 'muted', text: `×${g.items.length} (nº ${g.items.map(p => p.n).join(', ')})` })),
      st.sizes.map(size => {
        const t = st.targets[g.id][size];
        if (size === st.base) return el('td', { class: 'cell', text: `${U.fmt(t.w)} × ${U.fmt(t.h)}` });
        const inp = dim => el('input', { type: 'number', step: '0.1', value: t[dim].toFixed(1), onchange: e => {
          const v = U.num(e.target.value);
          const o = (st.overrides[g.id] = st.overrides[g.id] || {})[size] = (st.overrides[g.id][size] || {});
          if (v > 0) o[dim] = v; else delete o[dim];
          computeTargets(); renderGrade();
        } });
        const srcs = [...new Set([t.src.w, t.src.h])].map(badge);
        return el('td', { class: 'cell' }, inp('w'), el('span', { class: 'x', text: '×' }), inp('h'), srcs);
      })));
    $('#tblGrade').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  function renderAll() {
    drawPreview(); renderPieces(); renderEstampa(); renderAuto(); renderMap(); renderGrade();
  }

  // ---------- Etapa 5 ----------
  function readOut() {
    st.rollCm = U.num($('#roll').value) || 150;
    st.marginMm = U.num($('#margin').value) || 0;
    st.gapMm = U.num($('#gap').value) || 0;
    st.bleedMm = U.num($('#bleed').value) || 0;
    st.allowRot = $('#allowRot').checked;
    st.splitLong = $('#splitLong').checked;
  }

  function fileBase() { return (st.file ? st.file.name.replace(/\.[^.]+$/, '') : 'grade').replace(/[\\/:*?"<>|]/g, '_'); }

  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  async function exportSize(size) {
    readOut();
    $('#status5').textContent = `Montando o TIFF do ${size}…`; await U.tick();
    const r = await Grade.renderSize(st, size);
    download(Tiff.writeRGB(r.w, r.h, r.rgb, st.dpi), `${fileBase()}_${size}.tif`);
    $('#status5').textContent = `TIFF do ${size} pronto (${U.fmt(U.cm(r.w, st.dpi))} × ${U.fmt(U.cm(r.h, st.dpi))} cm).`;
  }

  async function gerar() {
    readOut();
    const bad = st.groups.flatMap(g => st.sizes.filter(s => !(st.targets[g.id][s].w > 0 && st.targets[g.id][s].h > 0)).map(s => `${st.groupName(g)} ${s}`));
    if (bad.length) { $('#status5').textContent = `Faltam medidas válidas: ${bad.join(', ')}.`; return; }
    if (st.bleedMm * 2 > st.gapMm) { $('#status5').textContent = 'O espaço entre peças precisa ser pelo menos o dobro da sangria, senão as sangrias se encostam.'; return; }
    const sizes = st.sizes.filter(s => s !== st.base || $('#incBase').checked);
    $('#btnGerar').disabled = true; $('#btnTodos').disabled = true;
    $('#results').replaceChildren();
    const t0 = U.now();
    try {
      for (const size of sizes) {
        const total = st.pieces.length;
        const r = await Grade.renderSize(st, size, k => { $('#status5').textContent = `Tamanho ${size}: peça ${k} de ${total}…`; });
        const pv = U.preview(r.rgb, r.w, r.h, 3, 700);
        r.rgb = null;
        st.results[size] = { w: r.w, h: r.h, ms: r.ms };
        const warns = r.warns.length ? el('ul', {}, r.warns.map(w => el('li', { class: w.lvl, text: w.txt }))) : el('p', { class: 'muted', text: 'Sem avisos.' });
        $('#results').append(el('div', { class: 'res' },
          el('h4', { text: `Tamanho ${size}${size === st.base ? ' (base)' : ''}` }),
          el('div', { class: 'muted', text: `${r.pieces} peças · encaixe ${U.fmt(U.cm(r.w, st.dpi))} × ${U.fmt(U.cm(r.h, st.dpi))} cm · montado em ${U.secs(r.ms)}` }),
          pv.canvas, warns,
          el('button', { text: `Baixar TIFF ${size}`, onclick: () => exportSize(size) })));
        await U.tick();
      }
      $('#status5').textContent = `Grade completa: ${sizes.length} tamanhos em ${U.secs(U.now() - t0)}.`;
      $('#btnTodos').disabled = false;
    } catch (e) {
      console.error(e);
      $('#status5').textContent = 'Erro ao gerar: ' + e.message;
    } finally { $('#btnGerar').disabled = false; }
  }

  async function baixarTodos() {
    for (const size of Object.keys(st.results)) await exportSize(size);
  }

  // ---------- Início ----------
  function init() {
    readSizes();
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      if (t.classList.contains('locked')) { $('#status1').textContent = 'Leia um arquivo primeiro para liberar as outras abas.'; showTab('arquivo'); return; }
      showTab(t.dataset.tab);
    }));
    $('#fBase').addEventListener('change', e => setFile(e.target.files[0] || null));
    $('#sizes').addEventListener('change', () => { readSizes(); if (st.an) { computeTargets(); renderGrade(); } });
    $('#baseSize').addEventListener('change', () => { st.base = $('#baseSize').value; if (st.an) { computeTargets(); renderGrade(); runCheck(); } });
    $('#btnLer').addEventListener('click', ler);
    $('#bgColor').addEventListener('input', e => { st.bg = U.rgb(e.target.value); $('#bgHex').textContent = U.hex(st.bg); });
    $('#thick').addEventListener('change', e => {
      const v = U.num(e.target.value);
      st.thickOverride = e.target.value.trim() === '' || !(v >= 0) ? null : Math.round(v / 25.4 * st.dpi);
    });
    document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', e => {
      st.mode = e.target.value; $('#autoBox').hidden = st.mode !== 'auto'; $('#pdfBox').hidden = st.mode !== 'pdf';
      computeTargets(); renderGrade();
    }));
    $('#fPdf').addEventListener('change', e => { if (e.target.files[0]) onPdf(e.target.files[0]); });
    $('#btnLimpar').addEventListener('click', () => { st.overrides = {}; computeTargets(); renderGrade(); });
    $('#btnGerar').addEventListener('click', gerar);
    $('#btnTodos').addEventListener('click', baixarTodos);

    // Abrir um arquivo por endereço (?src=...), útil para testes no computador.
    const src = new URLSearchParams(location.search).get('src');
    if (src) fetch(src).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => setFile(new File([b], decodeURIComponent(src.split('/').pop()))))
      .catch(e => { $('#fBaseName').textContent = 'Não consegui abrir ' + src + ' (' + e.message + ')'; });
  }

  init();
  return { st, onPdf, gerar, ler, showTab, removeFile, removePdf, el };
})();
