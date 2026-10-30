// Provador: lê a foto do manequim, acha onde cada peça do arquivo está e veste a modelo, com ajuste manual.
const Provador = (() => {
  const $ = s => document.querySelector(s);
  const el = App.el, st = App.st;
  const VIEWS = { frente: 'Frente', costas: 'Costas', lado: 'Lateral' };
  // Área da roupa (do ombro ao short) em cada pose da modelo padrão, em fração da foto.
  const AREA = { frente: { x: .22, y: .17, w: .56, h: .42 }, costas: { x: .22, y: .17, w: .56, h: .43 }, lado: { x: .24, y: .17, w: .52, h: .43 } };
  const MIN_SCORE = 0.62;

  const pv = {
    models: [{ id: 'padrao', name: 'Modelo padrão', views: {}, fixed: true }],
    model: 'padrao', view: 'frente',
    mq: { frente: null, lado: null, costas: null },
    found: [], layers: { frente: [], costas: [], lado: [] }, sel: null, art: {}, base: {}, only: {},
    disp: 1, drag: null, mode: 'el', gid: 0,
  };
  const MQ_VIEWS = ['frente', 'lado', 'costas'];
  // Arquivo de estampa do Provador: separado da grade. Pode ser qualquer arquivo, ou o mesmo da grade.
  let src = { name: '', pieces: [], groups: [], bg: [255, 255, 255], dpi: 200, fromGrade: false };
  const cur = () => pv.models.find(m => m.id === pv.model);
  const layers = () => pv.layers[pv.view];

  const loadImg = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Não consegui abrir a imagem.')); i.src = src; });
  const fileImg = async file => { const url = URL.createObjectURL(file); const img = await loadImg(url); return { img, url, name: file.name }; };

  // ---------- Estampas do arquivo ----------
  // Cada peça vira três imagens sem o contorno preto de corte: completa (fundo e estampa),
  // só o fundo, e só a estampa (fundo transparente), que depois é separada em elementos.
  function buildArt() {
    pv.art = {}; pv.base = {}; pv.only = {};
    for (const p of src.pieces) {
      const f = Math.min(1, 900 / Math.max(p.w, p.h)), w = Math.max(1, Math.round(p.w * f)), h = Math.max(1, Math.round(p.h * f));
      const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); return { c, ctx, id: ctx.createImageData(w, h) }; };
      const full = mk(), base = mk(), only = mk();
      for (let y = 0; y < h; y++) {
        const sy = Math.min(p.h - 1, Math.floor((y + .5) / f));
        for (let x = 0; x < w; x++) {
          const sx = Math.min(p.w - 1, Math.floor((x + .5) / f)), i = sy * p.w + sx, q = (y * w + x) * 4;
          if (!p.mask[i]) continue;
          const isArt = !!p.art[i], c = isArt ? [p.rgba[i * 4], p.rgba[i * 4 + 1], p.rgba[i * 4 + 2]] : src.bg;
          full.id.data.set([c[0], c[1], c[2], 255], q);
          base.id.data.set([src.bg[0], src.bg[1], src.bg[2], 255], q);
          if (isArt) only.id.data.set([c[0], c[1], c[2], 255], q);
        }
      }
      [full, base, only].forEach(o => o.ctx.putImageData(o.id, 0, 0));
      pv.art[p.n] = full.c; pv.base[p.n] = base.c; pv.only[p.n] = only.c;
    }
  }

  // Separa a estampa em elementos (cada flor ou motivo solto). Pedacinhos muito pequenos ficam no fundo da peça.
  function splitElements(onlyCv, baseCv) {
    const w = onlyCv.width, h = onlyCv.height, src = onlyCv.getContext('2d').getImageData(0, 0, w, h).data;
    const lab = new Int32Array(w * h), comps = [];
    let n = 0;
    for (let s = 0; s < w * h; s++) {
      if (!src[s * 4 + 3] || lab[s]) continue;
      n++;
      const c = { id: n, x0: w, y0: h, x1: 0, y1: 0, px: [] }, stack = [s];
      lab[s] = n;
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i - x) / w;
        c.px.push(i);
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (j < 0 || j >= w * h || lab[j] || !src[j * 4 + 3]) continue;
          if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
          lab[j] = n; stack.push(j);
        }
      }
      comps.push(c);
    }
    const minPx = w * h * 0.002;
    const base = document.createElement('canvas'); base.width = w; base.height = h;
    const bctx = base.getContext('2d'); bctx.drawImage(baseCv, 0, 0);
    const bid = bctx.getImageData(0, 0, w, h);
    const els = [];
    for (const c of comps) {
      if (c.px.length < minPx) { for (const i of c.px) bid.data.set(src.subarray(i * 4, i * 4 + 4), i * 4); continue; }
      const ew = c.x1 - c.x0 + 1, eh = c.y1 - c.y0 + 1, cv = document.createElement('canvas'); cv.width = ew; cv.height = eh;
      const ctx = cv.getContext('2d'), id = ctx.createImageData(ew, eh);
      for (const i of c.px) { const x = i % w, y = (i - x) / w; id.data.set(src.subarray(i * 4, i * 4 + 4), ((y - c.y0) * ew + x - c.x0) * 4); }
      ctx.putImageData(id, 0, 0);
      els.push({ img: cv, cx: c.x0 + ew / 2, cy: c.y0 + eh / 2, w: ew });
    }
    bctx.putImageData(bid, 0, 0);
    return { base, els };
  }

  // Coloca uma peça na vista: o fundo da peça e cada elemento da estampa viram objetos separados, ligados pelo mesmo grupo.
  function placePiece(view, n, rot, x, y, w) {
    const only = rot ? rotated(pv.only[n]) : pv.only[n], baseCv = rot ? rotated(pv.base[n]) : pv.base[n];
    const { base, els } = splitElements(only, baseCv), k = w / base.width, gid = ++pv.gid;
    const out = [{ kind: 'base', gid, n, img: base, x, y, w, rot: 0, flip: false, op: 1, mult: false }];
    for (const e of els) out.push({ kind: 'el', gid, n, img: e.img, x: x + (e.cx - base.width / 2) * k, y: y + (e.cy - base.height / 2) * k, w: e.w * k, rot: 0, flip: false, op: 1, mult: false });
    pv.layers[view].push(...out);
    return out;
  }

  function rotated(cv) {
    const r = document.createElement('canvas'); r.width = cv.width; r.height = cv.height;
    const ctx = r.getContext('2d'); ctx.translate(cv.width, cv.height); ctx.rotate(Math.PI); ctx.drawImage(cv, 0, 0);
    return r;
  }

  const pieceName = n => { const p = src.pieces.find(q => q.n === n); const g = src.groups.find(g => g.items.includes(p)); return g ? st.groupName(g) : 'Peça ' + n; };

  // ---------- Arquivo da estampa ----------
  function renderSource() {
    const chip = $('#pvSrcName');
    if (src.pieces.length) {
      chip.className = 'chip';
      chip.replaceChildren(`${src.name} · ${src.pieces.length} peças`, el('button', { class: 'x', type: 'button', title: 'Remover arquivo', text: '✕ Remover', onclick: removeSource }));
    } else { chip.className = 'chip empty'; chip.textContent = 'Nenhum arquivo escolhido'; }
    const grade = App.st.an && App.st.pieces.length;
    $('#pvUseGrade').disabled = !grade || (src.fromGrade && src.pieces === App.st.pieces);
    $('#pvUseGrade').title = grade ? '' : 'Leia um arquivo na aba Arquivo para usar este atalho.';
    if (!src.pieces.length) renderPieces();
  }

  function resetFromSource() {
    if (src.pieces.length) buildArt(); else { pv.art = {}; pv.base = {}; pv.only = {}; }
    pv.found = []; pv.auto = []; pv.layers = { frente: [], costas: [], lado: [] }; pv.sel = null;
    renderSource(); renderPieces(); renderSlots(); renderFound(); draw();
  }

  async function loadSource(file) {
    const inp = $('#pvSrcInput'); inp.disabled = true;
    $('#pvPieces').replaceChildren(el('p', { class: 'muted', text: 'Lendo o arquivo da estampa…' }));
    $('#pvSrcFile').scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t0 = U.now();
    try {
      $('#pvSrcStatus').textContent = 'Abrindo o arquivo…'; await U.tick();
      const img = await Tiff.readImage(file);
      const dpi = img.dpi || 200;
      const an = await Analyze.run(img, dpi, txt => { $('#pvSrcStatus').textContent = txt; });
      img.data = null;
      src = { name: file.name, pieces: an.pieces, groups: Analyze.group(an.pieces), bg: an.bg, dpi, fromGrade: false };
      $('#pvSrcStatus').textContent = `${an.pieces.length} peças lidas em ${U.secs(U.now() - t0)}` + (img.dpi ? '' : ' (sem resolução no arquivo: usei 200 dpi)') + '.';
      resetFromSource();
    } catch (e) {
      console.error(e);
      $('#pvSrcStatus').textContent = 'Não consegui ler o arquivo: ' + e.message;
    } finally { inp.disabled = false; inp.value = ''; }
  }

  function useGrade() {
    const s = App.st;
    if (!s.an) return;
    src = { name: (s.file ? s.file.name : 'arquivo da grade') + ' (da grade)', pieces: s.pieces, groups: s.groups, bg: s.bg, dpi: s.dpi, fromGrade: true };
    $('#pvSrcStatus').textContent = 'Usando o mesmo arquivo lido na aba Arquivo.';
    resetFromSource();
  }

  function removeSource() {
    src = { name: '', pieces: [], groups: [], bg: [255, 255, 255], dpi: 200, fromGrade: false };
    $('#pvSrcStatus').textContent = '';
    resetFromSource();
  }

  function renderPieces() {
    const box = $('#pvPieces');
    if (!src.pieces.length) {
      // Sem arquivo: o próprio quadro já oferece escolher, além do quadro "Arquivo da estampa" no alto.
      const pick = el('label', { class: 'file' }, 'Escolher arquivo da estampa',
        el('input', { type: 'file', accept: '.tif,.tiff,.png,.jpg,.jpeg', onchange: e => { if (e.target.files[0]) loadSource(e.target.files[0]); } }));
      const grade = el('button', { type: 'button', text: 'Usar o arquivo da grade', disabled: !(App.st.an && App.st.pieces.length), onclick: useGrade });
      box.replaceChildren(el('div', { class: 'pieces-empty' }, el('p', { class: 'muted', text: 'Nenhum arquivo de estampa escolhido ainda.' }), pick, grade));
      return;
    }
    box.replaceChildren(...src.pieces.map(p => {
      const th = document.createElement('canvas'), a = pv.art[p.n], f = Math.min(1, 160 / a.width);
      th.width = Math.round(a.width * f); th.height = Math.round(a.height * f);
      th.getContext('2d').drawImage(a, 0, 0, th.width, th.height);
      return el('button', { class: 'piece', type: 'button', title: 'Colocar na modelo', onclick: () => addLayer(p.n) }, th, `${p.n} · ${pieceName(p.n)}`);
    }));
  }

  // ---------- Modelos ----------
  function renderModels() {
    $('#pvModels').replaceChildren(...pv.models.map(m => {
      const img = m.views.frente || m.views.costas || m.views.lado;
      const b = el('button', { class: 'model' + (m.id === pv.model ? ' on' : ''), type: 'button', title: m.name, onclick: () => { pv.model = m.id; pv.sel = null; renderModels(); draw(); } },
        img ? el('img', { src: img.src, alt: m.name }) : el('span', { class: 'muted', text: m.name }));
      if (!m.fixed) b.append(el('button', { class: 'x', type: 'button', title: 'Remover modelo', text: '✕', onclick: e => { e.stopPropagation(); removeModel(m.id); } }));
      return b;
    }));
  }

  async function addModelPhoto(file) {
    const { img } = await fileImg(file);
    let m = cur();
    if (m.fixed) {
      m = { id: 'm' + Date.now(), name: file.name, views: {}, fixed: false };
      pv.models.push(m); pv.model = m.id;
    }
    m.views[pv.view] = img;
    renderModels(); draw();
  }

  function removeModel(id) {
    pv.models = pv.models.filter(m => m.id !== id);
    if (pv.model === id) pv.model = 'padrao';
    renderModels(); draw();
  }

  // ---------- Manequim ----------
  function renderSlots() {
    $('#pvSlots').replaceChildren(...MQ_VIEWS.map(v => {
      const m = pv.mq[v];
      const input = el('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp', onchange: async e => { if (e.target.files[0]) { pv.mq[v] = await fileImg(e.target.files[0]); pv.found = pv.found.filter(f => f.view !== v); renderSlots(); renderFound(); } } });
      const kids = [el('span', { class: 'lbl', text: VIEWS[v] })];
      if (m) kids.push(el('img', { src: m.url, alt: 'Manequim ' + VIEWS[v] }), el('button', { class: 'x', type: 'button', title: 'Remover foto', text: '✕', onclick: () => { URL.revokeObjectURL(m.url); pv.mq[v] = null; pv.found = pv.found.filter(f => f.view !== v); renderSlots(); renderFound(); draw(); } }));
      else kids.push(el('label', { class: 'file' }, 'Enviar foto', input));
      return el('div', { class: 'slot' }, kids);
    }));
    // As três fotos são obrigatórias: com frente, lateral e costas o motor enxerga a estampa inteira.
    const falta = MQ_VIEWS.filter(v => !pv.mq[v]);
    // Sem arquivo próprio no Provador, a leitura usa sozinha o arquivo da grade (se houver).
    const temArquivo = src.pieces.length || (App.st.an && App.st.pieces.length);
    $('#pvLer').disabled = falta.length > 0 || !temArquivo;
    $('#pvNeed').textContent = !temArquivo ? 'Escolha o arquivo da estampa primeiro.'
      : falta.length ? `Falta a foto: ${falta.map(v => VIEWS[v].toLowerCase()).join(', ')}.`
      : src.pieces.length ? 'As três fotos estão prontas.' : 'As três fotos estão prontas. Será usado o arquivo da grade.';
  }

  // Foto reduzida em canais de cor, para comparar com as estampas.
  function photoData(img, W) {
    const h = Math.round(img.naturalHeight * W / img.naturalWidth);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, h);
    const d = ctx.getImageData(0, 0, W, h).data, n = W * h, r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) { r[i] = d[i * 4]; g[i] = d[i * 4 + 1]; b[i] = d[i * 4 + 2]; }
    return { w: W, h, r, g, b };
  }

  // Pontos da estampa reduzida a 'tw' de largura, já centrados na média (para a correlação).
  function templatePts(art, tw) {
    const th = Math.max(4, Math.round(art.height * tw / art.width));
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(art, 0, 0, tw, th);
    const d = ctx.getImageData(0, 0, tw, th).data, all = [];
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const q = (y * tw + x) * 4; if (d[q + 3] > 200) all.push([x, y, d[q], d[q + 1], d[q + 2]]); }
    const step = Math.max(1, Math.floor(all.length / 260)), pts = all.filter((_, i) => i % step === 0);
    let mr = 0, mg = 0, mb = 0; pts.forEach(p => { mr += p[2]; mg += p[3]; mb += p[4]; });
    const k = pts.length || 1; mr /= k; mg /= k; mb /= k;
    let norm = 0;
    const out = pts.map(p => { const v = [p[0], p[1], p[2] - mr, p[3] - mg, p[4] - mb]; norm += v[2] * v[2] + v[3] * v[3] + v[4] * v[4]; return v; });
    return { tw, th, pts: out, norm: Math.sqrt(norm) || 1 };
  }

  function ncc(ph, t, X, Y) {
    const pts = t.pts, n = pts.length;
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < n; i++) { const j = (Y + pts[i][1]) * ph.w + X + pts[i][0]; sr += ph.r[j]; sg += ph.g[j]; sb += ph.b[j]; }
    const mr = sr / n, mg = sg / n, mb = sb / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], j = (Y + p[1]) * ph.w + X + p[0];
      const a = ph.r[j] - mr, b = ph.g[j] - mg, c = ph.b[j] - mb;
      num += a * p[2] + b * p[3] + c * p[4]; den += a * a + b * b + c * c;
    }
    return den > 0 ? num / (Math.sqrt(den) * t.norm) : 0;
  }

  // Procura a peça na foto nas larguras pedidas (em pixels da foto), normal e girada 180°.
  // Moldes muito pequenos são pulados: com poucos pixels qualquer pedaço da foto "parece" com a peça.
  const MIN_SIDE = 7, MIN_AREA = 140;
  // 'peaks' > 1 devolve também os melhores lugares alternativos (afastados entre si), para quando o primeiro
  // lugar já estiver ocupado por outra peça.
  function scan(ph, art, cmW, widths, step, peaks = 1) {
    const out = [], arts = [art, rotated(art)];
    for (const tw0 of widths) {
      const tw = Math.round(tw0);
      if (tw >= ph.w - 2) continue;
      for (let rot = 0; rot < 2; rot++) {
        const t = templatePts(arts[rot], tw);
        if (t.th >= ph.h - 2 || t.pts.length < 20 || Math.min(tw, t.th) < MIN_SIDE || tw * t.th < MIN_AREA) continue;
        const top = [];
        for (let Y = 0; Y + t.th < ph.h; Y += step) for (let X = 0; X + tw < ph.w; X += step) {
          const v = ncc(ph, t, X, Y);
          if (top.length < 40 || v > top[top.length - 1].score) {
            top.push({ score: v, X, Y }); top.sort((a, b) => b.score - a.score); if (top.length > 40) top.pop();
          }
        }
        const kept = [];
        for (const c of top) {
          if (kept.length >= peaks) break;
          if (kept.some(k => Math.abs(k.X - c.X) < tw / 2 && Math.abs(k.Y - c.Y) < t.th / 2)) continue;
          kept.push(c);
        }
        kept.forEach(c => out.push({ pxcm: tw / cmW, score: c.score, X: c.X, Y: c.Y, t, rot }));
      }
    }
    return out;
  }

  // Primeira passada: foto pequena e tamanhos de 12 em 12%, só para descobrir a escala da foto.
  const coarseWidths = ph => Array.from({ length: 22 }, (_, s) => ph.w * 0.08 * Math.pow(1.12, s));

  // Ajuste fino: tamanho em passos de 3% e posição pixel a pixel em volta do melhor resultado.
  function refine(ph, r, art) {
    const src = r.rot ? rotated(art) : art, cx = r.X + r.t.tw / 2, cy = r.Y + r.t.th / 2;
    let best = { score: r.score, X: r.X, Y: r.Y, t: r.t };
    for (const f of [0.91, 0.94, 0.97, 1, 1.03, 1.06, 1.09]) {
      const tw = Math.round(r.t.tw * f);
      if (tw < 4 || tw >= ph.w - 2) continue;
      const t = f === 1 ? r.t : templatePts(src, tw);
      if (t.th >= ph.h - 2 || t.pts.length < 20) continue;
      const X0 = Math.round(cx - tw / 2), Y0 = Math.round(cy - t.th / 2);
      for (let Y = Math.max(0, Y0 - 5); Y <= Y0 + 5; Y++) for (let X = Math.max(0, X0 - 5); X <= X0 + 5; X++) {
        if (X + tw >= ph.w || Y + t.th >= ph.h) continue;
        const v = ncc(ph, t, X, Y);
        if (v > best.score) best = { score: v, X, Y, t };
      }
    }
    return { score: best.score, rot: r.rot, box: { x: best.X / ph.w, y: best.Y / ph.h, w: best.t.tw / ph.w, h: best.t.th / ph.h } };
  }

  // Todas as peças de uma mesma foto estão na mesma escala. Para cada escala possível, olha as duas peças
  // que melhor aparecem nela; a escala certa é a que tem as melhores notas. Peças ausentes não atrapalham.
  // Devolve as 3 escalas mais prováveis (bem diferentes entre si); a passada fina decide entre elas.
  function pickScales(results) {
    const near = (a, b) => Math.abs(a / b - 1) <= 0.07;
    const all = [];
    for (const s of results.flatMap(r => r.arr.map(e => e.pxcm))) {
      const per = results.map(r => Math.max(0, ...r.arr.filter(e => near(e.pxcm, s)).map(e => e.score))).sort((a, b) => b - a);
      all.push({ s, total: (per[0] || 0) + (per[1] || 0) });
    }
    all.sort((a, b) => b.total - a.total);
    const out = [];
    for (const c of all) { if (out.length < 3 && !out.some(o => Math.abs(o / c.s - 1) < 0.1)) out.push(c.s); }
    return out;
  }

  // Quanto da caixa 'a' fica dentro da caixa 'b' (0 a 1).
  const inside = (a, b) => {
    const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    return Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / (a.w * a.h);
  };

  const iou = (a, b) => {
    const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    return i / (a.w * a.h + b.w * b.h - i);
  };

  async function readMannequin() {
    if (!src.pieces.length && App.st.an && App.st.pieces.length) useGrade();
    if (!src.pieces.length) { $('#pvStatus').textContent = 'Escolha o arquivo da estampa primeiro.'; return; }
    const btn = $('#pvLer'); btn.disabled = true;
    // Frente e costas primeiro; a lateral usa a escala medida nelas (as três fotos são tiradas da mesma distância).
    const t0 = U.now(), cands = [], views = ['frente', 'costas', 'lado'].filter(v => pv.mq[v]), measured = [];
    const withArt = src.pieces.filter(p => p.artFrac > 0.005);
    try {
      for (const v of views) {
        // Passada 1: foto pequena, todos os tamanhos, para achar a escala (na lateral, só se ainda não houver medida).
        const ph1 = photoData(pv.mq[v].img, 120);
        let scales;
        if (v === 'lado' && measured.length) {
          // Escala por largura da foto: vale para fotos tiradas da mesma distância, mesmo com resoluções diferentes.
          scales = [measured.reduce((a, b) => a + b, 0) / measured.length * ph1.w];
        } else {
          const results = [];
          for (const p of withArt) {
            $('#pvStatus').textContent = `Lendo o manequim (${VIEWS[v].toLowerCase()}): medindo a escala com a peça ${p.n}…`;
            await U.tick();
            results.push({ p, arr: scan(ph1, pv.art[p.n], U.cm(p.w, src.dpi), coarseWidths(ph1), 2) });
          }
          scales = pickScales(results).slice(0, 2);
        }
        if (!scales.length) continue;
        // Passada 2: foto maior, só em volta de cada escala provável, com até 3 lugares por peça.
        // Fica a escala cujas duas melhores peças têm as maiores notas depois do ajuste fino.
        const ph2 = photoData(pv.mq[v].img, 220);
        let bestHyp = null;
        for (const s1 of scales) {
          const s2 = s1 * ph2.w / ph1.w, hc = [], range = v === 'lado' ? [0.82, 0.88, 0.94, 1, 1.06, 1.12] : [0.9, 0.95, 1, 1.05, 1.1];
          for (const p of withArt) {
            $('#pvStatus').textContent = `Lendo o manequim (${VIEWS[v].toLowerCase()}): localizando a peça ${p.n}…`;
            await U.tick();
            const cmW = U.cm(p.w, src.dpi), arr = scan(ph2, pv.art[p.n], cmW, range.map(f => s2 * cmW * f), 2, 3);
            arr.sort((a, b) => b.score - a.score);
            const seen = [];
            for (const e of arr) {
              if (seen.length >= 3) break;
              if (seen.some(o => Math.abs(o.X - e.X) < e.t.tw / 2 && Math.abs(o.Y - e.Y) < e.t.th / 2)) continue;
              seen.push(e); hc.push({ n: p.n, view: v, ...refine(ph2, e, pv.art[p.n]) });
            }
          }
          const best2 = withArt.map(p => Math.max(0, ...hc.filter(c => c.n === p.n).map(c => c.score))).sort((a, b) => b - a);
          const q = (best2[0] || 0) + (best2[1] || 0);
          if (!bestHyp || q > bestHyp.q) bestHyp = { q, hc, s1 };
        }
        cands.push(...bestHyp.hc);
        if (v !== 'lado') measured.push(bestHyp.s1 / ph1.w);
      }
      // Cada peça fica com o melhor lugar; duas peças não podem ocupar o mesmo lugar,
      // e um resultado bem mais fraco que os outros da mesma foto é descartado.
      // Peças iguais (mesmo grupo da grade, como os dois círculos) dividem os lugares encontrados entre si.
      // A lateral mostra de novo partes da frente e das costas, então ela é distribuída à parte.
      cands.sort((a, b) => b.score - a.score);
      const groupOf = n => src.groups.find(g => g.items.some(p => p.n === n));
      const found = [], usedFC = new Set(), usedL = new Set();
      for (const c of cands) {
        const used = c.view === 'lado' ? usedL : usedFC;
        // Nota mínima cresce com o tamanho da peça na foto: molde grande acerta de verdade com nota alta.
        if (c.score < Math.min(0.85, MIN_SCORE + 2.3 * c.box.w * c.box.h)) continue;
        if (found.some(f => f.view === c.view && (iou(f.box, c.box) > 0.3 || inside(c.box, f.box) > 0.6 || inside(f.box, c.box) > 0.6))) continue;
        const g = groupOf(c.n), free = used.has(c.n) ? (g ? g.items.map(p => p.n).find(n => !used.has(n) && withArt.some(p => p.n === n)) : null) : c.n;
        if (!free) continue;
        used.add(free); found.push({ ...c, n: free, srcN: c.n });
      }
      pv.found = found;
      const miss = withArt.filter(p => !usedFC.has(p.n) && !usedL.has(p.n)).map(p => p.n);
      const porVista = views.map(v => `${VIEWS[v].toLowerCase()} ${found.filter(f => f.view === v).length}`).join(', ');
      placeFromMannequin();
      pv.auto = placeMissing(miss);
      $('#pvStatus').textContent = `Leitura em ${U.secs(U.now() - t0)}. Peças achadas por foto: ${porVista}.`
        + (pv.auto.length === 1 ? ` A peça ${pv.auto[0].n} não apareceu no manequim e foi colocada automaticamente na modelo: confira a posição dela.`
          : pv.auto.length ? ` As peças ${pv.auto.map(a => a.n).join(', ')} não apareceram no manequim e foram colocadas automaticamente na modelo: confira a posição delas.`
          : ' Todas as peças com estampa foram achadas.');
      renderFound();
      if (found.length) setView(found.some(f => f.view === pv.view) ? pv.view : found[0].view);
    } catch (e) {
      console.error(e);
      $('#pvStatus').textContent = 'Erro ao ler o manequim: ' + e.message;
    } finally { btn.disabled = false; }
  }

  function renderFound() {
    if (!pv.found.length && !(pv.auto || []).length) { $('#pvFound').replaceChildren(); return; }
    const head = el('tr', {}, ['Peça', 'Vista', 'Lugar no manequim', 'Confiança'].map(t => el('th', { text: t })));
    const rows = pv.found.map(f => el('tr', {},
      el('td', {}, el('span', { class: 'tag', text: f.n }), ' ' + pieceName(f.n)),
      el('td', { text: VIEWS[f.view] + (f.rot ? ' (girada)' : '') }),
      el('td', { text: `${Math.round((f.box.x + f.box.w / 2) * 100)}% × ${Math.round((f.box.y + f.box.h / 2) * 100)}%` }),
      el('td', { text: `${Math.round(f.score * 100)}%` })));
    for (const a of pv.auto || []) rows.push(el('tr', {},
      el('td', {}, el('span', { class: 'tag', text: a.n }), ' ' + pieceName(a.n)),
      el('td', { text: VIEWS[a.view] }),
      el('td', { class: 'muted', text: 'não aparece no manequim' }),
      el('td', {}, el('span', { class: 'src manual', text: 'colocada automaticamente' }))));
    $('#pvFound').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  // Leva o que foi achado no manequim para a modelo: o conjunto das peças achadas ocupa a área da roupa
  // da modelo, mantendo a proporção e as posições relativas entre as peças.
  function placeFromMannequin() {
    for (const v of MQ_VIEWS) {
      const fs = pv.found.filter(f => f.view === v);
      if (!fs.length) continue;
      const model = cur().views[v] || cur().views.frente;
      if (!model) continue;
      const mqImg = pv.mq[v].img, mw = mqImg.naturalWidth, mh = mqImg.naturalHeight;
      const ux0 = Math.min(...fs.map(f => f.box.x)) * mw, uy0 = Math.min(...fs.map(f => f.box.y)) * mh;
      const ux1 = Math.max(...fs.map(f => f.box.x + f.box.w)) * mw, uy1 = Math.max(...fs.map(f => f.box.y + f.box.h)) * mh;
      const A = AREA[v], W = model.naturalWidth, H = model.naturalHeight;
      const ax = A.x * W, ay = A.y * H, aw = A.w * W, ah = A.h * H;
      const k = Math.min(aw / (ux1 - ux0), ah / (uy1 - uy0));
      const ox = ax + (aw - (ux1 - ux0) * k) / 2, oy = ay;
      pv.layers[v] = [];
      for (const f of fs) {
        const bx = f.box.x * mw, by = f.box.y * mh, bw = f.box.w * mw, bh = f.box.h * mh;
        placePiece(v, f.srcN || f.n, f.rot, ox + (bx + bw / 2 - ux0) * k, oy + (by + bh / 2 - uy0) * k, bw * k);
      }
    }
    pv.sel = null;
  }

  // Peças do arquivo que não apareceram em nenhuma foto do manequim também vão para a modelo.
  // Se a peça igual a ela (mesmo grupo: o outro círculo, o outro peito) foi achada na frente, esta vai
  // nas costas, no lado espelhado (e vice-versa). Sem par, vai no centro da frente. O tamanho segue
  // a escala das peças já colocadas, pelas medidas reais em cm.
  function placeMissing(missNs) {
    const auto = [];
    const kOf = v => {
      const b = pv.layers[v].find(L => L.kind === 'base');
      if (!b) return null;
      const p = src.pieces.find(q => q.n === b.n);
      return p ? b.w / U.cm(p.w, src.dpi) : null;
    };
    for (const n of missNs) {
      const p = src.pieces.find(q => q.n === n), g = src.groups.find(gr => gr.items.includes(p));
      const twin = g && pv.found.find(f => f.view !== 'lado' && g.items.some(q => q.n === f.n));
      const view = twin ? (twin.view === 'frente' ? 'costas' : 'frente') : 'frente';
      const model = cur().views[view];
      if (!model) continue;
      const W = model.naturalWidth, H = model.naturalHeight, A = AREA[view];
      const k = kOf(view) || kOf(twin ? twin.view : 'frente') || kOf('costas') || kOf('frente');
      const w = k ? U.cm(p.w, src.dpi) * k : A.w * W * 0.5;
      let x = (A.x + A.w / 2) * W, y = (A.y + A.h / 2) * H;
      if (twin) {
        const tb = pv.layers[twin.view].find(L => L.kind === 'base' && L.n === (twin.srcN || twin.n));
        if (tb) { x = W - tb.x; y = tb.y; }
      }
      placePiece(view, n, twin ? !!twin.rot : false, x, y, w);
      auto.push({ n, view });
    }
    return auto;
  }

  // ---------- Editor ----------
  function addLayer(n) {
    const model = cur().views[pv.view];
    if (!model) { $('#pvStatus').textContent = `Envie a foto da modelo (${VIEWS[pv.view].toLowerCase()}) primeiro.`; return; }
    const A = AREA[pv.view] || AREA.frente, W = model.naturalWidth, H = model.naturalHeight, art = pv.art[n];
    const w = Math.min(A.w * W, A.h * H * art.width / art.height);
    const placed = placePiece(pv.view, n, false, (A.x + A.w / 2) * W, (A.y + A.h / 2) * H, w);
    pv.sel = placed[0]; syncTools(); draw();
  }

  // Em "Peça inteira" o que se mexe é o grupo todo (fundo e elementos); em "Elemento", só o objeto clicado.
  const members = L => pv.mode === 'peca' ? layers().filter(Q => Q.gid === L.gid) : [L];
  const anchorOf = L => pv.mode === 'peca' ? layers().find(Q => Q.gid === L.gid && Q.kind === 'base') || L : L;

  // Clique certeiro: em elementos só conta onde há desenho (pixel não transparente).
  function hits(Q, x, y) {
    const [lx, ly] = toLocal(Q, x, y), h = hOf(Q);
    if (Math.abs(lx) > Q.w / 2 || Math.abs(ly) > h / 2) return false;
    const px = Math.floor((Q.flip ? -lx : lx) / Q.w * Q.img.width + Q.img.width / 2), py = Math.floor(ly / h * Q.img.height + Q.img.height / 2);
    if (!Q._alpha) Q._alpha = Q.img.getContext('2d').getImageData(0, 0, Q.img.width, Q.img.height).data;
    return Q._alpha[(Math.min(Q.img.height - 1, py) * Q.img.width + Math.min(Q.img.width - 1, px)) * 4 + 3] > 0;
  }

  const hOf = L => L.w * L.img.height / L.img.width;
  function toLocal(L, x, y) { const a = -L.rot * Math.PI / 180, dx = x - L.x, dy = y - L.y; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
  function fromLocal(L, lx, ly) { const a = L.rot * Math.PI / 180; return [L.x + lx * Math.cos(a) - ly * Math.sin(a), L.y + lx * Math.sin(a) + ly * Math.cos(a)]; }
  const handleR = () => 7 / pv.disp;
  function handles(L) { const h = hOf(L); return { scale: fromLocal(L, L.w / 2, h / 2), rot: fromLocal(L, 0, -h / 2 - 22 / pv.disp) }; }

  function drawLayer(ctx, L) {
    ctx.save();
    ctx.globalAlpha = L.op;
    ctx.globalCompositeOperation = L.mult ? 'multiply' : 'source-over';
    ctx.translate(L.x, L.y); ctx.rotate(L.rot * Math.PI / 180); if (L.flip) ctx.scale(-1, 1);
    const h = hOf(L); ctx.drawImage(L.img, -L.w / 2, -h / 2, L.w, h);
    ctx.restore();
  }

  function draw() {
    const cv = $('#pvCanvas'), stage = $('#pvStage'), ctx = cv.getContext('2d');
    const showMq = $('#pvShowMq').checked && pv.mq[pv.view];
    const base = showMq ? pv.mq[pv.view].img : cur().views[pv.view];
    const maxW = Math.max(240, stage.clientWidth - 2), maxH = 640;
    if (!base) {
      cv.width = maxW; cv.height = 320; cv.style.width = maxW + 'px'; cv.style.height = '320px';
      ctx.fillStyle = '#8b98a8'; ctx.font = '14px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Envie a foto da modelo (${VIEWS[pv.view].toLowerCase()}) em "Enviar outra modelo".`, maxW / 2, 160);
      return;
    }
    const W = base.naturalWidth, H = base.naturalHeight;
    pv.disp = Math.min(maxW / W, maxH / H);
    const dw = Math.round(W * pv.disp), dh = Math.round(H * pv.disp), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr); cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
    ctx.setTransform(pv.disp * dpr, 0, 0, pv.disp * dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, 0, 0);
    if (showMq) {
      ctx.lineWidth = 2 / pv.disp; ctx.setLineDash([6 / pv.disp, 4 / pv.disp]); ctx.strokeStyle = '#EF9F27';
      ctx.font = `600 ${13 / pv.disp}px Inter, sans-serif`;
      pv.found.filter(f => f.view === pv.view).forEach(f => {
        const b = f.box; ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
        ctx.fillStyle = '#EF9F27'; ctx.fillText(`${f.n} · ${Math.round(f.score * 100)}%`, b.x * W + 4 / pv.disp, b.y * H + 15 / pv.disp);
      });
      return;
    }
    layers().forEach(L => drawLayer(ctx, L));
    const L = pv.sel;
    if (L && layers().includes(L)) {
      const h = hOf(L), hd = handles(L), r = handleR();
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.rot * Math.PI / 180);
      ctx.lineWidth = 1.5 / pv.disp; ctx.setLineDash([5 / pv.disp, 4 / pv.disp]); ctx.strokeStyle = '#22d3ee';
      ctx.strokeRect(-L.w / 2, -h / 2, L.w, h);
      ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, -h / 2 - 22 / pv.disp); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(hd.scale[0] - r, hd.scale[1] - r, 2 * r, 2 * r);
      ctx.beginPath(); ctx.arc(hd.rot[0], hd.rot[1], r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function pointer(e) { const r = $('#pvCanvas').getBoundingClientRect(); return [(e.clientX - r.left) / pv.disp, (e.clientY - r.top) / pv.disp]; }

  function onDown(e) {
    if ($('#pvShowMq').checked) return;
    const [x, y] = pointer(e), L = pv.sel, r = handleR() * 1.6;
    const snap = A => members(A).map(Q => ({ Q, x: Q.x, y: Q.y, w: Q.w, rot: Q.rot }));
    if (L && layers().includes(L)) {
      const hd = handles(L);
      if (Math.hypot(x - hd.scale[0], y - hd.scale[1]) < r) pv.drag = { mode: 'scale', L, d0: Math.hypot(x - L.x, y - L.y), cx: L.x, cy: L.y, s: snap(L) };
      else if (Math.hypot(x - hd.rot[0], y - hd.rot[1]) < r) pv.drag = { mode: 'rot', L, a0: Math.atan2(y - L.y, x - L.x), cx: L.x, cy: L.y, s: snap(L) };
    }
    if (!pv.drag) {
      const hit = layers().slice().reverse().find(Q => hits(Q, x, y));
      pv.sel = hit ? anchorOf(hit) : null;
      if (hit) pv.drag = { mode: 'move', L: pv.sel, x0: x, y0: y, s: snap(pv.sel) };
      syncTools();
    }
    if (pv.drag) { $('#pvCanvas').setPointerCapture(e.pointerId); e.preventDefault(); }
    $('#pvStage').focus({ preventScroll: true });
    draw();
  }

  function onMove(e) {
    const d = pv.drag; if (!d) return;
    const [x, y] = pointer(e);
    if (d.mode === 'move') d.s.forEach(o => { o.Q.x = o.x + x - d.x0; o.Q.y = o.y + y - d.y0; });
    else if (d.mode === 'scale') {
      const f = Math.max(0.05, Math.hypot(x - d.cx, y - d.cy) / (d.d0 || 1));
      d.s.forEach(o => { o.Q.w = Math.max(4, o.w * f); o.Q.x = d.cx + (o.x - d.cx) * f; o.Q.y = d.cy + (o.y - d.cy) * f; });
    } else if (d.mode === 'rot') {
      let a = (Math.atan2(y - d.cy, x - d.cx) - d.a0) * 180 / Math.PI;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      const r = a * Math.PI / 180;
      d.s.forEach(o => { const dx = o.x - d.cx, dy = o.y - d.cy; o.Q.x = d.cx + dx * Math.cos(r) - dy * Math.sin(r); o.Q.y = d.cy + dx * Math.sin(r) + dy * Math.cos(r); o.Q.rot = o.rot + a; });
    }
    draw();
  }

  function onUp() { pv.drag = null; }

  function act(name) {
    const L = pv.sel, model = cur().views[pv.view];
    if (!L || !layers().includes(L)) { $('#pvStatus').textContent = 'Clique numa estampa na modelo para selecionar.'; return; }
    const arr = layers(), ms = members(L), A = AREA[pv.view] || AREA.frente;
    const shift = (dx, dy) => ms.forEach(Q => { Q.x += dx; Q.y += dy; });
    if (name === 'centro' && model) shift((A.x + A.w / 2) * model.naturalWidth - L.x, (A.y + A.h / 2) * model.naturalHeight - L.y);
    if (name === 'centroH' && model) shift((A.x + A.w / 2) * model.naturalWidth - L.x, 0);
    if (name === 'espelhar') ms.forEach(Q => { Q.flip = !Q.flip; Q.x = L.x - (Q.x - L.x); Q.rot = -Q.rot; });
    if (name === 'frente' || name === 'tras') {
      const rest = arr.filter(Q => !ms.includes(Q));
      arr.splice(0, arr.length, ...(name === 'frente' ? [...rest, ...ms] : [...ms, ...rest]));
    }
    if (name === 'remover') { arr.splice(0, arr.length, ...arr.filter(Q => !ms.includes(Q))); pv.sel = null; }
    syncTools(); draw();
  }

  function syncTools() {
    const L = pv.sel;
    $('#pvOp').value = L ? Math.round(L.op * 100) : 100;
    $('#pvMult').checked = !!(L && L.mult);
    const info = $('#pvSel');
    if (info) info.textContent = !L ? 'Nada selecionado.' : pv.mode === 'peca' ? `Selecionado: peça ${L.n} inteira (${members(L).length} objetos).` : `Selecionado: ${L.kind === 'el' ? 'elemento da estampa' : 'fundo'} da peça ${L.n}.`;
  }

  function setView(v) {
    pv.view = v; pv.sel = null;
    $('#pvViews').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    syncTools(); draw();
  }

  function exportPng() {
    const model = cur().views[pv.view];
    if (!model) return;
    const k = Math.max(1, Math.round(1200 / model.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = model.naturalWidth * k; cv.height = model.naturalHeight * k;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.scale(k, k);
    ctx.drawImage(model, 0, 0); layers().forEach(L => drawLayer(ctx, L));
    cv.toBlob(b => {
      const a = el('a', { href: URL.createObjectURL(b), download: `provador_${pv.view}.png` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }, 'image/png');
  }

  // ---------- Início ----------
  async function init() {
    $('#pvViews').replaceChildren(...Object.entries(VIEWS).map(([v, t]) => el('button', { type: 'button', 'data-v': v, class: v === pv.view ? 'on' : '', text: t, onclick: () => setView(v) })));
    const m = pv.models[0];
    await Promise.all(Object.keys(VIEWS).map(async v => { try { m.views[v] = await loadImg(`modelos/${v}.png`); } catch (e) { console.warn(e); } }));
    renderModels(); renderSlots(); renderPieces(); draw();

    $('#pvModelFile').addEventListener('change', e => { if (e.target.files[0]) addModelPhoto(e.target.files[0]); e.target.value = ''; });
    $('#pvLer').addEventListener('click', readMannequin);
    document.querySelectorAll('.toolbar [data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
    $('#pvOp').addEventListener('input', e => { if (pv.sel) { members(pv.sel).forEach(Q => { Q.op = e.target.value / 100; }); draw(); } });
    $('#pvMult').addEventListener('change', e => { if (pv.sel) { members(pv.sel).forEach(Q => { Q.mult = e.target.checked; }); draw(); } });
    $('#pvShowMq').addEventListener('change', draw);
    document.querySelectorAll('input[name=pvMode]').forEach(r => r.addEventListener('change', e => { pv.mode = e.target.value; if (pv.sel) pv.sel = anchorOf(pv.sel); syncTools(); draw(); }));
    $('#pvCopy').addEventListener('click', () => { pv.layers.lado = pv.layers.frente.map(L => ({ ...L })); if (pv.view === 'lado') draw(); $('#pvStatus').textContent = 'Posições da frente copiadas para a lateral. Ajuste o que precisar na vista Lateral.'; });
    $('#pvExport').addEventListener('click', exportPng);
    const cv = $('#pvCanvas'), stage = $('#pvStage');
    stage.tabIndex = 0;
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    stage.addEventListener('keydown', e => {
      const L = pv.sel; if (!L) return;
      const s = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
      if (mv) { members(L).forEach(Q => { Q.x += mv[0]; Q.y += mv[1]; }); e.preventDefault(); draw(); }
      if (e.key === 'Delete') act('remover');
    });
    window.addEventListener('resize', draw);
    window.addEventListener('pp:aba', e => { if (e.detail === 'provador') draw(); });
    // A grade não mexe no Provador: só libera ou trava o atalho "Usar o arquivo da grade".
    window.addEventListener('pp:lido', () => { renderSource(); renderSlots(); });
    window.addEventListener('pp:limpo', () => { renderSource(); renderSlots(); });
    $('#pvSrcInput').addEventListener('change', e => { if (e.target.files[0]) loadSource(e.target.files[0]); });
    $('#pvUseGrade').addEventListener('click', useGrade);
    renderSource();
  }

  init();
  return { pv, scan, photoData, readMannequin, setView, draw };
})();
