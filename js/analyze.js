// Leitura do encaixe base: acha cada peça pelo contorno, a cor de fundo e onde está a estampa.
const Analyze = (() => {
  const isDark = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx < 100 && mx - mn < 45; };

  // Preenchimento por faixas horizontais. can(i) diz se o pixel i pode ser pintado;
  // span(y, l, r) pinta a faixa e precisa fazer can() passar a devolver false nela.
  function scanFill(w, h, x0, y0, can, span) {
    const st = [x0, y0];
    while (st.length) {
      const y = st.pop(), x = st.pop(), row = y * w;
      if (!can(row + x)) continue;
      let l = x, r = x;
      while (l > 0 && can(row + l - 1)) l--;
      while (r < w - 1 && can(row + r + 1)) r++;
      span(y, l, r);
      for (const ny of [y - 1, y + 1]) {
        if (ny < 0 || ny >= h) continue;
        const nr = ny * w; let open = false;
        for (let k = l; k <= r; k++) {
          if (can(nr + k)) { if (!open) { st.push(k, ny); open = true; } } else open = false;
        }
      }
    }
  }

  function classify(p) {
    const asp = p.w / p.h, fill = p.area / (p.w * p.h);
    if (asp >= 6 || asp <= 1 / 6) return 'vies';
    if (fill > 0.95) return 'ret';
    if (asp > 0.8 && asp < 1.25 && fill > 0.7 && fill < 0.86) return 'circ';
    const cov = y => { let c = 0; const o = y * p.w; for (let x = 0; x < p.w; x++) c += p.mask[o + x]; return c / p.w; };
    const top = cov(Math.floor(p.h * 0.04)), bot = cov(Math.min(p.h - 1, Math.floor(p.h * 0.96)));
    if (Math.max(top, bot) > 0.9 && Math.min(top, bot) < 0.6) return 'peito';
    return 'saia';
  }

  function defaultRule(p) {
    const hasArt = p.artFrac > 0.005;
    if (!hasArt) return 'fundo';
    if (p.type === 'saia') return 'barra';
    if (p.type === 'vies') return 'esticar';
    return 'fixa';
  }

  async function run(img, dpi, log) {
    const { width: w, height: h, data: d } = img, N = w * h;
    const times = {};
    let t = U.now();

    log('Separando o que é peça do que é fundo do papel…'); await U.tick();
    const out = new Uint8Array(N);
    const pass = i => { const o = i << 2; return d[o + 3] < 128 || (d[o] > 200 && d[o + 1] > 200 && d[o + 2] > 200); };
    const canOut = i => out[i] === 0 && pass(i);
    const spanOut = (y, l, r) => out.fill(1, y * w + l, y * w + r + 1);
    for (let x = 0; x < w; x++) { scanFill(w, h, x, 0, canOut, spanOut); scanFill(w, h, x, h - 1, canOut, spanOut); }
    for (let y = 0; y < h; y++) { scanFill(w, h, 0, y, canOut, spanOut); scanFill(w, h, w - 1, y, canOut, spanOut); }
    times.fundo = U.now() - t; t = U.now();

    log('Contando as peças…'); await U.tick();
    const lab = new Uint16Array(N), comps = [];
    let n = 0;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (out[i] || lab[i]) continue;
        n++;
        if (n > 65000) throw new Error('Há muitas regiões soltas no arquivo. Confira se o fundo fora das peças está branco ou transparente.');
        const c = { id: n, x0: x, y0: y, x1: x, y1: y, area: 0 }, id = n;
        scanFill(w, h, x, y, j => out[j] === 0 && lab[j] === 0, (yy, l, r) => {
          lab.fill(id, yy * w + l, yy * w + r + 1);
          c.area += r - l + 1;
          if (l < c.x0) c.x0 = l; if (r > c.x1) c.x1 = r; if (yy > c.y1) c.y1 = yy;
        });
        comps.push(c);
      }
    }
    const minArea = Math.pow(2 / 2.54 * dpi, 2); // menos de 2 x 2 cm é texto ou sujeira
    const kept = comps.filter(c => c.area >= minArea);
    const ignored = comps.length - kept.length;
    const rowBand = 3 / 2.54 * dpi;
    kept.sort((a, b) => Math.round(a.y0 / rowBand) - Math.round(b.y0 / rowBand) || a.x0 - b.x0);
    times.pecas = U.now() - t; t = U.now();

    log(`Recortando ${kept.length} peças…`); await U.tick();
    const pieces = kept.map((c, k) => {
      const W = c.x1 - c.x0 + 1, H = c.y1 - c.y0 + 1;
      const mask = new Uint8Array(W * H), rgba = new Uint8ClampedArray(W * H * 4);
      for (let yy = 0; yy < H; yy++) {
        const sr = (c.y0 + yy) * w + c.x0;
        for (let xx = 0; xx < W; xx++) {
          const i = sr + xx;
          if (lab[i] !== c.id) continue;
          const kk = yy * W + xx, o = i << 2, q = kk << 2;
          mask[kk] = 1; rgba[q] = d[o]; rgba[q + 1] = d[o + 1]; rgba[q + 2] = d[o + 2]; rgba[q + 3] = 255;
        }
      }
      return { n: k + 1, x: c.x0, y: c.y0, w: W, h: H, area: c.area, mask, rgba };
    });

    // Espessura do contorno de cada peça: pixels escuros seguidos a partir das bordas esquerda e de cima.
    const median = a => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    const fallback = Math.max(1, Math.round(dpi * 0.0197));
    const all = [];
    for (const p of pieces) {
      const runs = [];
      const walk = (start, step, len) => {
        let i = 0; while (i < len && !p.mask[start + i * step]) i++;
        let r = 0;
        while (i + r < len && p.mask[start + (i + r) * step]) { const q = (start + (i + r) * step) * 4; if (!isDark(p.rgba[q], p.rgba[q + 1], p.rgba[q + 2])) break; r++; }
        if (r > 0) runs.push(r);
      };
      for (const f of [0.25, 0.5, 0.75]) walk(Math.floor(p.h * f) * p.w, 1, p.w);
      for (const f of [0.25, 0.5, 0.75]) walk(Math.floor(p.w * f), p.w, p.h);
      p.thick = runs.length ? Math.max(1, Math.min(80, median(runs))) : fallback;
      all.push(p.thick);
    }
    const thick = all.length ? median(all.slice()) : fallback;

    log('Lendo a estampa e a cor de fundo…'); await U.tick();
    const cnt = new Uint32Array(32768), sum = new Float64Array(32768 * 3);
    let oc = [0, 0, 0, 0];
    for (const p of pieces) {
      p.band = new Uint8Array(p.w * p.h);
      const er = U.box(p.mask, p.w, p.h, p.thick + 2, 'min');
      for (let i = 0; i < p.mask.length; i++) {
        if (!p.mask[i]) continue;
        const q = i * 4, r = p.rgba[q], g = p.rgba[q + 1], b = p.rgba[q + 2];
        if (!er[i]) { p.band[i] = 1; if (isDark(r, g, b)) { oc[0] += r; oc[1] += g; oc[2] += b; oc[3]++; } continue; }
        const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
        cnt[key]++; sum[key * 3] += r; sum[key * 3 + 1] += g; sum[key * 3 + 2] += b;
      }
    }
    let mode = 0;
    for (let k = 1; k < 32768; k++) if (cnt[k] > cnt[mode]) mode = k;
    const bg = cnt[mode] ? [0, 1, 2].map(j => Math.round(sum[mode * 3 + j] / cnt[mode])) : [255, 255, 255];
    const outline = oc[3] ? [0, 1, 2].map(j => Math.round(oc[j] / oc[3])) : [26, 26, 26];

    for (const p of pieces) {
      p.art = new Uint8Array(p.w * p.h);
      let ac = 0, sx = 0, sy = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const i = y * p.w + x;
        if (!p.mask[i]) continue;
        const q = i * 4, r = p.rgba[q], g = p.rgba[q + 1], b = p.rgba[q + 2];
        const dist2 = (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2;
        let isArt = dist2 > 300;
        if (isArt && p.band[i]) isArt = !isDark(r, g, b) && (0.299 * r + 0.587 * g + 0.114 * b) >= 110;
        if (isArt) { p.art[i] = 1; ac++; sx += x; sy += y; }
      }
      p.artCount = ac;
      p.artFrac = ac / p.area;
      const cx = ac ? sx / ac / p.w : 0.5, cy = ac ? sy / ac / p.h : 0.5;
      p.anchorX = cx < 0.4 ? 'left' : cx > 0.6 ? 'right' : 'center';
      p.anchorY = cy < 0.4 ? 'top' : cy > 0.6 ? 'bottom' : 'center';
      p.edge = cy >= 0.5 ? 'bottom' : 'top';
      const pr = U.profiles(p.mask, p.w, p.h); p.top = pr.top; p.bot = pr.bot;
      p.type = classify(p);
      p.rule = defaultRule(p);
    }
    times.estampa = U.now() - t;

    const pv = U.preview(d, w, h, 4, 1400);
    return { w, h, dpi, pieces, bg, outline, thick, ignored, times, preview: pv.canvas, pf: pv.f };
  }

  // Junta peças iguais (mesmo tipo e mesma medida) para a grade.
  function group(pieces) {
    const gs = [];
    for (const p of pieces) {
      let g = gs.find(g => g.type === p.type && Math.abs(g.w - p.w) / g.w < 0.03 && Math.abs(g.h - p.h) / g.h < 0.03);
      if (!g) { g = { type: p.type, w: p.w, h: p.h, items: [] }; gs.push(g); }
      g.items.push(p);
    }
    const byType = {};
    gs.forEach(g => (byType[g.type] = byType[g.type] || []).push(g));
    Object.values(byType).forEach(arr => arr.forEach((g, i) => { g.letter = arr.length > 1 ? String.fromCharCode(65 + i) : ''; g.id = g.type + '-' + i; }));
    return gs;
  }

  return { run, group };
})();
