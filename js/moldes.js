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
        pecas.push({ w: U.cm(w, DPI), h: U.cm(h, DPI), area: U.cm(1, DPI) ** 2 * n, pag: pn, x: U.cm(x0, DPI), y: U.cm(y0, DPI) });
      }
    }
    pecas.sort((p, q) => q.area - p.area);
    pecas.forEach((p, i) => { p.n = i + 1; });
    return pecas;
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

  return { ler, casar, interpolar, tamDoNome, modeloDoNome, lista, salvar, excluir, importar };
})();
