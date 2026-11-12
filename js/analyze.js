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
    if (p.type === 'vies') return 'esticar';
    // a estampa acompanha a graduação: os elementos mudam de lugar e de tamanho junto com a peça, sem deformar
    return 'acompanha';
  }

  // Menor retângulo em volta da peça (por qualquer ângulo). Se a peça está torta (o retângulo reto em volta dela é
  // bem maior que o menor), gira a peça para ficar reta. Guarda o giro em p.endireitada (graus).
  function endireitar(p) {
    const { w, h, mask } = p, pts = [];
    for (let y = 0; y < h; y++) {
      let l = -1, r = -1; const o = y * w;
      for (let x = 0; x < w; x++) if (mask[o + x]) { if (l < 0) l = x; r = x; }
      if (l >= 0) { pts.push([l, y], [r + 1, y], [l, y + 1], [r + 1, y + 1]); }
    }
    if (pts.length < 8) return;
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    const hull = lo.slice(0, -1).concat(up.slice(0, -1));
    let melhor = { area: w * h, a: 0 };
    for (let i = 0; i < hull.length; i++) {
      const A = hull[i], B = hull[(i + 1) % hull.length], a = Math.atan2(B[1] - A[1], B[0] - A[0]);
      const c = Math.cos(-a), s = Math.sin(-a);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of hull) { const X = x * c - y * s, Y = x * s + y * c; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
      const ar = (x1 - x0) * (y1 - y0);
      if (ar < melhor.area) melhor = { area: ar, a };
    }
    let deg = melhor.a * 180 / Math.PI;
    deg = ((deg % 90) + 90) % 90; if (deg > 45) deg -= 90;          // o giro menor que deixa a peça reta
    if (Math.abs(deg) < 4 || melhor.area > 0.9 * w * h) return;      // já está reta (ou o formato é assim mesmo)
    const rad = -deg * Math.PI / 180, cs = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
    const W2 = Math.ceil(w * cs + h * sn) + 2, H2 = Math.ceil(w * sn + h * cs) + 2;
    const a1 = document.createElement('canvas'); a1.width = w; a1.height = h;
    const id = a1.getContext('2d').createImageData(w, h); id.data.set(p.rgba);
    for (let i = 0; i < w * h; i++) if (!mask[i]) id.data[i * 4 + 3] = 0;
    a1.getContext('2d').putImageData(id, 0, 0);
    const b1 = document.createElement('canvas'); b1.width = W2; b1.height = H2;
    const ctx = b1.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(W2 / 2, H2 / 2); ctx.rotate(rad); ctx.drawImage(a1, -w / 2, -h / 2);
    const d = ctx.getImageData(0, 0, W2, H2).data; a1.width = a1.height = b1.width = b1.height = 1;
    let x0 = W2, y0 = H2, x1 = -1, y1 = -1;
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (d[(y * W2 + x) * 4 + 3] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return;
    const nw = x1 - x0 + 1, nh = y1 - y0 + 1, nm = new Uint8Array(nw * nh), nr = new Uint8ClampedArray(nw * nh * 4);
    let area = 0;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const q = ((y + y0) * W2 + x + x0) * 4; if (d[q + 3] < 128) continue;
      const k = y * nw + x; nm[k] = 1; area++; nr[k * 4] = d[q]; nr[k * 4 + 1] = d[q + 1]; nr[k * 4 + 2] = d[q + 2]; nr[k * 4 + 3] = 255;
    }
    const cx = p.x + w / 2, cy = p.y + h / 2;
    Object.assign(p, { x: Math.round(cx - nw / 2), y: Math.round(cy - nh / 2), w: nw, h: nh, mask: nm, rgba: nr, area, endireitada: Math.round(deg * 10) / 10,
      // para desenhar a caixa e os nomes no arquivo como ele é (torto): centro do giro e deslocamento do recorte
      giro0: { a: deg * Math.PI / 180, cx, cy, ox: x0 + nw / 2 - W2 / 2, oy: y0 + nh / 2 - H2 / 2 } });
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
    // peça desenhada torta no arquivo (ex.: uma costas girada uns 30°): endireita, senão ela não casa com o molde
    // da modelista e sai com outra medida (Vestido Antonella, 12/11)
    pieces.forEach(endireitar);

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

  // Miniatura da peça (G×G, esticada na caixa) e giro/espelho dela: t = quartos de volta no sentido horário (bits 1-2) + espelho (bit 3).
  const G = 32;
  function mini(p) {
    if (p._mini) return p._mini;
    const g = new Uint8Array(G * G);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) g[y * G + x] = p.mask[Math.min(p.h - 1, Math.floor((y + 0.5) * p.h / G)) * p.w + Math.min(p.w - 1, Math.floor((x + 0.5) * p.w / G))];
    return (p._mini = g);
  }
  function girarMini(m, t) {
    const rot = t & 3, esp = t >> 2, o = new Uint8Array(G * G);
    for (let y = 0; y < G; y++) for (let x0 = 0; x0 < G; x0++) {
      if (!m[y * G + x0]) continue;
      const x = esp ? G - 1 - x0 : x0;
      const [X, Y] = rot === 0 ? [x, y] : rot === 1 ? [G - 1 - y, x] : rot === 2 ? [G - 1 - x, G - 1 - y] : [y, G - 1 - x];
      o[Y * G + X] = 1;
    }
    return o;
  }
  // A peça p é a mesma peça g (mesmo contorno), só que virada/girada/espelhada no arquivo? Devolve o t ou -1.
  function mesmaPeca(g, p) {
    const a = g.items[0], ok = (u, v) => Math.abs(u - v) / v < 0.03;
    let best = -1, bs = 0.9;
    for (let t = 0; t < 8; t++) {
      const odd = (t & 3) % 2 === 1;
      if (odd ? !(ok(p.w, a.h) && ok(p.h, a.w)) : !(ok(p.w, a.w) && ok(p.h, a.h))) continue;
      const m = girarMini(mini(a), t), q = mini(p);
      let i2 = 0, u = 0; for (let i = 0; i < m.length; i++) { if (m[i] && q[i]) i2++; if (m[i] || q[i]) u++; }
      const s = u ? i2 / u : 0;
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }

  // Junta peças iguais para a grade — também quando a mesma peça está girada, de cabeça para baixo ou espelhada no arquivo
  // (ex.: as duas costas em posições diferentes). Cada peça guarda como está em relação à primeira (p.t): a graduação
  // e o molde acompanham a posição de cada uma, e o desenho dela continua do jeito que está nela.
  function group(pieces) {
    const gs = [];
    for (const p of pieces) {
      let g = null, t = 0;
      for (const c of gs) { if (c.type !== p.type && !(Math.abs(c.w - p.h) / c.w < 0.03 && Math.abs(c.h - p.w) / c.h < 0.03)) continue; const tt = mesmaPeca(c, p); if (tt >= 0) { g = c; t = tt; break; } }
      if (!g) { g = { type: p.type, w: p.w, h: p.h, items: [] }; gs.push(g); t = 0; }
      p.t = t;
      g.items.push(p);
    }
    const byType = {};
    gs.forEach(g => (byType[g.type] = byType[g.type] || []).push(g));
    Object.values(byType).forEach(arr => arr.forEach((g, i) => { g.letter = arr.length > 1 ? String.fromCharCode(65 + i) : ''; g.id = g.type + '-' + i; }));
    return gs;
  }

  return { run, group };
})();
