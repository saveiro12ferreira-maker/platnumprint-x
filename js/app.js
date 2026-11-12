// Interface: liga as etapas (arquivo, peças, estampa, grade, gerar) ao motor.
const App = (() => {
  const $ = s => document.querySelector(s);
  const TYPES = { saia: 'Saia da blusa', peito: 'Peito', circ: 'Círculo', vies: 'Viés', ret: 'Retângulo', outra: 'Outra peça' };
  const RULES = { acompanha: 'Acompanha a graduação', barra: 'Segue a barra', fixa: 'Estampa fixa', esticar: 'Estica com a peça', fundo: 'Só fundo' };
  const ANCH = { left: 'esquerda', right: 'direita', center: 'centro', top: 'em cima', bottom: 'embaixo' };
  const PCT = { saia: { w: 4, h: 2 }, peito: { w: 4, h: 3 }, circ: { w: 2, h: 2 }, vies: { w: 4, h: 0 }, ret: { w: 4, h: 2 }, outra: { w: 4, h: 2 } };

  // Padrão de mercado (referência das tabelas de medidas usadas no Brasil, ABNT NBR 15800 para infantil):
  // busto e estatura de cada tamanho. A graduação de cada peça segue a proporção entre o tamanho e o tamanho base.
  // Pode corrigir qualquer número na aba Grade.
  const MERCADO = {
    '1': [52, 80], '2': [54, 92], '3': [56, 98], '4': [58, 104], '5': [60, 110], '6': [62, 116], '7': [64, 122], '8': [66, 128],
    '9': [68, 134], '10': [70, 140], '11': [73, 146], '12': [76, 152], '13': [78, 155], '14': [80, 158], '16': [84, 164],
    PP: [80, 97], P: [84, 98.5], M: [88, 100], G: [94, 101.5], GG: [100, 103], XG: [106, 104.5], XGG: [112, 106], EG: [106, 104.5], EGG: [112, 106],
    '34': [76, 97], '36': [80, 98.5], '38': [84, 99.2], '40': [88, 100], '42': [92, 100.8], '44': [96, 101.5], '46': [100, 102.3], '48': [104, 103], '50': [110, 103.8], '52': [116, 104.5], '54': [122, 105.3], '56': [128, 106],
  };
  const chaveTam = s => { const t = String(s).toUpperCase().replace(/\s+/g, ''); const m = t.match(/^(\d+)(A|ANO|ANOS)?$/); return m ? m[1] : t; };

  const st = {
    file: null, sizes: [], base: 'M', dpi: 200, an: null, pieces: [], groups: [],
    bg: [255, 255, 255], thick: 4, outline: [26, 26, 26],
    mode: 'moldes', mercado: JSON.parse(JSON.stringify(MERCADO)), marcarTamanho: true, labelMm: 4, allowRot: false, girosExtra: [], compactar: true, manterEncaixe: true, splitLong: true, autoPct: JSON.parse(JSON.stringify(PCT)), pdf: null, mapping: {}, overrides: {}, targets: {},
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
    const cs = $('#calibSize');
    if (cs) { const cur2 = cs.value; cs.replaceChildren(...st.sizes.filter(x => x !== st.base).map(x => el('option', { value: x, selected: x === cur2, text: x }))); }
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
    // O Provador é independente da grade e fica sempre liberado.
    document.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab !== 'arquivo' && t.dataset.tab !== 'provador') t.classList.toggle('locked', lock); });
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
      st.dpiCorrigido = false;
      const img = await Tiff.readImage(st.file);
      if (img.dpi) $('#dpi').value = img.dpi;
      st.dpi = Math.round(U.num($('#dpi').value)) || 200;
      if (st.bordaMm != null) st.thickOverride = Math.round(st.bordaMm / 25.4 * st.dpi);
      logStep(`Arquivo aberto: ${img.width} × ${img.height} px, ${st.dpi} dpi = ${U.fmt(U.cm(img.width, st.dpi))} × ${U.fmt(U.cm(img.height, st.dpi))} cm`);
      const an = await Analyze.run(img, st.dpi, logStep);
      img.data = null;
      st.an = an; st.pieces = an.pieces; st.bg = an.bg; st.thick = an.thick; st.outline = an.outline;
      logStep(`${an.pieces.length} peças encontradas` + (an.ignored ? ` (${an.ignored} marcas pequenas ignoradas, como textos)` : ''));
      $('#log1').lastElementChild.classList.add('done');
      $('#status1').textContent = `Leitura completa em ${U.secs(U.now() - t0)}`;
      regroup();
      nomesPadrao();
      renderAll();
      colarEtiquetas(true);   // se este arquivo já teve os nomes salvos, eles voltam para o lugar sozinhos
      lockTabs(false);
      runCheck();
      if (st.moldes) { casarMoldes(); computeTargets(); renderGrade(); renderMoldes(); }
      if (moldesPendentes) { const f = moldesPendentes; moldesPendentes = null; await onMoldes(f); }
      sugerirSalva();
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

  // Nome de cada pedaço (vai escrito pequeno junto com o tamanho). Peito: decote fundo = FRENTE, decote raso = COSTAS.
  const NOME_TIPO = { saia: 'SAIA', peito: 'FRENTE', circ: 'CÍRCULO', vies: 'VIÉS', ret: 'RETÂNGULO', outra: 'PEÇA' };
  function decote(p) {
    const a = Math.floor(p.w * 0.3), b = Math.ceil(p.w * 0.7);
    let lo = Infinity, hi = -1;
    for (let x = a; x < b; x++) { const t = p.top[x]; if (t < 0) continue; if (t < lo) lo = t; if (t > hi) hi = t; }
    return hi >= 0 ? (hi - lo) / p.h : 0;
  }
  // Topo arredondado (o meio mais alto que os lados, como a cabeça da manga) = MANGA, não é decote.
  function cupula(p) {
    const t = f => { const x = Math.min(p.w - 1, Math.floor(p.w * f)); return p.top[x] < 0 ? p.h : p.top[x]; };
    const meio = t(0.5), lados = (t(0.25) + t(0.75)) / 2;
    return lados - meio > p.h * 0.08;
  }
  function nomesPadrao() {
    for (const p of st.pieces) {
      if (p.nomeManual || p.nomePdf) continue;
      p.nome = p.type === 'peito' ? (cupula(p) ? 'MANGA' : decote(p) >= 0.1 ? 'FRENTE' : 'COSTAS') : NOME_TIPO[p.type] || 'PEÇA';
    }
  }

  function runCheck() {
    const c = Grade.selfCheck(st), box = $('#check');
    const bad = c.per.filter(p => p.score < 0.98);
    box.className = 'check ' + (bad.length ? 'alerta' : 'ok');
    box.textContent = bad.length
      ? `Conferência: refazendo o tamanho ${st.base} pelo motor, as peças ${bad.map(p => p.n).join(', ')} não bateram com o original (${bad.map(p => U.fmt(p.score * 100) + '%').join(', ')}). Confira o tipo e a regra delas.`
      : `Conferência: refazendo o tamanho ${st.base} pelo motor, o resultado bate ${U.fmt(c.score * 100)}% com o arquivo original, pixel a pixel.`;
  }

  // ---------- Peça endireitada (estava torta no arquivo): ponto da peça reta <-> ponto no arquivo ----------
  // v35 (12/11: "os nomes acompanham a linha pontilhada, não a modelagem"): a caixa e os nomes eram desenhados
  // retos em cima de uma peça que no arquivo está girada — agora seguem a peça como ela está.
  function giroDe(p) {
    if (!p.endireitada) return null;
    return p.giro0 || { a: p.endireitada * Math.PI / 180, cx: p.x + p.w / 2, cy: p.y + p.h / 2, ox: 0, oy: 0 };
  }
  function noArquivo(p, lx, ly) {
    const g = giroDe(p); if (!g) return [p.x + lx, p.y + ly];
    const dx = lx - p.w / 2 + g.ox, dy = ly - p.h / 2 + g.oy, c = Math.cos(g.a), s = Math.sin(g.a);
    return [g.cx + dx * c - dy * s, g.cy + dx * s + dy * c];
  }
  function naPeca(p, X, Y) {
    const g = giroDe(p); if (!g) return [X - p.x, Y - p.y];
    const dx = X - g.cx, dy = Y - g.cy, c = Math.cos(g.a), s = Math.sin(g.a);
    return [dx * c + dy * s + p.w / 2 - g.ox, -dx * s + dy * c + p.h / 2 - g.oy];
  }
  const giroGraus = p => p.endireitada || 0;

  // ---------- Etapa 2 ----------
  function drawPreview() {
    const an = st.an, src = an.preview, cv = el('canvas');
    cv.width = src.width; cv.height = src.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(src, 0, 0);
    const f = an.pf;
    ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeStyle = '#EF9F27';
    ctx.font = '600 13px Segoe UI, sans-serif';
    for (const p of st.pieces) {
      // caixa em volta da peça como ela está no arquivo (girada junto, se a peça está torta)
      const cs = [[-2, -2], [p.w + 2, -2], [p.w + 2, p.h + 2], [-2, p.h + 2]].map(([a, b]) => noArquivo(p, a, b).map(v => v * f));
      ctx.beginPath(); cs.forEach(([a, b], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, a, b)); ctx.closePath(); ctx.stroke();
      const topo = cs.reduce((a, c) => c[1] < a[1] ? c : a), x = topo[0] + 2, y = topo[1] + 2;   // número no canto de cima
      ctx.setLineDash([]); ctx.fillStyle = '#EF9F27'; ctx.fillRect(x - 2, y - 2, 22, 20);
      ctx.fillStyle = '#412402'; ctx.fillText(String(p.n), x + (p.n > 9 ? 1 : 5), y + 13); ctx.setLineDash([6, 4]);
    }
    $('#preview').replaceChildren(cv);
    desenharEtiquetas();
  }

  // ---------- Nome e tamanho em cada peça: arrastar para onde quiser (vale para todos os tamanhos) ----------
  const etqTexto = p => `${st.base}${st.marcarNome !== false && p.nome ? ' ' + p.nome : ''}`;
  // Textos de cada peça: juntos ("12 FRENTE") ou separados (número e nome, cada um com lugar, giro e letra próprios).
  // Chaves na peça: label* = texto junto ou o nome; num* = o número quando separado.
  function etiquetasDe(p) {
    const nome = st.marcarNome !== false && p.nome ? p.nome : '';
    if (!p.separado) return [{ k: 'label', text: etqTexto(p) }];
    const a = [{ k: 'num', text: String(st.base) }];
    if (nome) a.push({ k: 'label', text: nome });
    return a;
  }
  const mmDe = (p, k) => p[k + 'Mm'] > 0 ? p[k + 'Mm'] : (st.labelMm || 4);
  const pxDe = (p, k) => Math.max(3, Math.round(mmDe(p, k) / 25.4 * st.dpi));

  function separar(p) {
    const px = pxDe(p, 'label'), pos = p.labelPos || Grade.autoPos(p, etqTexto(p), px, p.labelRot || 0);
    const numW = String(st.base).length * px * 0.6, nomeW = (p.nome || '').length * px * 0.62, gap = px * 0.5;
    const rad = (p.labelRot || 0) * Math.PI / 180, cx = pos.fx * p.w, cy = pos.fy * p.h;
    const desl = d => ({ fx: Math.min(1, Math.max(0, (cx + Math.cos(rad) * d) / p.w)), fy: Math.min(1, Math.max(0, (cy + Math.sin(rad) * d) / p.h)) });
    p.numPos = desl(-(nomeW + gap) / 2); p.labelPos = desl((numW + gap) / 2);
    p.numRot = p.labelRot || 0; if (p.labelMm) p.numMm = p.labelMm;
    p.separado = true;
  }
  function juntar(p) { p.separado = false; delete p.numPos; delete p.numRot; delete p.numMm; }

  // ---------- Salvar o lugar dos nomes (pedido 12/11: "colar" os nomes nas peças, para não perder ao abrir de novo) ----------
  // Fica guardado neste computador, por nome de arquivo da estampa. Cada peça é achada pelo número e pela medida.
  const CHAVE_ETQ = 'ppx_lugar_nomes', CAMPOS_ETQ = ['labelPos', 'labelRot', 'labelMm', 'numPos', 'numRot', 'numMm', 'separado', 'semEtiqueta', 'nome', 'nomeManual'];
  const lerEtq = () => { try { return JSON.parse(localStorage.getItem(CHAVE_ETQ) || '{}'); } catch (e) { return {}; } };
  function salvarEtiquetas() {
    if (!st.pieces || !st.pieces.length) return;
    const tudo = lerEtq();
    tudo[fileBase()] = { em: new Date().toISOString(), pecas: st.pieces.map(p => ({ n: p.n, w: p.w, h: p.h, x: p.x, y: p.y, ...Object.fromEntries(CAMPOS_ETQ.filter(c => p[c] !== undefined).map(c => [c, p[c]])) })) };
    try { localStorage.setItem(CHAVE_ETQ, JSON.stringify(tudo)); } catch (e) { $('#etqInfo').textContent = '⚠ Não consegui salvar neste computador (memória do navegador cheia ou bloqueada).'; return; }
    const n = st.pieces.filter(p => p.labelPos || p.numPos).length;
    $('#etqInfo').textContent = `✔ Salvo: lugar dos nomes de ${st.pieces.length} peças (${n} postas à mão). Ao abrir "${fileBase()}" de novo, os nomes já vão para esses lugares.`;
  }
  function colarEtiquetas(sozinho) {
    const s = lerEtq()[fileBase()];
    if (!s || !st.pieces) { if (!sozinho) $('#etqInfo').textContent = 'Não tem lugar salvo para este arquivo ainda. Posicione os nomes e clique em "💾 Salvar o lugar dos nomes".'; return 0; }
    const perto = (a, b) => Math.abs(a - b) <= Math.max(3, b * 0.02);
    let n = 0;
    for (const p of st.pieces) {
      const q = s.pecas.find(q => q.n === p.n && perto(p.w, q.w) && perto(p.h, q.h))
        || s.pecas.filter(q => perto(p.w, q.w) && perto(p.h, q.h)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!q) continue;
      for (const c of CAMPOS_ETQ) { if (q[c] !== undefined) p[c] = q[c]; else if (c !== 'nome') delete p[c]; }
      n++;
    }
    renderPieces(); desenharEtiquetas(); agendar();
    $('#etqInfo').textContent = n ? `📌 Nomes colados no lugar salvo em ${new Date(s.em).toLocaleString('pt-BR')} (${n} de ${st.pieces.length} peças).` : 'O lugar salvo é de outro desenho (as peças não batem com este arquivo).';
    return n;
  }

  function desenharEtiquetas() {
    const box = $('#preview'), cv = box.querySelector('canvas'); if (!cv || !st.an) return;
    box.querySelectorAll('.etq').forEach(e => e.remove());
    if ($('#marcarTam') && !$('#marcarTam').checked) return;
    const f = st.an.pf;
    for (const p of st.pieces) {
      if (p.semEtiqueta) continue;
      for (const L of etiquetasDe(p)) box.append(etiquetaTela(p, L, cv, f));
    }
  }

  function etiquetaTela(p, L, cv, f) {
    const box = $('#preview'), k = L.k, P = k + 'Pos', R = k + 'Rot', M = k + 'Mm';
    const px = pxDe(p, k), pos = p[P] || Grade.autoPos(p, L.text, px, p[R] || 0);
    const d = el('div', { class: 'etq' + (p[P] || p[R] || p[M] ? ' manual' : '') + (k === 'num' ? ' num' : ''),
      title: 'Arraste para mudar de lugar · ⟳ gira (clique 15°, arraste livre, rodinha do mouse 5°) · ⤡ muda o tamanho da letra (arraste, ou Ctrl + rodinha) · ✂ separa número e nome · dois cliques escreve o nome. Vale para todos os tamanhos.', text: L.text });
    const escala = () => cv.clientWidth / cv.width;
    const pr = () => {
      const [ax, ay] = noArquivo(p, pos.fx * p.w, pos.fy * p.h);
      d.style.left = (ax * f / cv.width * 100) + '%'; d.style.top = (ay * f / cv.height * 100) + '%';
      d.style.transform = `translate(-50%, -50%) rotate(${(p[R] || 0) + giroGraus(p)}deg)`;
      d.style.fontSize = Math.max(7, pxDe(p, k) * f * escala()) + 'px';
    };
    pr();
    const marcou = () => { p[R] = ((Math.round(p[R] || 0) % 360) + 360) % 360; if (!p[P]) p[P] = { fx: pos.fx, fy: pos.fy }; d.classList.add('manual'); pr(); renderPieces(); agendar(); };
    // girar
    const giro = el('span', { class: 'giro', title: 'Clique: gira 15° · arraste: gira com o mouse · dois cliques: volta reto', text: '⟳' });
    giro.addEventListener('dblclick', ev => { ev.stopPropagation(); ev.preventDefault(); p[R] = 0; marcou(); });
    giro.addEventListener('pointerdown', ev => {
      ev.stopPropagation(); ev.preventDefault(); giro.setPointerCapture(ev.pointerId);
      const r = d.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a0 = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI, rot0 = p[R] || 0;
      let mexeu = false;
      const mover = e2 => {
        if (!mexeu && Math.hypot(e2.clientX - ev.clientX, e2.clientY - ev.clientY) < 4) return;
        mexeu = true; let v = rot0 + Math.atan2(e2.clientY - cy, e2.clientX - cx) * 180 / Math.PI - a0; if (!e2.shiftKey) v = Math.round(v / 5) * 5; p[R] = v; pr();
      };
      giro.addEventListener('pointermove', mover);
      giro.addEventListener('pointerup', () => { giro.removeEventListener('pointermove', mover); if (!mexeu) p[R] = (p[R] || 0) + 15; marcou(); }, { once: true });
    });
    // tamanho da letra
    const tam = el('span', { class: 'tam', title: 'Arraste para aumentar ou diminuir a letra · clique: +0,5 mm · dois cliques: volta ao tamanho padrão', text: '⤡' });
    tam.addEventListener('dblclick', ev => { ev.stopPropagation(); ev.preventDefault(); delete p[M]; marcou(); });
    tam.addEventListener('pointerdown', ev => {
      ev.stopPropagation(); ev.preventDefault(); tam.setPointerCapture(ev.pointerId);
      const mm0 = mmDe(p, k); let mexeu = false;
      const mover = e2 => {
        const dd = (e2.clientX - ev.clientX) + (e2.clientY - ev.clientY);
        if (!mexeu && Math.abs(dd) < 4) return;
        mexeu = true; p[M] = Math.round(Math.min(40, Math.max(0.3, mm0 * Math.pow(2, dd / 80))) * 10) / 10; pr();
      };
      tam.addEventListener('pointermove', mover);
      tam.addEventListener('pointerup', () => { tam.removeEventListener('pointermove', mover); if (!mexeu) p[M] = Math.round(Math.min(40, mm0 + (mm0 < 2 ? 0.1 : 0.5)) * 10) / 10; marcou(); }, { once: true });
    });
    // separar / juntar número e nome
    const sep = p.separado
      ? el('span', { class: 'sep', title: 'Juntar número e nome de novo', text: '🔗' })
      : (st.marcarNome !== false && p.nome ? el('span', { class: 'sep', title: 'Separar: número e nome cada um no seu lugar', text: '✂' }) : null);
    if (sep) {
      sep.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); });
      sep.addEventListener('click', ev => { ev.stopPropagation(); if (p.separado) juntar(p); else separar(p); renderPieces(); desenharEtiquetas(); agendar(); });
    }
    d.addEventListener('wheel', ev => {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) { const v = mmDe(p, k), pa = v <= 2 ? 0.1 : 0.5; p[M] = Math.round(Math.min(40, Math.max(0.3, v + (ev.deltaY > 0 ? -pa : pa))) * 10) / 10; }
      else p[R] = (p[R] || 0) + (ev.deltaY > 0 ? 5 : -5);
      marcou();
    }, { passive: false });
    d.append(giro, tam); if (sep) d.append(sep);
    // escrever o nome
    d.addEventListener('dblclick', ev => {
      if (ev.target !== d) return;
      ev.preventDefault();
      const inp = el('input', { value: p.nome || '', class: 'etq-edit', style: `left:${d.style.left};top:${d.style.top}` });
      let feito = false;
      const ok = () => { if (feito) return; feito = true; p.nome = inp.value.trim().toUpperCase(); p.nomeManual = true; inp.remove(); renderPieces(); desenharEtiquetas(); agendar(); };
      inp.addEventListener('keydown', e2 => { if (e2.key === 'Enter') ok(); if (e2.key === 'Escape') { feito = true; inp.remove(); } });
      inp.addEventListener('blur', ok, { once: true });
      box.append(inp); inp.focus(); inp.select();
    });
    // mudar de lugar
    d.addEventListener('pointerdown', ev => {
      if (ev.detail > 1 || ev.target !== d) return;
      ev.preventDefault(); d.setPointerCapture(ev.pointerId); d.classList.add('arrastando');
      const r = cv.getBoundingClientRect(), kk = cv.width / r.width / f;
      const mover = e2 => {
        const [lx, ly] = naPeca(p, (e2.clientX - r.left) * kk, (e2.clientY - r.top) * kk);
        pos.fx = Math.min(1, Math.max(0, lx / p.w)); pos.fy = Math.min(1, Math.max(0, ly / p.h)); pr();
      };
      const soltar = () => { d.removeEventListener('pointermove', mover); d.classList.remove('arrastando'); p[P] = { fx: pos.fx, fy: pos.fy }; d.classList.add('manual'); agendar(); };
      d.addEventListener('pointermove', mover); d.addEventListener('pointerup', soltar, { once: true });
    });
    return d;
  }

  function renderPieces() {
    const head = el('tr', {}, ['Nº', 'Tipo', 'Nome no pedaço', 'Escrever na peça', 'Medida (cm)', 'Estampa', 'Regra', 'Âncora'].map(t => el('th', { text: t })));
    const rows = st.pieces.map(p => el('tr', {},
      el('td', {}, el('span', { class: 'tag', text: p.n })),
      el('td', {}, el('select', { onchange: e => { p.type = e.target.value; regroup(); nomesPadrao(); renderPieces(); renderGrade(); renderAuto(); renderMap(); agendar(); } }, opts(TYPES, p.type))),
      el('td', {}, el('input', { value: p.nome || '', style: 'width:120px', title: 'Escrito pequeno no pedaço, junto com o tamanho (ex.: FRENTE, COSTAS, MANGA)',
        onchange: e => { p.nome = e.target.value.trim().toUpperCase(); p.nomeManual = true; e.target.value = p.nome; desenharEtiquetas(); agendar(); } })),
      el('td', { style: 'white-space:nowrap' },
        el('label', { title: 'Desmarque se o cliente não quer nada escrito nessa peça' }, el('input', { type: 'checkbox', checked: !p.semEtiqueta, onchange: e => { p.semEtiqueta = !e.target.checked; desenharEtiquetas(); agendar(); } }), ' sim'),
        ' ', el('button', { type: 'button', class: 'mini', title: 'Volta o nome para o lugar automático e reto', text: '↺', onclick: () => { ['labelPos', 'labelRot', 'labelMm'].forEach(c => delete p[c]); juntar(p); renderPieces(); desenharEtiquetas(); agendar(); } }),
        ' ', el('label', { title: 'Giro do nome em graus (0 = reto, 90 = em pé, 180 = de cabeça para baixo)' }, '⟳ ', el('input', { type: 'number', step: '5', value: Math.round(p.labelRot || 0), style: 'width:58px',
          onchange: e => { p.labelRot = U.num(e.target.value) || 0; desenharEtiquetas(); agendar(); } }), '°'),
        ' ', el('label', { title: 'Tamanho da letra do nome desta peça (vazio = o padrão do Gerar)' }, 'letra ', el('input', { type: 'number', step: '0.1', min: '0.3', max: '40', value: p.labelMm || '', placeholder: String(st.labelMm || 4), style: 'width:54px',
          onchange: e => { const v = U.num(e.target.value); if (v > 0) p.labelMm = v; else delete p.labelMm; desenharEtiquetas(); agendar(); } }), ' mm'),
        ' ', el('label', { title: 'Número do tamanho e nome separados, cada um no seu lugar' }, el('input', { type: 'checkbox', checked: !!p.separado, onchange: e => { if (e.target.checked) separar(p); else juntar(p); renderPieces(); desenharEtiquetas(); agendar(); } }), ' separar nº e nome')),
      el('td', { text: `${U.fmt(U.cm(p.w, st.dpi))} × ${U.fmt(U.cm(p.h, st.dpi))}` }),
      el('td', { text: p.artFrac > 0.005 ? `${U.fmt(p.artFrac * 100, 0)}% da peça` : 'sem estampa' }),
      el('td', {}, el('select', { onchange: e => { p.rule = e.target.value; p.regraManual = true; runCheck(); agendar(); } }, opts(RULES, p.rule))),
      el('td', { text: p.rule === 'barra' || p.type === 'saia' ? `barra ${ANCH[p.edge]}` : (p.artFrac > 0.005 ? `${ANCH[p.anchorX]}, ${ANCH[p.anchorY]}` : '—') }),
    ));
    $('#tblPecas').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  // ---------- Etapa 3 ----------
  function renderEstampa() {
    $('#bgColor').value = U.hex(st.bg).toLowerCase();
    $('#bgHex').textContent = U.hex(st.bg);
    $('#thick').value = st.bordaMm != null ? st.bordaMm : '';
    const withArt = st.pieces.filter(p => p.artFrac > 0.005).length;
    const mm = st.pieces.map(p => p.thick / st.dpi * 25.4), lo = Math.min(...mm), hi = Math.max(...mm);
    const faixa = Math.abs(hi - lo) < 0.05 ? `${U.fmt(lo, 1)} mm` : `de ${U.fmt(lo, 1)} a ${U.fmt(hi, 1)} mm, conforme a peça,`;
    $('#info3').textContent = `Fundo sólido ${U.hex(st.bg)}. Estampa encontrada em ${withArt} de ${st.pieces.length} peças. O contorno de corte tem ${faixa} e é redesenhado em cada tamanho com a mesma espessura.`;
    renderCores();
  }

  // ---------- Cores da estampa: trocar qualquer cor, em todas as peças ou só numa parte (pedido 12/11) ----------
  function renderCores() {
    if (!st.an) return;
    if (!st.cores || st.cores.an !== st.an) st.cores = { an: st.an, key: 'c' + Date.now(), pal: Grade.paleta(st.pieces), novas: [], regioes: [] };
    const C = st.cores;
    const caixa = (orig, nova) => el('span', { style: `display:inline-block;width:22px;height:22px;border-radius:4px;border:1px solid #888;background:${U.hex(nova || orig)}` });
    $('#coresLista').replaceChildren(...C.pal.map((x, i) => {
      const inp = el('input', { type: 'color', value: U.hex(C.novas[i] || x.c).toLowerCase(), title: 'Escolher a cor nova',
        oninput: e => { C.novas[i] = U.rgb(e.target.value); renderCores(); agendar(); } });
      return el('div', { style: 'display:flex;align-items:center;gap:4px;padding:4px 6px;border:1px solid #ddd;border-radius:8px;background:' + (C.novas[i] ? '#fff7e0' : '#fff') },
        el('span', { title: 'Cor original ' + U.hex(x.c), style: `display:inline-block;width:22px;height:22px;border-radius:4px;border:1px solid #888;background:${U.hex(x.c)}` }),
        el('span', { text: '→' }), inp,
        el('span', { class: 'muted', style: 'font-size:11px', text: `${U.fmt(x.frac * 100, x.frac < 0.01 ? 1 : 0)}%` }),
        C.novas[i] ? el('button', { type: 'button', class: 'mini', title: 'Voltar esta cor', text: '↺', onclick: () => { C.novas[i] = null; renderCores(); agendar(); } }) : '');
    }));
    // imagem para clicar numa parte
    const pv = st.an.preview, cv = $('#coresImg');
    if (pv && (cv.width !== pv.width || cv.height !== pv.height || !cv._ok)) { cv.width = pv.width; cv.height = pv.height; cv.getContext('2d').drawImage(pv, 0, 0); cv._ok = true; }
    const ctx = cv.getContext('2d'); ctx.drawImage(pv, 0, 0);
    C.regioes.forEach((r, j) => { const p = st.pieces.find(q => q.n === r.n); if (!p) return; const [x, y] = noArquivo(p, r.x, r.y).map(v => v * st.an.pf);
      ctx.fillStyle = U.hex(r.cor); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(String(j + 1), x + 9, y + 4); });
    $('#coresPartes').replaceChildren(...C.regioes.map((r, j) => el('div', { style: 'display:flex;align-items:center;gap:6px;margin:3px 0' },
      el('b', { text: `${j + 1}.` }), el('span', { text: `Peça ${r.n} — só esta parte:` }), caixa(r.orig), el('span', { text: '→' }),
      el('input', { type: 'color', value: U.hex(r.cor).toLowerCase(), oninput: e => { r.cor = U.rgb(e.target.value); renderCores(); agendar(); } }),
      el('button', { type: 'button', class: 'mini', text: '✕ tirar', onclick: () => { C.regioes.splice(j, 1); renderCores(); agendar(); } }))));
  }
  function ligarCores() {
    $('#coresVoltar').addEventListener('click', () => { if (!st.cores) return; st.cores.novas = []; st.cores.regioes = []; renderCores(); agendar(); });
    $('#coresImg').addEventListener('click', e => {
      if (!st.an || !st.cores) return;
      const cv = e.currentTarget, rc = cv.getBoundingClientRect();
      const X = (e.clientX - rc.left) * cv.width / rc.width / st.an.pf, Y = (e.clientY - rc.top) * cv.height / rc.height / st.an.pf;
      const p = st.pieces.find(q => { const [a, b] = naPeca(q, X, Y).map(Math.floor); return a >= 0 && b >= 0 && a < q.w && b < q.h && q.mask[b * q.w + a]; });
      if (!p) { alert('Aí não tem peça. Clique em cima de uma parte da estampa (listra, flor, vaso…).'); return; }
      // procura o pixel de desenho mais perto do clique (a imagem pequena perde detalhe)
      let [lx, ly] = naPeca(p, X, Y).map(Math.floor), achou = Grade.parteEm(p, st.cores, lx, ly);
      const raio = Math.ceil(3 / st.an.pf);
      for (let r = 1; !achou && r <= raio; r++) for (let dy = -r; dy <= r && !achou; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = lx + dx, y = ly + dy; if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
        const a = Grade.parteEm(p, st.cores, x, y); if (a) { achou = a; lx = x; ly = y; break; }
      }
      if (!achou) { alert('Aí é o fundo da peça. Para trocar o fundo use "Cor de fundo", logo acima.'); return; }
      const pick = $('#coresPick');
      pick.value = U.hex(achou.c).toLowerCase();
      pick.onchange = () => { st.cores.regioes.push({ n: p.n, x: lx, y: ly, orig: achou.c, cor: U.rgb(pick.value) }); renderCores(); agendar(); };
      pick.click();
    });
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

  // Graduação da modelista: com o mesmo modelo em outro tamanho já pronto, cada peça cresce/diminui o mesmo tanto a cada tamanho.
  function calibValue(g, dim, size) {
    const c = st.calib; if (!c || !c.dims[g.id]) return null;
    const ib = st.sizes.indexOf(st.base), ic = st.sizes.indexOf(c.size), is = st.sizes.indexOf(size);
    if (ib < 0 || ic < 0 || is < 0 || ib === ic) return null;
    const base = dim === 'w' ? cmW(g) : cmH(g), alvo = c.dims[g.id][dim];
    return base + (alvo - base) * (is - ib) / (ic - ib);
  }

  // ---------- Moldes da modelista (PDFs, um por tamanho) ----------
  const idxTam = size => st.sizes.indexOf(size);
  const dimsGrupo = () => st.groups.map(g => ({ w: cmW(g), h: cmH(g) }));
  function refMolde() {
    const m = st.moldes; if (!m) return null;
    const tams = Object.keys(m.tams).filter(t => idxTam(t) >= 0);
    if (!tams.length) return null;
    const ib = idxTam(st.base);
    return tams.sort((a, b) => Math.abs(idxTam(a) - ib) - Math.abs(idxTam(b) - ib))[0];
  }
  // Casa as peças do arquivo base com as do PDF mais perto do base; os outros PDFs casam com esse.
  function casarMoldes() {
    const m = st.moldes; if (!m) return;
    const ref = refMolde(); m.ref = ref; m.casa = {};
    if (!ref) return;
    const pr = m.tams[ref].pecas, auto = Moldes.casar(dimsGrupo(), pr, true);
    st.groups.forEach((g, i) => {
      const man = (m.manual || {})[g.id];
      let c = auto[i];
      // escolhido pelo formato (frente ≠ costas), quando os nomes dos moldes foram lidos
      const pf = (m.porForma || {})[g.id];
      if (pf != null && pr[pf] && (man == null)) { const p = pr[pf], d = dimsGrupo()[i]; c = { j: pf, girada: Math.abs(Math.log(p.h / p.w) + Math.log(d.w / d.h)) < Math.abs(Math.log(p.w / p.h) + Math.log(d.w / d.h)) }; }
      if (man === -1) c = null;
      else if (man != null && pr[man]) { const p = pr[man], d = dimsGrupo()[i]; c = { j: man, girada: Math.abs(Math.log(p.h / p.w) + Math.log(d.w / d.h)) < Math.abs(Math.log(p.w / p.h) + Math.log(d.w / d.h)) }; }
      m.casa[g.id] = {}; if (c) m.casa[g.id][ref] = { j: c.j, girada: c.girada };
    });
    for (const t of Object.keys(m.tams)) {
      if (t === ref) continue;
      const link = Moldes.casar(pr, m.tams[t].pecas);
      for (const g of st.groups) {
        const r = m.casa[g.id][ref]; if (!r || !link[r.j]) continue;
        m.casa[g.id][t] = { j: link[r.j].j, girada: r.girada !== link[r.j].girada };
      }
    }
  }
  function dimsMolde(g, size) {
    const m = st.moldes; if (!m || !m.tams[size] || !m.casa || !m.casa[g.id]) return null;
    const c = m.casa[g.id][size]; if (!c) return null;
    const p = m.tams[size].pecas[c.j];
    return c.girada ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
  }
  // Contorno exato de cada molde da modelista (por tamanho e por peça do arquivo), no dpi do arquivo.
  // Usado na hora de gerar: a peça sai com o formato do PDF daquele tamanho, não com a peça base esticada.
  async function prepararFormas(sizes, msg) {
    st.formas = st.formas || {};
    if (st.mode === 'tabela') {
      const chave = JSON.stringify(['tabela', st.dpi, st.base, st.sizes, st.regras]);
      if (st.formasChave !== chave) { st.formas = {}; st.formasChave = chave; }
      for (const size of sizes) {
        if (size === st.base || st.formas[size]) continue;
        const fs = {};
        for (const g of st.groups) for (const p of g.items) {
          const pol = poligonoTabela(g, size, p); if (!pol) continue;
          if (msg) msg(`Graduando pela tabela da modelista: ${size} · ${nomeGrupo(g)}…`);
          fs[p.n] = Regras.mascara(pol);
        }
        st.formas[size] = fs; await U.tick();
      }
      return;
    }
    const m = st.moldes;
    if (st.mode !== 'moldes' || !m) return;
    const chave = JSON.stringify([st.dpi, m.casa, Object.keys(m.tams)]);
    if (st.formasChave !== chave) { st.formas = {}; st.formasChave = chave; }
    for (const size of sizes) {
      // o tamanho base também sai em cima do PDF da modelista, quando ele foi enviado (a estampa do arquivo é só a base:
      // se a peça desenhada no arquivo estiver menor que o molde da Gaby, o molde manda)
      if (!m.tams[size] || st.formas[size]) continue;
      const doc = m.tams[size].pecas.doc; if (!doc) continue;
      const fs = {};
      for (const g of st.groups) {
        const c = m.casa[g.id] && m.casa[g.id][size]; if (!c) continue;
        if (msg) msg(`Desenhando o molde ${size} da modelista: ${nomeGrupo(g)}…`);
        await U.tick();
        // peças do mesmo tamanho no PDF (ex.: frente e costas): cada peça do arquivo fica com o molde de formato mais parecido
        const pz = m.tams[size].pecas, pc = pz[c.j];
        const cands = pz.map((q, j) => j).filter(j => {
          const q = pz[j], ok = (a, b) => Math.abs(a - b) / b < 0.06;
          return j === c.j || (ok(q.w, pc.w) && ok(q.h, pc.h)) || (ok(q.w, pc.h) && ok(q.h, pc.w));
        });
        const raws = {};
        for (const j of cands) raws[j] = await Moldes.forma(doc, pz[j], st.dpi);
        const usados = new Set();
        for (const p of g.items) {
          // o molde do grupo vale, a não ser que outro molde parecido coincida CLARAMENTE melhor com esta peça
          // (12/11: no tamanho 14 a frente pegava o molde da costas por uma diferença mínima)
          const fc = Moldes.orientar(raws[c.j], p.mask, p.w, p.h);
          let best = { f: fc, sc: fc.sc + 0.04, j: c.j };
          for (const j of cands) {
            if (j === c.j) continue;
            const f = Moldes.orientar(raws[j], p.mask, p.w, p.h);
            const sc = f.sc - (usados.has(j) && cands.length >= g.items.length ? 0.02 : 0);
            if (sc > best.sc) best = { f, sc, j };
          }
          usados.add(best.j); fs[p.n] = best.f;
        }
      }
      st.formas[size] = fs;
    }
  }

  function moldeValue(g, dim, size) {
    const m = st.moldes; if (!m) return null;
    const base = dim === 'w' ? cmW(g) : cmH(g);
    if (dim === 'h' && g.type === 'vies') return base;
    const db = dimsMolde(g, st.base), pts = [{ i: idxTam(st.base), v: base }];
    for (const t of Object.keys(m.tams)) {
      if (t === st.base || idxTam(t) < 0) continue;
      const d = dimsMolde(g, t); if (!d) continue;
      pts.push({ i: idxTam(t), v: db ? base + d[dim] - db[dim] : d[dim] });
    }
    return pts.length > 1 ? Moldes.interpolar(pts, idxTam(size)) : null;
  }

  // ---------- Automático da casa: aprende a graduação da modelista ----------
  // Fator de cada tamanho em relação ao 12 (largura w, comprimento h), por família de peça.
  // Começa com o que saiu da tabela do caderno dela (blusa e short, 11/11) e vai aprendendo com cada PDF de modelista lido.
  const L = (a) => Object.fromEntries(['2', '4', '6', '8', '10', '12', '14', '16'].map((s, i) => [s, a[i]]));
  const W_CORPO = L([0.820, 0.856, 0.892, 0.928, 0.964, 1, 1.038, 1.076]), H_COMP = L([0.85, 0.875, 0.90, 0.938, 0.963, 1, 1.05, 1.075]);
  const SEMENTE = {
    corpo: { w: W_CORPO, h: H_COMP }, short: { w: L([0.932, 0.946, 0.959, 0.973, 0.986, 1, 1.014, 1.027]), h: H_COMP },
    manga: { w: W_CORPO, h: H_COMP }, saia: { w: W_CORPO, h: H_COMP }, acabamento: { w: W_CORPO, h: L([1, 1, 1, 1, 1, 1, 1, 1]) },
  };
  const FAMILIAS = { corpo: 'Corpo (frente, costas, blusa)', short: 'Short / calça', manga: 'Manga', saia: 'Saia', acabamento: 'Viés, gola, cós, punho' };
  function familiaDe(g) {
    const n = (nomeGrupo(g) || '').toUpperCase();
    if (/SHORT|BERMUDA|CAL[CÇ]A|SAIA.?SHORT/.test(n)) return 'short';
    if (/MANGA/.test(n)) return 'manga';
    if (/SAIA|BABADO/.test(n)) return 'saia';
    if (/GOLA|VI[EÉ]S|PUNHO|C[OÓ]S|ALÇA|ALCA|FAIXA/.test(n)) return 'acabamento';
    if (/FRENTE|COSTA|BLUSA|CORPO|VESTIDO|BODY|PEITO|REGATA|CROPPED/.test(n)) return 'corpo';
    return g.type === 'saia' ? 'saia' : g.type === 'vies' ? 'acabamento' : 'corpo';
  }
  const CASA = 'ppx_casa_aprendida';
  const aprendido = () => { try { return JSON.parse(localStorage.getItem(CASA) || '{}'); } catch (e) { return {}; } };
  // F(família, medida, tamanho) em relação ao 12: média do aprendido (com a semente contando como 1 modelo)
  function fatorCasa(fam, dim, size) {
    const k = chaveTam(size), sem = SEMENTE[fam] && SEMENTE[fam][dim][k], ap = ((aprendido()[fam] || {})[dim] || {})[k];
    if (sem == null && !ap) return null;
    const soma = (sem != null ? sem : 0) + (ap ? ap[0] : 0), n = (sem != null ? 1 : 0) + (ap ? ap[1] : 0);
    return soma / n;
  }
  function casaValue(g, dim, size) {
    const fam = familiaDe(g), a = fatorCasa(fam, dim, size), b = fatorCasa(fam, dim, st.base);
    if (a == null || b == null) return null;
    return (dim === 'w' ? cmW(g) : cmH(g)) * a / b;
  }
  // Aprende com os PDFs da modelista: quanto cada peça mudou em cada tamanho (fica guardado neste computador)
  function aprenderDosMoldes() {
    const m = st.moldes; if (!m || !m.casa) return 0;
    const ap = aprendido(); let n = 0;
    const chave = (m.modelo || '') + '|' + Object.keys(m.tams).sort().join(',');
    ap._modelos = ap._modelos || [];
    if (ap._modelos.includes(chave)) return 0;
    ap._modelos.push(chave);
    for (const g of st.groups) {
      const fam = familiaDe(g), db = dimsMolde(g, st.base);
      const bw = db ? db.w : cmW(g), bh = db ? db.h : cmH(g);
      for (const t of Object.keys(m.tams)) {
        if (t === st.base) continue;
        const d = dimsMolde(g, t); if (!d) continue;
        for (const [dim, v, b] of [['w', d.w, bw], ['h', d.h, bh]]) {
          // grade nova (ex.: adulto P, M, G ou 36 a 46): o tamanho base vira a referência dessa família
          if (fatorCasa(fam, dim, st.base) == null) { const f0 = ((ap[fam] = ap[fam] || {})[dim] = ap[fam][dim] || {}); if (!f0[chaveTam(st.base)]) f0[chaveTam(st.base)] = [1, 1]; }
          const Fb = (() => { const sem = SEMENTE[fam] && SEMENTE[fam][dim][chaveTam(st.base)], a0 = ((ap[fam] || {})[dim] || {})[chaveTam(st.base)]; const so = (sem != null ? sem : 0) + (a0 ? a0[0] : 0), n0 = (sem != null ? 1 : 0) + (a0 ? a0[1] : 0); return n0 ? so / n0 : 1; })();
          const F = v / b * Fb, k = chaveTam(t);
          if (!(F > 0.4 && F < 2)) continue;
          const f = ((ap[fam] = ap[fam] || {})[dim] = ap[fam][dim] || {});
          f[k] = f[k] ? [f[k][0] + F, f[k][1] + 1] : [F, 1]; n++;
        }
      }
    }
    try { localStorage.setItem(CASA, JSON.stringify(ap)); } catch (e) { /* sem armazenamento: só não aprende */ }
    return n;
  }
  function renderCasa() {
    const box = $('#tblCasa'); if (!box) return;
    const sz = [...new Set([...Object.keys(W_CORPO), ...st.sizes.map(chaveTam)])].sort((a, b) => ordemTam(a) - ordemTam(b));
    const ap = aprendido();
    const head = el('tr', {}, el('th', { text: 'Família' }), el('th', { text: '' }), sz.map(s => el('th', { text: s })), el('th', { text: 'Aprendido de' }));
    const rows = Object.entries(FAMILIAS).flatMap(([fam, nome]) => ['w', 'h'].map(dim => el('tr', {},
      el('td', { text: dim === 'w' ? nome : '' }), el('td', { class: 'muted', text: dim === 'w' ? 'largura' : 'comprimento' }),
      sz.map(s => { const f = fatorCasa(fam, dim, s); return el('td', { text: f == null ? '—' : (f >= 1 ? '+' : '') + U.fmt((f - 1) * 100, 0) + '%' }); }),
      el('td', { class: 'muted', text: dim === 'w' ? (n => n ? `caderno da modelista + ${n} modelo(s)` : 'caderno da modelista')(Math.max(0, ...Object.values((ap[fam] || {}).w || {}).map(v => v[1]))) : '' }))));
    box.replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  // ---------- Tabela de graduação da modelista (pontos + DX/DY) ----------
  st.regras = {};
  const regraDoItem = (g, p) => {
    const r = st.regras[g.id]; if (!r || !r.pontos.length) return null;
    const p0 = g.items[0]; if (p === p0) return r;
    return Regras.espelhar(r, p0, p);
  };
  function poligonoTabela(g, size, p) {
    p = p || g.items[0];
    return Regras.graduar(p, regraDoItem(g, p), st.sizes, st.base, size, st.dpi);
  }
  function tabelaValue(g, dim, size) {
    const pol = poligonoTabela(g, size); if (!pol) return null;
    const bx = Regras.caixa(pol);
    return U.cm((dim === 'w' ? bx.w : bx.h) + 1, st.dpi);
  }

  // ---------- Grade salva (padrão da casa) ----------
  function casarSalva(g0) {
    const sv = g0 || st.salva; if (!sv) return null;
    const ref = sv.pecas.map(p => ({ w: p.w[sv.base], h: p.h[sv.base] }));
    return Moldes.casar(dimsGrupo(), ref);
  }
  function salvaValue(g, dim, size) {
    const sv = st.salva; if (!sv || !st.salvaCasa) return null;
    const c = st.salvaCasa[st.groups.indexOf(g)]; if (!c) return null;
    const pc = sv.pecas[c.j], dd = c.girada ? (dim === 'w' ? 'h' : 'w') : dim;
    const a = pc[dd][size], b = pc[dd][st.base];
    if (!(a > 0) || !(b > 0)) return null;
    return (dim === 'w' ? cmW(g) : cmH(g)) + a - b;
  }

  function mercadoValue(g, dim, size) {
    const a = st.mercado[chaveTam(size)], b = st.mercado[chaveTam(st.base)];
    if (!a || !b) return null;
    const base = dim === 'w' ? cmW(g) : cmH(g);
    if (dim === 'h' && g.type === 'vies') return base;               // viés: só o comprimento acompanha
    const k = dim === 'w' || g.type === 'circ' ? 0 : 1;               // largura pelo busto, altura pela estatura (círculo cresce por igual)
    return base * a[k] / b[k];
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
          } else if (st.mode === 'calib') {
            const v = calibValue(g, dim, size);
            if (v != null) { cell[dim] = v; cell.src[dim] = 'modelista'; continue; }
            const m = mercadoValue(g, dim, size);
            if (m != null) { cell[dim] = m; cell.src[dim] = 'mercado'; continue; }
            cell.src[dim] = 'auto';
          } else if (st.mode === 'moldes' || st.mode === 'salva' || st.mode === 'tabela' || st.mode === 'casa') {
            const v = st.mode === 'moldes' ? moldeValue(g, dim, size) : st.mode === 'tabela' ? tabelaValue(g, dim, size) : st.mode === 'salva' ? salvaValue(g, dim, size) : null;
            if (v != null) { cell[dim] = v; cell.src[dim] = st.mode === 'moldes' ? 'modelista' : st.mode === 'tabela' ? 'tabela' : 'salva'; continue; }
            // sem PDF / tabela dessa peça: a graduação aprendida da modelista (automático da casa)
            const c = casaValue(g, dim, size);
            if (c != null) { cell[dim] = c; cell.src[dim] = 'casa'; continue; }
            const m = mercadoValue(g, dim, size);
            if (m != null) { cell[dim] = m; cell.src[dim] = 'mercado'; continue; }
            cell.src[dim] = 'auto';
          } else if (st.mode === 'padrao') {
            const v = mercadoValue(g, dim, size);
            if (v != null) { cell[dim] = v; cell.src[dim] = 'mercado'; continue; }
            cell.src[dim] = 'auto';
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
      const inp = dim => el('input', { type: 'number', step: '0.5', value: pc[dim], oninput: e => { pc[dim] = U.num(e.target.value) || 0; computeTargets(); renderGrade(); agendar(); } });
      return el('tr', {}, el('td', { text: TYPES[t] }), el('td', {}, inp('w'), ' %'), el('td', {}, inp('h'), ' %'));
    });
    $('#tblAuto').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  function renderMercado() {
    const box = $('#tblMercado'); if (!box) return;
    const head = el('tr', {}, el('th', { text: 'Tamanho' }), el('th', { text: 'Busto (cm)' }), el('th', { text: 'Estatura / comprimento' }), el('th', { text: 'Largura ×' }), el('th', { text: 'Altura ×' }));
    const b = st.mercado[chaveTam(st.base)];
    const rows = st.sizes.map(sz => {
      const k = chaveTam(sz), m = st.mercado[k] || (st.mercado[k] = ['', '']);
      const inp = j => el('input', { type: 'number', step: '0.5', value: m[j], style: 'width:80px', onchange: e => { m[j] = U.num(e.target.value) || ''; computeTargets(); renderGrade(); renderMercado(); agendar(); } });
      const f = j => b && m[j] && b[j] ? '×' + U.fmt(m[j] / b[j], 3) : '—';
      return el('tr', {}, el('td', { text: sz + (sz === st.base ? ' (base)' : '') }), el('td', {}, inp(0)), el('td', {}, inp(1)), el('td', { text: f(0) }), el('td', { text: f(1) }));
    });
    box.replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  // Lê o encaixe da modelista em outro tamanho e casa as peças com as do arquivo base (mesmo tipo, da maior para a menor).
  async function onCalib(file) {
    const info = $('#calibInfo');
    if (!st.an) { info.textContent = 'Leia primeiro o arquivo base na aba Arquivo.'; return; }
    const size = $('#calibSize').value;
    if (!size || size === st.base) { info.textContent = 'Escolha de que tamanho é esse arquivo (diferente do tamanho base).'; return; }
    info.textContent = 'Lendo o arquivo da modelista…';
    try {
      const img = await Tiff.readImage(file);
      const dpi = img.dpi || st.dpi;
      const an = await Analyze.run(img, dpi, () => {});
      img.data = null;
      const gs = Analyze.group(an.pieces);
      const porTipo = arr => { const m = {}; arr.forEach(g => (m[g.type] = m[g.type] || []).push(g)); Object.values(m).forEach(a => a.sort((x, y) => y.w * y.h - x.w * x.h)); return m; };
      const A = porTipo(st.groups), B = porTipo(gs), dims = {}, falta = [];
      // peças que o motor classificou com tipo diferente: casa pela ordem de tamanho com as que sobraram
      const sobraA = [], sobraB = [];
      for (const t of new Set([...Object.keys(A), ...Object.keys(B)])) {
        const a = A[t] || [], b = B[t] || [];
        a.forEach((g, i) => { if (b[i]) dims[g.id] = { w: U.cm(b[i].w, dpi), h: U.cm(b[i].h, dpi) }; else sobraA.push(g); });
        b.slice(a.length).forEach(g => sobraB.push(g));
      }
      sobraA.sort((x, y) => y.w * y.h - x.w * x.h); sobraB.sort((x, y) => y.w * y.h - x.w * x.h);
      sobraA.forEach((g, i) => { if (sobraB[i]) dims[g.id] = { w: U.cm(sobraB[i].w, dpi), h: U.cm(sobraB[i].h, dpi) }; else falta.push(st.groupName(g)); });
      st.calib = { size, dims, nome: file.name };
      st.mode = 'calib'; document.querySelector('input[name=mode][value=calib]').checked = true;
      ['#autoBox', '#pdfBox', '#padraoBox'].forEach(s2 => { $(s2).hidden = true; }); $('#calibBox').hidden = false;
      computeTargets(); renderGrade(); renderCalib(); agendar();
      info.textContent = `Arquivo da modelista no ${size}: ${an.pieces.length} peças lidas. A grade agora segue a diferença real entre o ${st.base} e o ${size} de cada peça.` + (falta.length ? ` Sem par no arquivo: ${falta.join(', ')} (seguem o padrão de mercado).` : '');
    } catch (e) { console.error(e); info.textContent = 'Não consegui ler esse arquivo: ' + e.message; }
  }

  const MODOS = { padrao: '#padraoBox', auto: '#autoBox', pdf: '#pdfBox', calib: '#calibBox', moldes: '#moldesBox', salva: '#salvaBox', tabela: '#tabelaBox', casa: '#casaBox' };
  function setModo(modo) {
    st.mode = modo;
    const r = document.querySelector(`input[name=mode][value=${modo}]`); if (r) r.checked = true;
    for (const [k, sel] of Object.entries(MODOS)) { const b = $(sel); if (b) b.hidden = k !== modo; }
  }

  const ORDEM_LETRA = ['RN', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'EG', 'EGG', 'G1', 'G2', 'G3', 'G4', 'G5'];
  const ordemTam = t => /^\d+$/.test(t) ? +t : 1000 + (ORDEM_LETRA.indexOf(t) + 1 || 99);
  let moldesPendentes = null;
  async function onMoldes(files) {
    const info = $('#moldesInfo');
    $('#moldesNome').className = 'chip'; $('#moldesNome').textContent = `${files.length} PDF(s): ${files.map(f => Moldes.tamDoNome(f.name) || '?').join(', ')}`;
    // os tamanhos da grade passam a ser os dos PDFs (mais o tamanho do arquivo da estampa)
    const tams = files.map(f => Moldes.tamDoNome(f.name)).filter(Boolean);
    if (tams.length) {
      const base = $('#baseSize').value || st.base;
      // junta com os tamanhos que já estavam na grade (do mesmo tipo: número com número, letra com letra)
      const num = t => /^\d+$/.test(t), tipoPdf = num(tams[0]);
      const ja = st.sizes.filter(t => num(t) === tipoPdf);
      const todos = [...new Set([...ja, ...tams, base, ...(st.moldes ? Object.keys(st.moldes.tams) : [])])].filter(Boolean).sort((a, b) => ordemTam(a) - ordemTam(b));
      $('#sizes').value = todos.join(', '); readSizes();
      if (todos.includes(base)) { $('#baseSize').value = base; st.base = base; }
      if (st.an) { computeTargets(); renderGrade(); renderMercado(); renderQtd(); }
    }
    if (!st.an) { moldesPendentes = files; info.textContent = 'PDFs guardados: são lidos assim que você clicar em "Ler arquivo".'; $('#status1').textContent = `${files.length} PDF(s) da modelista prontos — escolha o tamanho do arquivo da estampa e clique em "Ler arquivo".`; return; }
    st.moldes = st.moldes || { tams: {}, manual: {} };
    const semTam = [];
    for (const f of files) {
      info.textContent = `Lendo ${f.name}…`; await U.tick();
      try {
        const pecas = await Moldes.ler(f);
        let t = Moldes.tamDoNome(f.name);
        if (!t || !st.sizes.includes(t)) { semTam.push(f.name + (t ? ` (tamanho ${t} não está na grade)` : '')); if (!t) continue; }
        st.moldes.tams[t] = { arquivo: f.name, pecas };
        if (!st.moldes.modelo) st.moldes.modelo = Moldes.modeloDoNome(f.name);
      } catch (e) { console.error(e); semTam.push(`${f.name}: ${e.message}`); }
    }
    casarMoldes(); setModo('moldes');
    computeTargets(); renderGrade(); renderMoldes(); agendar();
    if ($('#nomeGrade') && !$('#nomeGrade').value && st.moldes.modelo) $('#nomeGrade').value = st.moldes.modelo;
    const n = Object.keys(st.moldes.tams).length;
    info.textContent = n ? `${n} PDF(s) da modelista lidos (${Object.keys(st.moldes.tams).join(', ')}). A grade agora segue os moldes dela; tamanhos sem PDF seguem a mesma regra entre os que têm.` : 'Nenhum PDF lido.';
    if (semTam.length) info.textContent += ' Atenção: ' + semTam.join('; ') + ' — coloque o tamanho no fim do nome do arquivo (ex.: Vestido_6.pdf).';
    // conferência: tamanho menor que o base tem que ter peça menor (e maior, maior)
    const estranhas = [];
    for (const g of st.groups) for (const t of Object.keys(st.moldes.tams)) {
      const d = dimsMolde(g, t); if (!d || t === st.base) continue;
      const menor = idxTam(t) < idxTam(st.base), aB = cmW(g) * cmH(g), aM = d.w * d.h;
      if (menor ? aM > aB * 1.15 : aM < aB * 0.85) estranhas.push(`${nomeGrupo(g)} no ${t}`);
    }
    conferirDpi();
    st.aprenderPendente = !estranhas.length;
    if (estranhas.length) info.textContent += ` ⚠ Confira: ${estranhas.join(', ')} ficou com tamanho fora do esperado em relação ao ${st.base}. O arquivo da estampa e os PDFs são do mesmo modelo? Se uma peça caiu no molde errado, troque na lista abaixo.`;
    nomesDosPdfs(info);
  }

  // Com o PDF do tamanho base: a peça do arquivo da estampa tem que medir o mesmo que o molde dela.
  // Se todas estão maiores ou menores na mesma proporção, o dpi do arquivo está errado (é a causa de "saiu tudo pequeno").
  function conferirDpi() {
    const box = $('#dpiAviso'); if (!box) return; box.hidden = true; box.replaceChildren();
    if (!st.moldes || !st.moldes.tams[st.base]) return;
    const r = [];
    for (const g of st.groups) {
      const d = dimsMolde(g, st.base); if (!d || g.type === 'vies') continue;
      r.push(d.w / cmW(g), d.h / cmH(g));
    }
    if (r.length < 2) return;
    r.sort((a, b) => a - b);
    const k = r[r.length >> 1];
    if (Math.abs(k - 1) < 0.04) return;
    const novo = Math.round(st.dpi / k);
    // todas as peças erradas na mesma proporção = é o dpi: corrige sozinho (sem precisar clicar)
    const espalhado = (r[r.length - 1] - r[0]) / k;
    if (espalhado < 0.08 && !st.dpiCorrigido) { st.dpiCorrigido = true; corrigirDpi(novo); $('#moldesInfo').textContent += ` (corrigido sozinho: o arquivo estava em ${novo} dpi e não ${Math.round(novo * k)}).`; return; }
    box.hidden = false;
    box.append(el('b', { text: `⚠ As peças do arquivo da estampa estão ${U.fmt((k > 1 ? 1 - 1 / k : 1 / k - 1) * 100, 0)}% ${k > 1 ? 'MENORES' : 'MAIORES'} que o molde ${st.base} da modelista. ` }),
      el('span', { text: `O arquivo parece estar em ${novo} dpi, e o motor está lendo como ${st.dpi} dpi — por isso a grade sai ${k > 1 ? 'pequena' : 'grande'}. ` }),
      el('button', { class: 'primary mini', type: 'button', text: `Corrigir para ${novo} dpi`, onclick: () => corrigirDpi(novo) }));
  }
  function corrigirDpi(novo) {
    st.dpi = novo; $('#dpi').value = novo;
    if (st.bordaMm != null) st.thickOverride = Math.round(st.bordaMm / 25.4 * st.dpi);
    casarMoldes(); computeTargets(); renderAll(); renderMoldes(); conferirDpi(); agendar();
    $('#moldesInfo').textContent = `dpi corrigido para ${novo}. Agora o ${st.base} do arquivo bate com o molde da modelista.`;
  }

  // Lê o nome escrito em cada molde do PDF (ex.: "FRENTE 2X - 6 - 6" → FRENTE) e escreve na peça da estampa.
  // ---------- Tela da tabela de graduação ----------
  let tabSel = 0;   // ponto selecionado
  function grupoTab() { const v = $('#tabPeca').value; return st.groups.find(g => g.id === v) || st.groups[0]; }
  function renderTabela() {
    const selP = $('#tabPeca'); if (!selP || !st.groups.length) return;
    const cur = selP.value;
    selP.replaceChildren(...st.groups.map(g => el('option', { value: g.id, selected: g.id === cur, text: `${nomeGrupo(g)} ×${g.items.length} (${U.fmt(cmW(g))} × ${U.fmt(cmH(g))} cm)${st.regras[g.id] && st.regras[g.id].pontos.length ? ' · ' + st.regras[g.id].pontos.length + ' pontos' : ''}` })));
    const g = grupoTab(); if (!g) return;
    const r = st.regras[g.id] || (st.regras[g.id] = { pontos: [] });
    desenharTab(g);
    const outros = st.sizes.filter(s => s !== st.base);
    const head = el('tr', {}, el('th', { text: 'Ponto' }), el('th', { text: 'Nome' }), outros.map(s => el('th', { text: s, colspan: 2 })), el('th', { text: '' }));
    const sub = el('tr', {}, el('th'), el('th'), outros.flatMap(() => [el('th', { text: 'DX' }), el('th', { text: 'DY' })]), el('th'));
    const rows = r.pontos.map((q, k) => el('tr', { class: k === tabSel ? 'sel' : '', onclick: () => { tabSel = k; renderTabela(); } },
      el('td', {}, el('b', { text: 'P' + (k + 1) })),
      el('td', {}, el('input', { value: q.nome || '', style: 'width:90px', placeholder: 'ex.: ombro', onchange: e => { q.nome = e.target.value; } })),
      outros.flatMap(s => [0, 1].map(d => el('td', {}, el('input', { type: 'number', step: '0.05', class: 'dxy', value: q.tab[s] && q.tab[s][d] !== '' && q.tab[s][d] != null ? q.tab[s][d] : '',
        onchange: e => { const v = e.target.value === '' ? '' : U.num(e.target.value); q.tab[s] = q.tab[s] || ['', '']; q.tab[s][d] = v; tabMudou(g); } })))),
      el('td', {}, el('button', { type: 'button', class: 'mini', title: 'Tirar este ponto', text: '✕', onclick: ev => { ev.stopPropagation(); r.pontos.splice(k, 1); tabSel = 0; tabMudou(g); renderTabela(); } }))));
    $('#tblRegras').replaceChildren(el('thead', {}, head, sub), el('tbody', {}, rows));
    $('#tabInfo').textContent = r.pontos.length ? `${r.pontos.length} ponto(s). Clique no contorno para pôr mais um ponto; clique numa linha para escolher o ponto.` : 'Clique em "Pontos nos cantos" ou clique no contorno da peça para marcar os pontos de graduação.';
  }
  function tabMudou(g) {
    st.formasChave = null;
    if (st.mode !== 'tabela') setModo('tabela');
    computeTargets(); renderGrade(); desenharTab(g); agendar();
  }
  function desenharTab(g) {
    const cv = $('#tabCanvas'); if (!cv || !g) return;
    const p = g.items[0], r = st.regras[g.id] || { pontos: [] }, c = Regras.contorno(p);
    const menor = st.sizes[0], maior = st.sizes[st.sizes.length - 1];
    const pols = [menor, maior].filter(s => s !== st.base).map(s => ({ s, pol: Regras.graduar(p, r, st.sizes, st.base, s, st.dpi) })).filter(x => x.pol);
    let bx = { x0: 0, y0: 0, x1: p.w, y1: p.h };
    for (const { pol } of pols) { const b = Regras.caixa(pol); bx = { x0: Math.min(bx.x0, b.x0), y0: Math.min(bx.y0, b.y0), x1: Math.max(bx.x1, b.x1), y1: Math.max(bx.y1, b.y1) }; }
    const pad = 20, maxW = Math.min(620, ($('#tabelaBox').clientWidth || 620) - 10), f = Math.min(maxW / (bx.x1 - bx.x0), 440 / (bx.y1 - bx.y0)) * 0.92;
    cv.width = Math.round((bx.x1 - bx.x0) * f + 2 * pad); cv.height = Math.round((bx.y1 - bx.y0) * f + 2 * pad);
    const ctx = cv.getContext('2d'), X = x => (x - bx.x0) * f + pad, Y = y => (y - bx.y0) * f + pad;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    // a peça com a estampa
    const tmp = document.createElement('canvas'); tmp.width = p.w; tmp.height = p.h;
    const id = tmp.getContext('2d').createImageData(p.w, p.h); id.data.set(p.rgba); tmp.getContext('2d').putImageData(id, 0, 0);
    ctx.globalAlpha = 0.55; ctx.drawImage(tmp, X(0), Y(0), p.w * f, p.h * f); ctx.globalAlpha = 1;
    const linha = (pts, cor, larg) => { ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(y))); ctx.closePath(); ctx.stroke(); };
    pols.forEach(({ s, pol }) => linha(pol, s === menor ? '#ef4444' : '#16a34a', 1.5));
    linha(c, '#111', 2);
    r.pontos.forEach((q, k) => {
      const [x, y] = c[q.i]; ctx.fillStyle = k === tabSel ? '#f59e0b' : '#2563eb';
      ctx.beginPath(); ctx.arc(X(x), Y(y), 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P' + (k + 1), X(x), Y(y));
    });
    ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left';
    pols.forEach(({ s }, k) => { ctx.fillStyle = s === menor ? '#ef4444' : '#16a34a'; ctx.fillText(`— tamanho ${s}`, 8, 14 + k * 15); });
    ctx.fillStyle = '#111'; ctx.fillText(`— tamanho ${st.base} (arquivo)`, 8, 14 + pols.length * 15);
    cv._map = { f, pad, bx };
  }
  function cliqueTab(ev) {
    const g = grupoTab(); if (!g) return;
    const cv = $('#tabCanvas'), mp = cv._map; if (!mp) return;
    const rc = cv.getBoundingClientRect(), k = cv.width / rc.width;
    const x = ((ev.clientX - rc.left) * k - mp.pad) / mp.f + mp.bx.x0, y = ((ev.clientY - rc.top) * k - mp.pad) / mp.f + mp.bx.y0;
    const p = g.items[0], c = Regras.contorno(p), r = st.regras[g.id] || (st.regras[g.id] = { pontos: [] });
    const perto = r.pontos.findIndex(q => Math.hypot(c[q.i][0] - x, c[q.i][1] - y) * mp.f < 12);
    if (perto >= 0) { tabSel = perto; renderTabela(); return; }
    const i = Regras.pontoPerto(p, x / p.w, y / p.h);
    if (Math.hypot(c[i][0] - x, c[i][1] - y) * mp.f > 25) return;
    r.pontos.push({ i, nome: '', tab: {} }); r.pontos.sort((a, b) => a.i - b.i);
    tabSel = r.pontos.findIndex(q => q.i === i); renderTabela();
  }
  function cantosTab() {
    const g = grupoTab(); if (!g) return;
    const r = st.regras[g.id] || (st.regras[g.id] = { pontos: [] });
    for (const i of Regras.cantos(g.items[0])) if (!r.pontos.some(q => q.i === i)) r.pontos.push({ i, nome: '', tab: {} });
    r.pontos.sort((a, b) => a.i - b.i); renderTabela();
  }
  function preencherTab() {
    const g = grupoTab(); if (!g) return;
    const r = st.regras[g.id]; if (!r || !r.pontos[tabSel]) { $('#tabInfo').textContent = 'Escolha um ponto primeiro (clique nele ou na linha da tabela).'; return; }
    const q = r.pontos[tabSel], v = id => { const t = $(id).value; return t === '' ? '' : U.num(t); };
    const ib = st.sizes.indexOf(st.base);
    st.sizes.forEach((s, i) => { if (i < ib) q.tab[s] = [v('#tabMenDx'), v('#tabMenDy')]; else if (i > ib) q.tab[s] = [v('#tabMaiDx'), v('#tabMaiDy')]; });
    tabMudou(g); renderTabela();
  }

  async function nomesDosPdfs(info) {
    const m = st.moldes; if (!m || !m.ref) return;
    const ref = m.ref, pz = m.tams[ref].pecas, doc = pz.doc; if (!doc) return;
    const txt0 = info.textContent;
    try {
      for (let j = 0; j < pz.length; j++) {
        if (pz[j].rotulo !== undefined) continue;
        info.textContent = txt0 + ` Lendo os nomes escritos nos moldes (${j + 1} de ${pz.length})…`;
        const f = await Moldes.forma(doc, pz[j], 150, { texto: true });
        pz[j].rotulo = await Moldes.lerNome(f.texto);
        pz[j].mini = f;   // forma pequena para saber qual peça do arquivo é qual
      }
      // cada peça do arquivo: o molde de formato mais parecido entre os do grupo (frente ≠ costas)
      let n = 0, trocou = false;
      for (const g of st.groups) {
        const c = m.casa[g.id] && m.casa[g.id][ref]; if (!c) continue;
        const pc = pz[c.j], ok = (a, b) => Math.abs(a - b) / b < 0.06;
        const cands = pz.map((q, j) => j).filter(j => j === c.j || (ok(pz[j].w, pc.w) && ok(pz[j].h, pc.h)) || (ok(pz[j].w, pc.h) && ok(pz[j].h, pc.w)));
        const votos = {};
        for (const p of g.items) {
          let best = null;
          for (const j of cands) { const o = Moldes.orientar(pz[j].mini, p.mask, p.w, p.h); if (!best || o.sc > best.sc) best = { j, sc: o.sc }; }
          votos[best.j] = (votos[best.j] || 0) + 1;
          const r = pz[best.j].rotulo;
          if (r && r.nome && !p.nomeManual) { p.nome = r.nome; p.nomePdf = true; n++; }
        }
        // o molde também passa a ser o de formato mais parecido (antes era só pela medida: frente e costas trocavam)
        const jv = +Object.keys(votos).sort((a, b) => votos[b] - votos[a])[0];
        if (jv !== c.j) { (m.porForma = m.porForma || {})[g.id] = jv; trocou = true; }
      }
      if (trocou) { casarMoldes(); computeTargets(); renderGrade(); }
      renderPieces(); desenharEtiquetas(); renderMoldes(); agendar();
      info.textContent = txt0 + (n ? ` ✔ Nomes dos moldes copiados para ${n} peça(s).` : ' (Não consegui ler os nomes escritos nos moldes; escreva na peça com dois cliques.)');
    } catch (e) { console.error(e); info.textContent = txt0 + ' (Não consegui ler os nomes dos moldes: ' + e.message + ')'; }
    // depois de saber o nome de cada peça: o automático da casa aprende com este modelo (uma vez por modelo)
    if (st.aprenderPendente) {
      st.aprenderPendente = false;
      if (aprenderDosMoldes()) { info.textContent += ' 🧠 O automático da casa aprendeu a graduação deste modelo.'; renderCasa(); }
    }
  }

  function renderMoldes() {
    const box = $('#tblMoldes'); if (!box) return;
    const m = st.moldes;
    if (!m || !m.ref) { box.replaceChildren(); return; }
    const tams = Object.keys(m.tams).sort((a, b) => idxTam(a) - idxTam(b));
    const pr = m.tams[m.ref].pecas;
    const head = el('tr', {}, el('th', { text: 'Peça do arquivo' }), el('th', { text: `Molde (PDF ${m.ref})` }), el('th', { text: 'Nome no molde' }), tams.map(t => el('th', { text: `PDF ${t}` })));
    const rows = st.groups.map(g => {
      const c = m.casa[g.id][m.ref];
      const sel = el('select', { onchange: e => { m.manual[g.id] = +e.target.value; casarMoldes(); computeTargets(); renderGrade(); renderMoldes(); agendar(); } },
        el('option', { value: -1, selected: !c, text: '— nenhum (segue mercado) —' }),
        pr.map((p, j) => el('option', { value: j, selected: c && c.j === j, text: `Molde ${j + 1}: ${p.rotulo ? p.rotulo.nome + ' · ' : ''}${U.fmt(p.w)} × ${U.fmt(p.h)} cm` })));
      const rot = c && pr[c.j].rotulo;
      return el('tr', {}, el('td', { text: `${nomeGrupo(g)} ×${g.items.length} (${U.fmt(cmW(g))} × ${U.fmt(cmH(g))})` }), el('td', {}, sel),
        el('td', { text: rot ? rot.texto : (pr[0] && pr[0].rotulo === undefined ? 'lendo…' : '—') }),
        tams.map(t => { const d = dimsMolde(g, t); return el('td', { text: d ? `${U.fmt(d.w)} × ${U.fmt(d.h)}` : '—' }); }));
    });
    box.replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  const nomeGrupo = g => (g.items[0] && g.items[0].nome) || st.groupName(g);
  const CONF = ['roll', 'margin', 'gap', 'bordaMm', 'bleed', 'labelMm', 'girosExtra', 'labelCor', 'corelQualidade'], CONFCHK = ['marcarTam', 'marcarNome', 'allowRot', 'splitLong', 'compactar', 'manterEncaixe', 'labelCorAuto'];

  function salvarGrade() {
    const nome = ($('#nomeGrade').value || '').trim();
    if (!nome) { $('#salvarInfo').textContent = 'Escreva o nome do modelo (ex.: Vestido Antonella).'; return; }
    const ant = Moldes.lista()[nome];
    const g = {
      nome, base: st.base, sizes: [...st.sizes], salvo: new Date().toISOString(), usos: ant ? (ant.usos || 0) : 0,
      origem: st.mode === 'moldes' && st.moldes ? 'moldes da modelista: ' + Object.values(st.moldes.tams).map(t => t.arquivo).join(', ') : st.mode,
      pecas: st.groups.map(gr => ({ nome: nomeGrupo(gr), tipo: gr.type, qtd: gr.items.length,
        regras: st.regras[gr.id] && st.regras[gr.id].pontos.length ? { pontos: st.regras[gr.id].pontos.map(q => { const c = Regras.contorno(gr.items[0])[q.i]; return { fx: c[0] / gr.items[0].w, fy: c[1] / gr.items[0].h, nome: q.nome, tab: q.tab }; }) } : null,
        w: Object.fromEntries(st.sizes.map(sz => [sz, +st.targets[gr.id][sz].w.toFixed(2)])),
        h: Object.fromEntries(st.sizes.map(sz => [sz, +st.targets[gr.id][sz].h.toFixed(2)])) })),
      config: Object.assign(Object.fromEntries(CONF.map(id => [id, $('#' + id).value])), Object.fromEntries(CONFCHK.map(id => [id, $('#' + id).checked]))),
    };
    if (!Moldes.salvar(g)) { $('#salvarInfo').textContent = 'Não consegui salvar neste navegador (armazenamento cheio ou bloqueado). Use "Exportar grades".'; return; }
    $('#salvarInfo').textContent = `✔ Grade "${nome}" salva${ant ? ' (atualizada)' : ''}. Da próxima vez que abrir um arquivo parecido, o motor oferece essa grade sozinho.`;
    renderSalvas();
  }

  function usarSalva(nome, comConfig = true) {
    const sv = Moldes.lista()[nome]; if (!sv) return;
    st.salva = sv; st.salvaCasa = casarSalva(sv);
    if (comConfig && sv.config) {
      for (const id of CONF) if (sv.config[id] != null && $('#' + id)) $('#' + id).value = sv.config[id];
      for (const id of CONFCHK) if (sv.config[id] != null && $('#' + id)) $('#' + id).checked = sv.config[id];
      $('#bordaMm').dispatchEvent(new Event('change'));
      readOut(); desenharEtiquetas();
    }
    sv.usos = (sv.usos || 0) + 1; Moldes.salvar(sv);
    // a grade salva tem a tabela da modelista: volta a graduar pelos pontos (o formato certo de cada tamanho)
    let comTabela = false;
    st.groups.forEach((g, i) => {
      const c = st.salvaCasa[i], pc = c && sv.pecas[c.j];
      if (pc && pc.regras && pc.regras.pontos.length) { st.regras[g.id] = { pontos: pc.regras.pontos.map(q => ({ i: Regras.pontoPerto(g.items[0], q.fx, q.fy), nome: q.nome, tab: q.tab })) }; comTabela = true; }
    });
    setModo(comTabela ? 'tabela' : 'salva'); renderSalvas(); renderTabela();
    if ($('#nomeGrade')) $('#nomeGrade').value = nome;
    computeTargets(); renderGrade(); agendar();
    const sem = st.groups.filter((g, i) => !st.salvaCasa[i]).map(nomeGrupo);
    $('#salvaInfo').textContent = `Usando a grade salva "${nome}" (base ${sv.base}, tamanhos ${sv.sizes.join(', ')}) e as configurações dela.` + (sem.length ? ` Sem par na grade salva: ${sem.join(', ')} (seguem o mercado).` : '');
  }

  function renderSalvas() {
    const sel = $('#selSalva'); if (!sel) return;
    const l = Object.values(Moldes.lista()).sort((a, b) => (b.salvo || '').localeCompare(a.salvo || ''));
    const cur = st.salva && st.salva.nome;
    sel.replaceChildren(el('option', { value: '', text: l.length ? '— escolha um modelo —' : '— nenhuma grade salva ainda —' }),
      l.map(g => el('option', { value: g.nome, selected: g.nome === cur, text: `${g.nome} · base ${g.base} · ${g.pecas.length} peças · ${(g.salvo || '').slice(0, 10).split('-').reverse().join('/')}` })));
    sel.value = cur && l.some(g => g.nome === cur) ? cur : '';
    $('#qtdSalvas').textContent = l.length ? `${l.length} modelo(s) salvo(s) neste computador` : '';
  }

  // Depois de ler o arquivo: se parece com um modelo já salvo, oferece a grade dele.
  function sugerirSalva() {
    const box = $('#sugestao'); if (!box) return;
    box.replaceChildren(); box.hidden = true;
    let melhor = null;
    for (const sv of Object.values(Moldes.lista())) {
      if (!sv.pecas || !sv.pecas[0] || !sv.pecas[0].w[sv.base]) continue;
      const res = casarSalva(sv), ok = res.filter(Boolean);
      if (ok.length < Math.max(1, Math.ceil(st.groups.length * 0.7)) || Math.abs(sv.pecas.length - st.groups.length) > 1) continue;
      const custo = ok.reduce((a, c) => a + c.custo, 0) / ok.length;
      if (custo < 0.15 && (!melhor || custo < melhor.custo)) melhor = { sv, custo };
    }
    if (!melhor) return;
    box.hidden = false;
    box.append(el('span', { text: `💡 Esse arquivo parece o modelo "${melhor.sv.nome}" (grade salva, base ${melhor.sv.base}). ` }),
      el('button', { class: 'primary mini', type: 'button', text: 'Usar essa grade', onclick: () => { usarSalva(melhor.sv.nome); box.hidden = true; showTab('grade'); } }),
      el('button', { class: 'mini', type: 'button', text: 'Não', onclick: () => { box.hidden = true; } }));
  }

  function renderCalib() {
    const box = $('#tblCalib'); if (!box) return;
    if (!st.calib) { box.replaceChildren(); return; }
    const c = st.calib, steps = st.sizes.indexOf(c.size) - st.sizes.indexOf(st.base);
    const head = el('tr', {}, ['Peça', `${st.base} (arquivo base)`, `${c.size} (modelista)`, 'Muda a cada tamanho'].map(t => el('th', { text: t })));
    const rows = st.groups.map(g => {
      const d = c.dims[g.id];
      const passo = d && steps ? `${U.fmt((d.w - cmW(g)) / steps)} × ${U.fmt((d.h - cmH(g)) / steps)} cm` : '—';
      return el('tr', {}, el('td', { text: `${st.groupName(g)} ×${g.items.length}` }), el('td', { text: `${U.fmt(cmW(g))} × ${U.fmt(cmH(g))}` }),
        el('td', { text: d ? `${U.fmt(d.w)} × ${U.fmt(d.h)}` : 'sem par' }), el('td', { text: passo }));
    });
    box.replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
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
    const badge = src => src === 'modelista' ? el('span', { class: 'src manual', text: 'modelista' }) : src === 'salva' ? el('span', { class: 'src manual', text: 'salva' }) : src === 'tabela' ? el('span', { class: 'src manual', text: 'tabela' }) : src === 'casa' ? el('span', { class: 'src pdf', text: 'automático' }) : src === 'mercado' ? el('span', { class: 'src pdf', text: 'mercado' }) : src === 'manual' ? el('span', { class: 'src manual', text: 'manual' }) : src === 'pdf' ? el('span', { class: 'src pdf', text: 'PDF' }) : src === 'falta' ? el('span', { class: 'src falta', text: 'falta no PDF' }) : null;
    const rows = st.groups.map(g => el('tr', {},
      el('td', {}, `${st.groupName(g)} `, el('span', { class: 'muted', text: `×${g.items.length} (nº ${g.items.map(p => p.n).join(', ')})` })),
      st.sizes.map(size => {
        const t = st.targets[g.id][size];
        if (size === st.base) return el('td', { class: 'cell', text: `${U.fmt(t.w)} × ${U.fmt(t.h)}` });
        const inp = dim => el('input', { type: 'number', step: '0.1', value: t[dim].toFixed(1), onchange: e => {
          const v = U.num(e.target.value);
          const o = (st.overrides[g.id] = st.overrides[g.id] || {})[size] = (st.overrides[g.id][size] || {});
          if (v > 0) o[dim] = v; else delete o[dim];
          computeTargets(); renderGrade(); agendar();
        } });
        const srcs = [...new Set([t.src.w, t.src.h])].map(badge);
        return el('td', { class: 'cell' }, inp('w'), el('span', { class: 'x', text: '×' }), inp('h'), srcs);
      })));
    $('#tblGrade').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  function renderAll() {
    renderTabela(); renderCasa();
    drawPreview(); renderPieces(); renderEstampa(); renderAuto(); renderMercado(); renderMap(); renderGrade();
  }

  // ---------- Etapa 5 ----------
  function readOut() {
    st.rollCm = U.num($('#roll').value) || 150;
    st.marginMm = U.num($('#margin').value) || 0;
    st.gapMm = U.num($('#gap').value) || 0;
    st.bleedMm = U.num($('#bleed').value) || 0;
    st.allowRot = $('#allowRot').checked;
    st.girosExtra = Grade.lerGiros($('#girosExtra').value);
    st.compactar = $('#compactar').checked;
    st.manterEncaixe = $('#manterEncaixe').checked;
    st.splitLong = $('#splitLong').checked;
    st.marcarTamanho = $('#marcarTam').checked;
    st.marcarNome = $('#marcarNome').checked;
    st.labelMm = U.num($('#labelMm').value) || 4;
    st.corelQualidade = ($('#corelQualidade') && $('#corelQualidade').value) || 'semperda';
    st.labelCor = $('#labelCorAuto') && !$('#labelCorAuto').checked ? U.rgb($('#labelCor').value) : null;
  }

  function fileBase() { return (st.file ? st.file.name.replace(/\.[^.]+$/, '') : 'grade').replace(/[\\/:*?"<>|]/g, '_'); }

  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  async function exportSize(size) {
    readOut(); await prepararFormas([size]);
    $('#status5').textContent = `Montando o TIFF do ${size}…`; await U.tick();
    const r = await Grade.renderSize(st, size);
    download(Tiff.writeRGB(r.w, r.h, r.rgb, st.dpi), `${fileBase()}_${size}.tif`);
    $('#status5').textContent = `TIFF do ${size} pronto (${U.fmt(U.cm(r.w, st.dpi))} × ${U.fmt(U.cm(r.h, st.dpi))} cm).`;
  }

  async function exportCorel(size) {
    readOut(); await prepararFormas([size]);
    const r = await Corel.svgSize(st, size, t => { $('#status5').textContent = t; });
    download(r, `${fileBase()}_${size}_corel.svg`);
    $('#status5').textContent = `Arquivo do Corel do tamanho ${size} pronto. No CorelDRAW: Arquivo → Importar. Cada pedaço vem separado (estampa, linha de corte e número do tamanho).`;
  }
  async function corelTodos() { for (const size of Object.keys(st.results)) await exportCorel(size); }

  // Opção mudou depois de gerar: refaz sozinho para valer exatamente o que está marcado.
  let tAgenda = null, gerando = false, deNovo = false;
  function agendar() {
    if (!Object.keys(st.results).length) return;
    clearTimeout(tAgenda);
    if (!$('#autoRefazer').checked) { $('#status5').textContent = '⚠ Você mudou alguma coisa: clique em "Gerar grade" para refazer com o que está marcado.'; $('#status5').classList.add('pendente'); return; }
    $('#status5').textContent = 'Opção mudou: refazendo a grade com o que está marcado…';
    tAgenda = setTimeout(() => { if (gerando) deNovo = true; else gerar(); }, 700);
  }

  async function gerar() {
    if (gerando) { deNovo = true; return; }
    $('#status5').classList.remove('pendente');
    gerando = true;
    try { await gerar_(); } finally { gerando = false; if (deNovo) { deNovo = false; gerar(); } }
  }

  async function gerar_() {
    readOut();
    await prepararFormas(st.sizes, t => { $('#status5').textContent = t; });
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
        st.results[size] = { w: r.w, h: r.h, ms: r.ms, pos: r.pos, assin: r.assin };
        // Sem avisos de grade: o motor já resolve sozinho. Só aparece o que precisa de outra largura de rolo.
        const fisicos = r.warns.filter(w => w.lvl === 'alerta');
        const warns = fisicos.length ? el('ul', {}, fisicos.map(w => el('li', { class: w.lvl, text: w.txt })))
          : el('p', { class: 'ok-line', text: `✔ Pronto${r.rotated ? ` · ${r.rotated} pedaço(s) girado(s)` : ' · nenhum pedaço girado'}${st.marcarTamanho ? ` · tamanho ${size}${st.marcarNome ? ' e nome' : ''} marcado em cada pedaço` : ''}` });
        $('#results').append(el('div', { class: 'res' },
          el('h4', { text: `Tamanho ${size}${size === st.base ? ' (base)' : ''}` }),
          el('div', { class: 'muted', text: `${r.pieces} peças · encaixe ${U.fmt(U.cm(r.w, st.dpi))} × ${U.fmt(U.cm(r.h, st.dpi))} cm · montado em ${U.secs(r.ms)}` }),
          pv.canvas, warns,
          el('div', { class: 'row', style: 'margin:6px 0 0' },
            el('button', { text: `Baixar TIFF ${size}`, onclick: () => exportSize(size) }),
            el('button', { text: `✏️ Corel editável ${size}`, title: 'Cada pedaço separado: estampa, linha de corte e número do tamanho', onclick: () => exportCorel(size) }))));
        await U.tick();
      }
      $('#status5').textContent = `Grade completa: ${sizes.length} tamanhos em ${U.secs(U.now() - t0)}.`;
      $('#btnTodos').disabled = false; $('#btnCorelTodos').disabled = false; $('#btnEncaixe').disabled = false;
      renderQtd();
    } catch (e) {
      console.error(e);
      $('#status5').textContent = 'Erro ao gerar: ' + e.message;
    } finally { $('#btnGerar').disabled = false; }
  }

  const qtd = {};
  function renderQtd() {
    const box = $('#qtdTam'); if (!box) return;
    box.replaceChildren(...st.sizes.map(sz => el('label', { class: 'qtd' }, `${sz} `, el('input', { type: 'number', min: '0', step: '1', value: qtd[sz] != null ? qtd[sz] : 1, style: 'width:56px',
      onchange: e => { qtd[sz] = Math.max(0, Math.round(U.num(e.target.value) || 0)); } }))));
    st.sizes.forEach(sz => { if (qtd[sz] == null) qtd[sz] = 1; });
  }
  let encaixeBlob = null;
  async function montarEncaixe() {
    readOut(); await prepararFormas(st.sizes, t => { $('#statusEnc').textContent = t; });
    const q = {}; st.sizes.forEach(sz => { q[sz] = qtd[sz] != null ? qtd[sz] : 1; });
    if (!Object.values(q).some(v => v > 0)) { $('#statusEnc').textContent = 'Coloque pelo menos 1 peça em algum tamanho.'; return; }
    $('#btnEncaixe').disabled = true; $('#encRes').replaceChildren();
    try {
      const r = await Grade.encaixeGrade(st, q, t => { $('#statusEnc').textContent = t; });
      encaixeBlob = r.blob;
      const m = U.cm(r.h, st.dpi) / 100;
      const porTam = Object.entries(q).filter(([, v]) => v > 0).map(([k, v]) => `${k}${v > 1 ? ' ×' + v : ''}`).join(', ');
      const fis = r.warns.filter(w => w.lvl === 'alerta');
      $('#encRes').replaceChildren(
        el('div', { class: 'enc-num' }, el('b', { text: U.fmt(m, 2) + ' m' }), el('span', { text: `de tecido com ${U.fmt(st.rollCm / 100, 2)} m de largura` })),
        el('p', { class: 'muted', text: `${r.pieces} pedaços (${porTam}) · encaixe ${U.fmt(U.cm(r.w, st.dpi))} × ${U.fmt(U.cm(r.h, st.dpi))} cm · ${r.rotated ? r.rotated + ' girado(s)' : 'nenhum girado'} · montado em ${U.secs(r.ms)}` }),
        r.preview,
        fis.length ? el('ul', {}, fis.map(w => el('li', { class: 'alerta', text: w.txt }))) : null,
        el('button', { class: 'primary', text: '⬇ Baixar TIFF do encaixe', onclick: () => download(encaixeBlob, `${fileBase()}_encaixe_grade_${U.fmt(m, 2).replace(',', '-')}m.tif`) }));
      $('#statusEnc').textContent = `Encaixe pronto: ${U.fmt(m, 2)} m.`;
    } catch (e) { console.error(e); $('#statusEnc').textContent = 'Erro no encaixe: ' + e.message; }
    finally { $('#btnEncaixe').disabled = false; }
  }

  async function baixarTodos() {
    for (const size of Object.keys(st.results)) await exportSize(size);
  }

  // ---------- Início ----------
  function init() {
    readSizes(); renderQtd();
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      if (t.classList.contains('locked')) { $('#status1').textContent = 'Leia um arquivo primeiro para liberar as outras abas.'; showTab('arquivo'); return; }
      showTab(t.dataset.tab);
    }));
    $('#fBase').addEventListener('change', e => setFile(e.target.files[0] || null));
    $('#sizes').addEventListener('change', () => { readSizes(); if (st.an) { computeTargets(); renderGrade(); renderMercado(); } renderQtd(); });
    $('#baseSize').addEventListener('change', () => { st.base = $('#baseSize').value; if (st.an) { computeTargets(); renderGrade(); renderMercado(); runCheck(); } });
    $('#btnLer').addEventListener('click', ler);
    ligarCores();
    $('#etqSalvar').addEventListener('click', salvarEtiquetas);
    $('#etqColar').addEventListener('click', () => colarEtiquetas(false));
    $('#bgColor').addEventListener('input', e => { st.bg = U.rgb(e.target.value); $('#bgHex').textContent = U.hex(st.bg); agendar(); });
    const setBorda = txt => {
      const v = U.num(txt);
      st.bordaMm = String(txt).trim() === '' || !(v >= 0) ? null : v;
      st.thickOverride = st.bordaMm == null ? null : Math.round(st.bordaMm / 25.4 * st.dpi);
      $('#thick').value = st.bordaMm == null ? '' : st.bordaMm; $('#bordaMm').value = st.bordaMm == null ? '' : st.bordaMm;
    };
    setBorda($('#bordaMm').value);
    $('#bordaMm').addEventListener('change', e => { setBorda(e.target.value); agendar(); });
    $('#thick').addEventListener('change', e => {
      setBorda(e.target.value);
      agendar();
    });
    document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', e => {
      setModo(e.target.value);
      if (st.mode === 'salva' && !st.salva && $('#selSalva').value) usarSalva($('#selSalva').value);
      computeTargets(); renderGrade(); agendar();
    }));
    $('#fPdf').addEventListener('change', e => { if (e.target.files[0]) onPdf(e.target.files[0]); });
    $('#fCalib').addEventListener('change', e => { if (e.target.files[0]) onCalib(e.target.files[0]); });
    $('#fMoldes').addEventListener('change', e => { if (e.target.files.length) onMoldes([...e.target.files]); e.target.value = ''; });
    $('#fMoldes2').addEventListener('change', e => { if (e.target.files.length) onMoldes([...e.target.files]); e.target.value = ''; });
    $('#btnMoldesLimpar').addEventListener('click', () => { st.moldes = null; $('#moldesInfo').textContent = 'PDFs tirados.'; renderMoldes(); computeTargets(); renderGrade(); agendar(); });
    $('#btnSalvarGrade').addEventListener('click', salvarGrade);
    $('#tabPeca').addEventListener('change', () => { tabSel = 0; renderTabela(); });
    $('#tabCanvas').addEventListener('click', cliqueTab);
    $('#btnTabCantos').addEventListener('click', cantosTab);
    $('#btnTabLimpar').addEventListener('click', () => { const g = grupoTab(); if (!g) return; st.regras[g.id] = { pontos: [] }; tabSel = 0; tabMudou(g); renderTabela(); });
    $('#btnTabPreencher').addEventListener('click', preencherTab);
    $('#selSalva').addEventListener('change', e => { if (e.target.value) usarSalva(e.target.value); });
    $('#btnExcluirSalva').addEventListener('click', () => {
      const n = $('#selSalva').value; if (!n) return;
      if (!confirm(`Apagar a grade salva "${n}" deste computador?`)) return;
      Moldes.excluir(n); if (st.salva && st.salva.nome === n) { st.salva = null; st.salvaCasa = null; computeTargets(); renderGrade(); }
      renderSalvas(); $('#salvaInfo').textContent = `Grade "${n}" apagada.`;
    });
    $('#btnExportarSalvas').addEventListener('click', () => download(new Blob([JSON.stringify(Moldes.lista(), null, 1)], { type: 'application/json' }), 'grades-salvas-platnumprint-x.json'));
    $('#fImportarSalvas').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const n = Moldes.importar(await f.text()); renderSalvas(); $('#salvaInfo').textContent = `${n} grade(s) importada(s).`; }
      catch (er) { $('#salvaInfo').textContent = 'Arquivo inválido: ' + er.message; }
      e.target.value = '';
    });
    renderSalvas();
    $('#btnLimpar').addEventListener('click', () => { st.overrides = {}; computeTargets(); renderGrade(); });
    $('#btnGerar').addEventListener('click', gerar);
    $('#btnTodos').addEventListener('click', baixarTodos);
    $('#btnCorelTodos').addEventListener('click', corelTodos);
    $('#btnEncaixe').addEventListener('click', montarEncaixe);
    // Qualquer opção do Gerar mudou: refaz sozinho (obedece o que está marcado).
    ['#roll', '#margin', '#gap', '#bleed', '#allowRot', '#girosExtra', '#compactar', '#manterEncaixe', '#splitLong', '#incBase', '#marcarTam', '#marcarNome', '#labelMm', '#labelCor', '#labelCorAuto'].forEach(id => $(id).addEventListener('change', agendar));
    ['#marcarTam', '#marcarNome', '#labelMm'].forEach(id => $(id).addEventListener('change', () => { readOut(); desenharEtiquetas(); }));
    $('#semNomeTodas').addEventListener('click', () => { st.pieces.forEach(p => { p.semEtiqueta = true; }); renderPieces(); desenharEtiquetas(); agendar(); });
    $('#comNomeTodas').addEventListener('click', () => { st.pieces.forEach(p => { p.semEtiqueta = false; }); renderPieces(); desenharEtiquetas(); agendar(); });
    $('#nomeAutoTodas').addEventListener('click', () => { st.pieces.forEach(p => { delete p.labelPos; }); desenharEtiquetas(); agendar(); });
    window.addEventListener('resize', () => desenharEtiquetas());

    // Abrir um arquivo por endereço (?src=...), útil para testes no computador.
    const src = new URLSearchParams(location.search).get('src');
    if (src) fetch(src).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => setFile(new File([b], decodeURIComponent(src.split('/').pop()))))
      .catch(e => { $('#fBaseName').textContent = 'Não consegui abrir ' + src + ' (' + e.message + ')'; });
  }

  init();
  return { st, onPdf, gerar, ler, showTab, removeFile, removePdf, el, prepararFormas };
})();
