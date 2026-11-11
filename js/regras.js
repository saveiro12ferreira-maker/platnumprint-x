// Tabela de graduação da modelista (como no Audaces): pontos da peça + DX/DY por tamanho.
// Convenção da tabela dela: DX + para a direita, DY + para CIMA, em cm. Cada linha de um tamanho é quanto o ponto anda
// do tamanho vizinho (o mais perto do tamanho base) até ele. Ex.: base 12 → linha do 10 = do 12 para o 10; linha do 8 = do 10 para o 8.
// Os pontos do contorno que não têm regra andam junto com os vizinhos que têm (proporcional à distância pelo contorno).
const Regras = (() => {
  // Contorno da peça base (px, y para baixo), um pouco simplificado. Guardado na peça.
  function contorno(p) {
    if (p._cont) return p._cont;
    const pts = Corel.simplify(Corel.trace(p.mask, p.w, p.h), Math.max(1, Math.min(p.w, p.h) * 0.0015));
    if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    return (p._cont = pts);
  }

  // Cantos (onde a linha muda de direção): sugestão de pontos de graduação.
  function cantos(p) {
    const c = contorno(p), n = c.length; if (n < 4) return [];
    const L = Math.max(p.w, p.h), grosso = Corel.simplify(c.concat([c[0]]), L * 0.012);
    const idx = [];
    for (let k = 0; k < grosso.length - 1; k++) {
      const a = grosso[(k - 1 + grosso.length - 1) % (grosso.length - 1)], b = grosso[k], d = grosso[(k + 1) % (grosso.length - 1)];
      const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [d[0] - b[0], d[1] - b[1]];
      const ang = Math.abs(Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1])) * 180 / Math.PI;
      if (ang < 28) continue;
      let best = 0, bd = Infinity;
      c.forEach((q, i) => { const dd = (q[0] - b[0]) ** 2 + (q[1] - b[1]) ** 2; if (dd < bd) { bd = dd; best = i; } });
      if (!idx.includes(best)) idx.push(best);
    }
    return idx.sort((x, y) => x - y);
  }

  // Ponto do contorno mais perto de (fx, fy) na caixa da peça.
  function pontoPerto(p, fx, fy) {
    const c = contorno(p), x = fx * p.w, y = fy * p.h;
    let best = 0, bd = Infinity;
    c.forEach((q, i) => { const d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }

  // Deslocamento acumulado (cm) de um ponto do tamanho base até o tamanho pedido.
  function acumulado(tab, sizes, base, size) {
    const i = sizes.indexOf(size), ib = sizes.indexOf(base);
    if (i < 0 || ib < 0) return null;
    let dx = 0, dy = 0, tem = false;
    const passos = i < ib ? sizes.slice(i, ib) : sizes.slice(ib + 1, i + 1);
    for (const s of passos) { const v = tab[s]; if (v && (v[0] !== '' && v[0] != null || v[1] !== '' && v[1] != null)) { dx += +v[0] || 0; dy += +v[1] || 0; tem = true; } }
    return tem || i === ib ? [dx, dy] : [0, 0];
  }

  // Contorno graduado (px, y para baixo) da peça no tamanho pedido. regra = { pontos: [{ i, tab }] }.
  function graduar(p, regra, sizes, base, size, dpi) {
    const c = contorno(p), n = c.length;
    const pts = (regra && regra.pontos || []).filter(q => q.tab && Object.values(q.tab).some(v => v && (+v[0] || +v[1])));
    if (!pts.length || size === base) return null;
    const k = dpi / 2.54;
    // comprimento acumulado ao longo do contorno
    const acc = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) { const a = c[i - 1], b = c[i % n]; acc[i] = acc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const total = acc[n];
    const regs = pts.map(q => { const d = acumulado(q.tab, sizes, base, size) || [0, 0]; return { i: q.i, dx: d[0] * k, dy: -d[1] * k }; }).sort((a, b) => a.i - b.i);
    const out = [];
    for (let i = 0; i < n; i++) {
      let dx, dy;
      if (regs.length === 1) { dx = regs[0].dx; dy = regs[0].dy; }
      else {
        // vizinhos com regra antes e depois (contorno fechado)
        let a = regs[regs.length - 1], b = regs[0];
        for (let r = 0; r < regs.length; r++) { if (regs[r].i <= i) a = regs[r]; }
        for (let r = regs.length - 1; r >= 0; r--) { if (regs[r].i >= i) b = regs[r]; }
        if (a.i === i) { dx = a.dx; dy = a.dy; }
        else {
          const da = (acc[i] - acc[a.i] + total) % total, db = (acc[b.i] - acc[i] + total) % total, t = da + db > 0 ? da / (da + db) : 0;
          dx = a.dx * (1 - t) + b.dx * t; dy = a.dy * (1 - t) + b.dy * t;
        }
      }
      out.push([c[i][0] + dx, c[i][1] + dy]);
    }
    return out;
  }

  function caixa(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  // Desenha o contorno graduado numa máscara { w, h, m }.
  function mascara(pts) {
    const bx = caixa(pts), W = Math.max(1, Math.round(bx.w) + 1), H = Math.max(1, Math.round(bx.h) + 1);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x - bx.x0 + 0.5, y - bx.y0 + 0.5));
    ctx.closePath(); ctx.fill();
    const d = ctx.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    cv.width = cv.height = 1;
    return { w: W, h: H, m };
  }

  // Leva as regras de uma peça para outra do mesmo grupo (igual ou espelhada): ponto pelo lugar na caixa, DX trocado se espelhada.
  function espelhar(regra, pDe, pPara) {
    const mi = (m, w, h, G = 32) => { const g = new Uint8Array(G * G); for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) g[y * G + x] = m[Math.min(h - 1, Math.floor((y + 0.5) * h / G)) * w + Math.min(w - 1, Math.floor((x + 0.5) * w / G))]; return g; };
    const A = mi(pDe.mask, pDe.w, pDe.h), B = mi(pPara.mask, pPara.w, pPara.h), G = 32;
    let igual = 0, esp = 0;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { if (A[y * G + x] === B[y * G + x]) igual++; if (A[y * G + x] === B[y * G + G - 1 - x]) esp++; }
    const espelhada = esp > igual;
    const c = contorno(pDe);
    return { espelhada, pontos: regra.pontos.map(q => {
      const fx = c[q.i][0] / pDe.w, fy = c[q.i][1] / pDe.h;
      const tab = {}; for (const [s, v] of Object.entries(q.tab || {})) tab[s] = espelhada ? [v[0] === '' || v[0] == null ? v[0] : -v[0], v[1]] : [v[0], v[1]];
      return { i: pontoPerto(pPara, espelhada ? 1 - fx : fx, fy), nome: q.nome, tab };
    }) };
  }

  return { contorno, cantos, pontoPerto, acumulado, graduar, caixa, mascara, espelhar };
})();
