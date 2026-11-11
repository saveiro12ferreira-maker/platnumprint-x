// Moldes da modelista em PDF (um PDF por tamanho, só o contorno das peças, sem estampa) e grades salvas.
// O PDF guarda a medida real (1 ponto = 1/72 polegada), então cada peça é medida em cm sem erro de escala.
const Moldes = (() => {
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const DPI = 50;                       // 0,5 mm por pixel: suficiente para medir largura × altura
  const TAM = '(\\d{1,2}|PP|P|M|G|GG|XG|XGG|EG|EGG|G[1-5])';

  // "Vestido_Antonella_6.pdf" → tamanho 6, modelo "Vestido Antonella"
  function tamDoNome(nome) {
    const m = nome.replace(/\.pdf$/i, '').match(new RegExp('(?:^|[_\\s\\-.])' + TAM + '(?:\\s*anos?)?$', 'i'));
    return m ? m[1].toUpperCase() : '';
  }
  function modeloDoNome(nome) {
    return nome.replace(/\.pdf$/i, '').replace(new RegExp('[_\\s\\-.]+' + TAM + '(?:\\s*anos?)?$', 'i'), '').replace(/[_]+/g, ' ').trim();
  }

  // Lê o PDF e devolve as peças (largura × altura em cm), maior primeiro.
  async function ler(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('O leitor de PDF não carregou. Confira a internet e recarregue a página.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pecas = [];
    for (let pn = 1; pn <= pdf.numPages; pn++) {
      const page = await pdf.getPage(pn);
      const vp = page.getViewport({ scale: DPI / 72 });
      const W = Math.ceil(vp.width), H = Math.ceil(vp.height);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const px = ctx.getImageData(0, 0, W, H).data;
      let m = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) { const o = i * 4; if (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11 < 160) m[i] = 1; }
      cv.width = cv.height = 1;
      // fecha falhas pequenas da linha (até 1 mm), pinta o lado de fora, o resto é peça
      m = U.box(m, W, H, 2, 'max');
      const fora = new Uint8Array(W * H), fila = new Int32Array(W * H); let a = 0, b = 0;
      const pus = i => { if (!m[i] && !fora[i]) { fora[i] = 1; fila[b++] = i; } };
      for (let x = 0; x < W; x++) { pus(x); pus((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { pus(y * W); pus(y * W + W - 1); }
      while (a < b) {
        const i = fila[a++], x = i % W;
        if (x > 0) pus(i - 1); if (x < W - 1) pus(i + 1); if (i >= W) pus(i - W); if (i < W * (H - 1)) pus(i + W);
      }
      let dentro = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) dentro[i] = fora[i] ? 0 : 1;
      dentro = U.box(dentro, W, H, 2, 'min');
      // cada pedaço = um bloco ligado
      const vis = new Uint8Array(W * H), min = Math.pow(3 / 2.54 * DPI, 2);
      for (let s = 0; s < W * H; s++) {
        if (!dentro[s] || vis[s]) continue;
        let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0; a = 0; b = 0; fila[b++] = s; vis[s] = 1;
        while (a < b) {
          const i = fila[a++], x = i % W, y = (i / W) | 0; n++;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && dentro[j] && !vis[j]) { vis[j] = 1; fila[b++] = j; }
        }
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        if (w * h < min) continue;
        pecas.push({ w: U.cm(w, DPI), h: U.cm(h, DPI), area: U.cm(1, DPI) ** 2 * n, pag: pn, x: U.cm(x0, DPI), y: U.cm(y0, DPI), cx: U.cm((x0 + x1) / 2, DPI), cy: U.cm((y0 + y1) / 2, DPI) });
      }
    }
    pecas.sort((p, q) => q.area - p.area);
    pecas.forEach((p, i) => { p.n = i + 1; });
    pecas.doc = pdf;
    return pecas;
  }

  // O contorno exato de um molde do PDF, desenhado no dpi do arquivo da estampa: {w, h, m} (m = 1 dentro da peça).
  // A linha do PDF tem espessura: a forma vai até o meio da linha (onde o laser corta).
  async function forma(doc, peca, dpi, opt) {
    const page = await doc.getPage(peca.pag);
    const k = dpi / 2.54, mg = Math.round(0.4 * k);          // 4 mm de folga em volta
    const x0 = Math.floor(peca.x * k) - mg, y0 = Math.floor(peca.y * k) - mg;
    const W = Math.ceil(peca.w * k) + 2 * mg, H = Math.ceil(peca.h * k) + 2 * mg;
    const vp = page.getViewport({ scale: dpi / 72 });
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -x0, -y0] }).promise;
    const px = ctx.getImageData(0, 0, W, H).data; cv.width = cv.height = 1;
    let m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const o = i * 4; if (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11 < 160) m[i] = 1; }
    const escuro = m;
    const r = Math.max(1, Math.round(0.05 * k));               // fecha falhas de até 1 mm
    m = U.box(m, W, H, r, 'max');
    const fora = new Uint8Array(W * H), fila = new Int32Array(W * H); let a = 0, b = 0;
    const pus = i => { if (!m[i] && !fora[i]) { fora[i] = 1; fila[b++] = i; } };
    for (let x = 0; x < W; x++) { pus(x); pus((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { pus(y * W); pus(y * W + W - 1); }
    while (a < b) { const i = fila[a++], x = i % W; if (x > 0) pus(i - 1); if (x < W - 1) pus(i + 1); if (i >= W) pus(i - W); if (i < W * (H - 1)) pus(i + W); }
    let d = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) d[i] = fora[i] ? 0 : 1;
    // volta o que fechou + meia linha (a linha do molde tem ~1,6 mm)
    d = U.box(d, W, H, r + Math.max(1, Math.round(0.08 * k)), 'min');
    // fica só o bloco do meio (outra peça vizinha pode ter entrado na folga)
    const lab = new Int32Array(W * H); let best = 0, bestN = 0, id = 0;
    const cxp = Math.round(peca.cx * k) - x0, cyp = Math.round(peca.cy * k) - y0;
    for (let s = 0; s < W * H; s++) {
      if (!d[s] || lab[s]) continue;
      id++; let n = 0, dentro = false; a = 0; b = 0; fila[b++] = s; lab[s] = id;
      while (a < b) {
        const i = fila[a++], x = i % W, y = (i / W) | 0; n++;
        if (Math.abs(x - cxp) < 2 && Math.abs(y - cyp) < 2) dentro = true;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && d[j] && !lab[j]) { lab[j] = id; fila[b++] = j; }
      }
      if (n > bestN || dentro && n > bestN * 0.3) { best = id; bestN = n; }
    }
    let X0 = W, Y0 = H, X1 = -1, Y1 = -1;
    for (let i = 0; i < W * H; i++) if (lab[i] === best) { const x = i % W, y = (i / W) | 0; if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y; }
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1, out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = lab[(y + Y0) * W + x + X0] === best ? 1 : 0;
    const res = { w, h, m: out };
    if (opt && opt.texto) res.texto = recorteTexto(escuro, lab, best, W, H, k);
    return res;
  }

  // O nome escrito dentro do molde (ex.: "FRENTE 2X - 6 - 6"): os traços escuros longe do contorno, recortados numa imagem.
  function recorteTexto(escuro, lab, best, W, H, k) {
    let dentro = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) dentro[i] = lab[i] === best ? 1 : 0;
    dentro = U.box(dentro, W, H, Math.round(0.4 * k), 'min');
    const t = new Uint8Array(W * H); let n = 0;
    for (let i = 0; i < W * H; i++) if (dentro[i] && escuro[i]) { t[i] = 1; n++; }
    if (n < 20) return null;
    // junta as letras e as palavras (3,5 mm) e fica com o bloco de texto: o que tem mais traço e é fino (uma linha de texto)
    const j = U.box(t, W, H, Math.max(1, Math.round(0.35 * k)), 'max');
    const lb = new Int32Array(W * H), fila = new Int32Array(W * H); let id = 0, best2 = null;
    for (let s = 0; s < W * H; s++) {
      if (!j[s] || lb[s]) continue;
      id++; let a = 0, b = 0, cnt = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; fila[b++] = s; lb[s] = id;
      while (a < b) {
        const i = fila[a++], x = i % W, y = (i / W) | 0; if (t[i]) cnt++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const q of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (q >= 0 && q < W * H && j[q] && !lb[q]) { lb[q] = id; fila[b++] = q; }
      }
      const fino = Math.min(x1 - x0, y1 - y0) < 2 * k, longo = Math.max(x1 - x0, y1 - y0) > 1.0 * k;
      if (fino && longo && (!best2 || cnt > best2.cnt)) best2 = { cnt, x0, y0, x1, y1, id };
    }
    if (!best2) return null;
    const p = 10, cw = best2.x1 - best2.x0 + 1, ch = best2.y1 - best2.y0 + 1;
    const cv = document.createElement('canvas'); cv.width = cw + 2 * p; cv.height = ch + 2 * p;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(cv.width, cv.height);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255; }
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y + best2.y0) * W + x + best2.x0;
      if (t[i] && lb[i] === best2.id) { const q = ((y + p) * cv.width + x + p) * 4; img.data[q] = img.data[q + 1] = img.data[q + 2] = 0; }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // ---------- Leitura do nome (OCR) ----------
  let ocrWorker = null;
  async function ocr() {
    if (ocrWorker) return ocrWorker;
    if (typeof Tesseract === 'undefined') await new Promise((ok, err) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = ok; s.onerror = () => err(new Error('não consegui carregar o leitor de texto')); document.head.append(s);
    });
    ocrWorker = await Tesseract.createWorker('por');
    await ocrWorker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÂÊÔÃÕÇ0123456789 -.X|' });
    return ocrWorker;
  }
  function girar(cv, graus) {
    if (!graus) return cv;
    const o = document.createElement('canvas'), v = graus % 180 !== 0;
    o.width = v ? cv.height : cv.width; o.height = v ? cv.width : cv.height;
    const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height);
    c.translate(o.width / 2, o.height / 2); c.rotate(graus * Math.PI / 180); c.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return o;
  }
  // "2 MANGA 2X - 6 - 6" → { nome: "2 MANGA", qtd: 2 }
  function nomeDoRotulo(t) {
    t = String(t || '').toUpperCase().replace(/\|/g, '1').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(.*?)\s*(\d+)\s*X\b/);
    const nome = (m ? m[1] : t.replace(/[\s\-.\d]+$/, '')).replace(/[^A-ZÀ-Ú0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    return { nome, qtd: m ? +m[2] : null, texto: t };
  }
  async function lerNome(cv) {
    if (!cv) return null;
    const w = await ocr();
    let melhor = null;
    for (const g of (cv.height > cv.width * 1.5 ? [90, 270, 0, 180] : [0, 180, 90, 270])) {
      const { data } = await w.recognize(girar(cv, g));
      const r = nomeDoRotulo(data.text), letras = (r.nome.match(/[A-ZÀ-Ú]/g) || []).length;
      const sc = (r.qtd ? 50 : 0) + letras + (data.confidence || 0) / 10;
      if (!melhor || sc > melhor.sc) melhor = { ...r, sc };
      if (r.qtd && letras >= 3 && data.confidence > 60) break;
    }
    return melhor && melhor.nome.replace(/[^A-ZÀ-Ú]/g, '').length >= 3 ? melhor : null;
  }

  // Gira/espelha uma máscara: t = 0..7 (bit 1-2 = quartos de volta, bit 3 = espelho)
  function transformar(f, t) {
    const rot = t & 3, esp = t >> 2;
    const w2 = rot % 2 ? f.h : f.w, h2 = rot % 2 ? f.w : f.h, o = new Uint8Array(w2 * h2);
    for (let y = 0; y < f.h; y++) for (let x0 = 0; x0 < f.w; x0++) {
      if (!f.m[y * f.w + x0]) continue;
      const x = esp ? f.w - 1 - x0 : x0;
      let X, Y;
      if (rot === 0) { X = x; Y = y; } else if (rot === 1) { X = f.h - 1 - y; Y = x; } else if (rot === 2) { X = f.w - 1 - x; Y = f.h - 1 - y; } else { X = y; Y = f.w - 1 - x; }
      o[Y * w2 + X] = 1;
    }
    return { w: w2, h: h2, m: o };
  }
  // Grade pequena (G×G) da forma esticada na caixa: compara formatos sem ligar para o tamanho.
  function miniatura(m, w, h, G = 40) {
    const g = new Uint8Array(G * G);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) g[y * G + x] = m[Math.min(h - 1, Math.floor((y + 0.5) * h / G)) * w + Math.min(w - 1, Math.floor((x + 0.5) * w / G))];
    return g;
  }
  // Põe o molde na mesma posição da peça do arquivo (em pé/deitado, virado, espelhado): a que mais coincide.
  function orientar(f, mask, w, h) {
    const ref = miniatura(mask, w, h), asp = w / h;
    let best = null;
    for (let t = 0; t < 8; t++) {
      const rot = t & 3, fw = rot % 2 ? f.h : f.w, fh = rot % 2 ? f.w : f.h;
      // só vale girar se a proporção combina (largura × altura parecidas com a peça do arquivo)
      const pen = Math.abs(Math.log((fw / fh) / asp));
      const g = transformar({ w: f.w, h: f.h, m: miniatura(f.m, f.w, f.h) }, t);   // miniatura girada
      const gm = miniatura(g.m, g.w, g.h);
      let inter = 0, uni = 0; for (let i = 0; i < gm.length; i++) { if (gm[i] && ref[i]) inter++; if (gm[i] || ref[i]) uni++; }
      const sc = (uni ? inter / uni : 0) - pen * 0.5 - (t >> 2) * 0.01;
      if (!best || sc > best.sc) best = { t, sc };
    }
    return Object.assign(transformar(f, best.t), { sc: best.sc });
  }


  // Casa duas listas de peças (A = referência, B = outro tamanho). A peça pode estar deitada no PDF (largura e altura trocadas).
  // Devolve para cada índice de A: { j, girada } ou null.
  function casar(A, B) {
    const ar = p => p.w * p.h;
    const a = [...A].sort((p, q) => ar(q) - ar(p)), b = [...B].sort((p, q) => ar(q) - ar(p));
    const k = []; for (let i = 0; i < Math.min(a.length, b.length); i++) k.push(Math.sqrt(ar(b[i]) / ar(a[i])));
    k.sort((x, y) => x - y);
    const s = k.length ? k[k.length >> 1] : 1;
    const pares = [];
    A.forEach((p, i) => B.forEach((q, j) => {
      const reto = Math.abs(Math.log(q.w / (s * p.w))) + Math.abs(Math.log(q.h / (s * p.h)));
      const deit = Math.abs(Math.log(q.h / (s * p.w))) + Math.abs(Math.log(q.w / (s * p.h)));
      pares.push({ i, j, c: Math.min(reto, deit), girada: deit < reto });
    }));
    pares.sort((x, y) => x.c - y.c);
    const res = A.map(() => null), usadoB = new Set();
    for (const p of pares) {
      if (res[p.i] || usadoB.has(p.j) || p.c > 0.9) continue;
      res[p.i] = { j: p.j, girada: p.girada, custo: p.c }; usadoB.add(p.j);
    }
    return res;
  }

  // Valor num tamanho a partir dos pontos conhecidos [{i: posição na grade, v}] (reta entre os vizinhos; fora deles, segue a última inclinação).
  function interpolar(pts, i) {
    if (!pts.length) return null;
    const p = [...pts].sort((x, y) => x.i - y.i);
    const igual = p.find(q => q.i === i); if (igual) return igual.v;
    if (p.length === 1) return null;
    let a = p[0], b = p[1];
    for (let k = 0; k < p.length - 1; k++) { a = p[k]; b = p[k + 1]; if (i < b.i) break; }
    return a.v + (b.v - a.v) * (i - a.i) / (b.i - a.i);
  }

  // ---------- Grades salvas (ficam neste computador; dá para exportar e levar para outro) ----------
  const CHAVE = 'ppx_grades_salvas';
  function lista() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; } }
  function gravar(obj) { try { localStorage.setItem(CHAVE, JSON.stringify(obj)); return true; } catch (e) { return false; } }
  function salvar(g) { const l = lista(); l[g.nome] = g; return gravar(l); }
  function excluir(nome) { const l = lista(); delete l[nome]; return gravar(l); }
  function importar(json) {
    const o = JSON.parse(json), l = lista(); let n = 0;
    for (const g of Array.isArray(o) ? o : Object.values(o)) if (g && g.nome && Array.isArray(g.pecas)) { l[g.nome] = g; n++; }
    gravar(l); return n;
  }

  return { ler, forma, lerNome, nomeDoRotulo, orientar, casar, interpolar, tamDoNome, modeloDoNome, lista, salvar, excluir, importar };
})();
