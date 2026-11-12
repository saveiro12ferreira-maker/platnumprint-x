// Motor de grade: refaz cada peça na medida nova, recoloca a estampa pela regra e encaixa no rolo.
const Grade = (() => {
  const RULE_NAMES = { acompanha: 'acompanha a graduação', barra: 'segue a barra', fixa: 'estampa fixa', esticar: 'estica com a peça', fundo: 'só fundo' };

  // Elementos da estampa de uma peça: cada bloco de desenho (flor, vaso, faixa) separado, com centro e caixa.
  // Partes que quase se tocam (até ~1,5 mm) contam como o mesmo elemento.
  function elementos(p) {
    if (p._elem) return p._elem;
    const W = p.w, H = p.h, r = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    const dil = U.box(p.art, W, H, r, 'max');
    for (let i = 0; i < dil.length; i++) if (!p.mask[i] || p.band[i]) dil[i] = 0;
    const lab = new Int32Array(W * H), fila = new Int32Array(W * H), lista = [];
    let id = 0;
    for (let s0 = 0; s0 < W * H; s0++) {
      if (!dil[s0] || lab[s0]) continue;
      id++; let a = 0, bq = 0, n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; fila[bq++] = s0; lab[s0] = id;
      while (a < bq) {
        const i = fila[a++], x = i % W, y = (i / W) | 0;
        if (p.art[i]) { n++; sx += x; sy += y; }
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && dil[i - 1] && !lab[i - 1]) { lab[i - 1] = id; fila[bq++] = i - 1; }
        if (x < W - 1 && dil[i + 1] && !lab[i + 1]) { lab[i + 1] = id; fila[bq++] = i + 1; }
        if (y > 0 && dil[i - W] && !lab[i - W]) { lab[i - W] = id; fila[bq++] = i - W; }
        if (y < H - 1 && dil[i + W] && !lab[i + W]) { lab[i + W] = id; fila[bq++] = i + W; }
      }
      if (!n) continue;
      lista.push({ id, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, y0, x1, y1, largo: (x1 - x0) > W * 0.5 });
    }
    return (p._elem = { lab, lista });
  }

  // Refaz uma peça com largura Wt e altura Ht (pixels, sem sangria).
  // Borda macia da estampa (vídeo/print 12/11: margaridas ganhavam contorno azul ao trocar o fundo para verde).
  // Na beira de cada desenho, o pixel é uma mistura da cor do desenho com o fundo antigo. Aqui guardamos quanto de
  // desenho tem em cada pixel da beira (255 = só desenho), para trocar só a parte do fundo pela cor nova.
  function alfaDe(p, bg0) {
    const key = bg0.join(',');
    if (p._alfa && p._alfa.key === key) return p._alfa.a;
    const W = p.w, H = p.h, A = p.art, S = p.rgba, M = p.mask, a = new Uint8Array(W * H).fill(255);
    const R = 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!A[i]) continue;
      // só a beira: algum vizinho perto é fundo
      let beira = false;
      for (let dy = -2; dy <= 2 && !beira; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (M[j] && !A[j] && !p.band[j]) { beira = true; break; }
      }
      if (!beira) continue;
      // cor "cheia" do desenho ali perto = a mais longe do fundo antigo
      let fr = -1, fg = 0, fb = 0, fd = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!A[j]) continue;
        const q = j * 4, d = (S[q] - bg0[0]) ** 2 + (S[q + 1] - bg0[1]) ** 2 + (S[q + 2] - bg0[2]) ** 2;
        if (d > fd) { fd = d; fr = S[q]; fg = S[q + 1]; fb = S[q + 2]; }
      }
      if (fr < 0 || fd < 900) continue;
      const q = i * 4, px = S[q] - bg0[0], py = S[q + 1] - bg0[1], pz = S[q + 2] - bg0[2];
      const t = (px * (fr - bg0[0]) + py * (fg - bg0[1]) + pz * (fb - bg0[2])) / fd;
      a[i] = Math.round(255 * Math.max(0, Math.min(1, t)));
    }
    p._alfa = { key, a };
    return a;
  }
  // pinta o pixel k da estampa em out[q]: com fundo novo, a parte de fundo antigo da beira vira a cor nova
  function pintaArte(out, q, S, k, alfa, bg, bg0) {
    const s4 = k * 4;
    if (alfa && alfa[k] < 255) {
      const f = 1 - alfa[k] / 255;
      out[q] = S[s4] + f * (bg[0] - bg0[0]); out[q + 1] = S[s4 + 1] + f * (bg[1] - bg0[1]); out[q + 2] = S[s4 + 2] + f * (bg[2] - bg0[2]);
    } else { out[q] = S[s4]; out[q + 1] = S[s4 + 1]; out[q + 2] = S[s4 + 2]; }
  }

  function renderPiece(p, Wt, Ht, o) {
    const W = p.w, H = p.h, sx = Wt / W, sy = Ht / H, b = o.bleed | 0, OW = Wt + 2 * b, OH = Ht + 2 * b;
    const mapX = new Int32Array(Wt), mapY = new Int32Array(Ht);
    for (let x = 0; x < Wt; x++) mapX[x] = Math.min(W - 1, Math.floor((x + 0.5) / sx));
    for (let y = 0; y < Ht; y++) mapY[y] = Math.min(H - 1, Math.floor((y + 0.5) / sy));

    // Molde novo: o contorno exato do PDF da modelista desse tamanho (o.forma) ou, sem PDF, o contorno original ampliado/reduzido.
    const nm = new Uint8Array(Wt * Ht);
    if (o.forma) {
      const F = o.forma;
      for (let y = 0; y < Ht; y++) {
        const sr = Math.min(F.h - 1, Math.floor((y + 0.5) * F.h / Ht)) * F.w, r = y * Wt;
        for (let x = 0; x < Wt; x++) nm[r + x] = F.m[sr + Math.min(F.w - 1, Math.floor((x + 0.5) * F.w / Wt))];
      }
    } else for (let y = 0; y < Ht; y++) {
      const sr = mapY[y] * W, r = y * Wt;
      for (let x = 0; x < Wt; x++) nm[r + x] = p.mask[sr + mapX[x]];
    }

    const out = new Uint8ClampedArray(OW * OH * 4);
    const [br, bgG, bb] = o.bg;
    if (b > 0) {
      const pm = new Uint8Array(OW * OH);
      for (let y = 0; y < Ht; y++) pm.set(nm.subarray(y * Wt, (y + 1) * Wt), (y + b) * OW + b);
      const dl = U.box(pm, OW, OH, b, 'max');
      for (let i = 0; i < dl.length; i++) if (dl[i]) { const q = i * 4; out[q] = br; out[q + 1] = bgG; out[q + 2] = bb; out[q + 3] = 255; }
    }

    const rule = o.rule, A = p.art, S = p.rgba;
    // fundo trocado: tira o "contorno" do fundo antigo em volta dos desenhos
    const bg0 = o.bg0, trocou = bg0 && (bg0[0] !== br || bg0[1] !== bgG || bg0[2] !== bb);
    const alfa = trocou && p.band ? alfaDe(p, bg0) : null;
    let dx = 0, dy = 0;
    if (rule === 'fixa') {
      dx = p.anchorX === 'left' ? 0 : p.anchorX === 'right' ? Wt - W : Math.round((Wt - W) / 2);
      dy = p.anchorY === 'top' ? 0 : p.anchorY === 'bottom' ? Ht - H : Math.round((Ht - H) / 2);
    }
    let nt = null, nb = null;
    if (rule === 'barra' || rule === 'barraEsc') { const pr = U.profiles(nm, Wt, Ht); nt = pr.top; nb = pr.bot; }
    const bottom = p.edge === 'bottom';

    let copied = 0, esperado = 0;
    if (rule === 'acompanha') {
      // ACOMPANHA A GRADUAÇÃO: cada elemento da estampa (vaso, flor, faixa) vai para o lugar proporcional no molde novo
      // e muda de tamanho junto com a graduação (12 → 2 diminui um pouco; 12 → 16 aumenta), sem deformar.
      // O que está perto da barra (ou do ombro) mantém a distância até ela proporcional, seguindo a curva nova.
      const E = elementos(p), s = Math.sqrt(sx * sy);
      if (!nb) { const pr = U.profiles(nm, Wt, Ht); nt = pr.top; nb = pr.bot; }
      for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
        if (!nm[y * Wt + x]) continue;
        const q = ((y + b) * OW + x + b) * 4; out[q] = br; out[q + 1] = bgG; out[q + 2] = bb; out[q + 3] = 255;
      }
      const pint = new Uint8Array(Wt * Ht);
      const coluna = (prof, x) => { x = Math.max(0, Math.min(prof.length - 1, x)); if (prof[x] >= 0) return prof[x]; for (let d = 1; d < prof.length; d++) { if (x - d >= 0 && prof[x - d] >= 0) return prof[x - d]; if (x + d < prof.length && prof[x + d] >= 0) return prof[x + d]; } return -1; };
      for (const e of E.lista) {
        const ex = e.largo ? sx : s, ey = s;
        const Xn = e.cx * sx;
        let Yn;
        if (e.cy > H * 0.5) { const sb = coluna(p.bot, Math.round(e.cx)), nbb = coluna(nb, Math.round(Xn)); Yn = sb >= 0 && nbb >= 0 ? nbb - (sb - e.cy) * s : e.cy * sy; }
        else { const st0 = coluna(p.top, Math.round(e.cx)), ntt = coluna(nt, Math.round(Xn)); Yn = st0 >= 0 && ntt >= 0 ? ntt + (e.cy - st0) * s : e.cy * sy; }
        // caixa nova do elemento, sem sair da peça
        let bx0 = Xn + (e.x0 - e.cx) * ex, bx1 = Xn + (e.x1 - e.cx) * ex, by0 = Yn + (e.y0 - e.cy) * ey, by1 = Yn + (e.y1 - e.cy) * ey;
        let dxs = 0, dys = 0;
        if (bx0 < 0) dxs = -bx0; else if (bx1 > Wt - 1) dxs = Wt - 1 - bx1;
        if (by0 < 0) dys = -by0; else if (by1 > Ht - 1) dys = Ht - 1 - by1;
        const X0n = Xn + dxs, Y0n = Yn + dys;
        esperado += e.n * ex * ey;
        const ya = Math.max(0, Math.floor(by0 + dys)), yb = Math.min(Ht - 1, Math.ceil(by1 + dys));
        const xa = Math.max(0, Math.floor(bx0 + dxs)), xb = Math.min(Wt - 1, Math.ceil(bx1 + dxs));
        // faixa larga (linha, renda, barrado corrido): segue a curva da barra coluna por coluna
        const embaixo = e.cy > H * 0.5, curva = e.largo;
        const y0c = curva ? 0 : ya, y1c = curva ? Ht - 1 : yb;
        for (let y = y0c; y <= y1c; y++) {
          const Yr = Math.round(e.cy + (y - Y0n) / ey);
          if (!curva && (Yr < 0 || Yr >= H)) continue;
          for (let x = xa; x <= xb; x++) {
            const i = y * Wt + x; if (!nm[i]) continue;
            const X = Math.round(e.cx + (x - X0n) / ex); if (X < 0 || X >= W) continue;
            let Y = Yr;
            if (curva) {
              if (embaixo) { const sb = p.bot[X], nbb = nb[x]; if (sb < 0 || nbb < 0) continue; Y = Math.round(sb - (nbb - y) / ey); }
              else { const st0 = p.top[X], ntt = nt[x]; if (st0 < 0 || ntt < 0) continue; Y = Math.round(st0 + (y - ntt) / ey); }
              if (Y < e.y0 || Y > e.y1) continue;
            }
            const k = Y * W + X;
            if (E.lab[k] !== e.id || p.band[k]) continue;
            const art = A[k];
            if (!art && pint[i]) continue;
            const q = ((y + b) * OW + x + b) * 4;
            // pixel quase da cor do fundo dentro do desenho: com fundo novo, leva a cor nova (não fica o "quadrado" do fundo antigo)
            if (!art && trocou) { const s4 = k * 4; out[q] = S[s4] + br - bg0[0]; out[q + 1] = S[s4 + 1] + bgG - bg0[1]; out[q + 2] = S[s4 + 2] + bb - bg0[2]; }
            else pintaArte(out, q, S, k, alfa, o.bg, bg0);
            if (art) { pint[i] = 1; copied++; }
          }
        }
      }
    } else
    for (let y = 0; y < Ht; y++) {
      for (let x = 0; x < Wt; x++) {
        const i = y * Wt + x;
        if (!nm[i]) continue;
        let X = -1, Y = -1;
        if (rule === 'esticar') { X = mapX[x]; Y = mapY[y]; }
        else if (rule === 'fixa') { X = x - dx; Y = y - dy; }
        else if (rule === 'barra') {
          // Mantém a distância até a borda da barra: as flores acompanham a curva nova sem mudar de altura.
          X = mapX[x];
          if (bottom) { const s = p.bot[X]; if (s >= 0) Y = s - (nb[x] - y); }
          else { const s = p.top[X]; if (s >= 0) Y = s + (y - nt[x]); }
        }
        else if (rule === 'barraEsc') {
          // Igual a "segue a barra", mas a altura das flores acompanha a graduação da peça (nada fica fora do molde).
          X = mapX[x];
          if (bottom) { const s = p.bot[X]; if (s >= 0) Y = s - Math.round((nb[x] - y) / sy); }
          else { const s = p.top[X]; if (s >= 0) Y = s + Math.round((y - nt[x]) / sy); }
        }
        const q = ((y + b) * OW + x + b) * 4;
        let k = -1;
        if (X >= 0 && X < W && Y >= 0 && Y < H) { k = Y * W + X; if (!A[k]) k = -1; }
        if (k >= 0) { pintaArte(out, q, S, k, alfa, o.bg, bg0); copied++; }
        else { out[q] = br; out[q + 1] = bgG; out[q + 2] = bb; }
        out[q + 3] = 255;
      }
    }

    if (o.thick > 0) {
      const er = U.box(nm, Wt, Ht, o.thick, 'min'), [r0, g0, b0] = o.outline;
      for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
        const i = y * Wt + x;
        if (nm[i] && !er[i]) { const q = ((y + b) * OW + x + b) * 4; out[q] = r0; out[q + 1] = g0; out[q + 2] = b0; }
      }
    }

    for (const L of (o.labels || (o.label ? [o.label] : []))) if (L && L.text) stampLabel(out, OW, OH, b, nm, Wt, Ht, L, o.thick | 0);

    // Quanto da estampa coube no molde novo (1 = tudo).
    const expected = rule === 'acompanha' ? esperado : rule === 'fixa' ? p.artCount : rule === 'barra' ? p.artCount * sx : (rule === 'esticar' || rule === 'barraEsc') ? p.artCount * sx * sy : 0;
    const kept = expected > 0 ? Math.min(1, copied / expected) : 1;
    return { w: OW, h: OH, rgba: out, sx, sy, kept, nm, Wt, Ht, b };
  }


  // ---------- Número do tamanho em cada pedaço ----------
  const textCache = new Map();
  function textMask(text, px, rot = 0) {
    rot = ((Math.round(rot) % 360) + 360) % 360;
    const key = text + '|' + px + '|' + rot;
    if (textCache.has(key)) return textCache.get(key);
    const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
    let cv = mk(8, 8), ctx = cv.getContext('2d');
    const font = `700 ${px}px Arial, Helvetica, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 2, h = Math.ceil(px * 1.15) + 2;
    cv = mk(w, h); ctx = cv.getContext('2d');
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
    ctx.fillText(text, 1, h / 2);
    let fw = w, fh = h;
    if (rot) {
      // texto girado: desenha o texto reto dentro de uma tela do tamanho da caixa girada
      const rad = rot * Math.PI / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
      fw = Math.ceil(w * c + h * s) + 2; fh = Math.ceil(w * s + h * c) + 2;
      const cv2 = mk(fw, fh), c2 = cv2.getContext('2d');
      c2.translate(fw / 2, fh / 2); c2.rotate(rad); c2.drawImage(cv, -w / 2, -h / 2);
      cv = cv2; ctx = c2;
    }
    const d = ctx.getImageData(0, 0, fw, fh).data, a = new Uint8Array(fw * fh);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    const r = { w: fw, h: fh, a, text };
    textCache.set(key, r);
    return r;
  }

  // Lugar do número: dentro da peça, longe do contorno, o mais embaixo possível (na barra) e perto do meio.
  function labelSpot(nm, Wt, Ht, tw, th, keep) {
    const R = Math.ceil(Math.max(tw, th) / 2) + keep;
    if (2 * R + 1 > Wt || 2 * R + 1 > Ht) return null;
    const er = U.box(nm, Wt, Ht, R, 'min');
    for (let y = Ht - 1 - R; y >= R; y--) {
      let best = -1, bd = Infinity;
      const o = y * Wt;
      for (let x = R; x < Wt - R; x++) if (er[o + x]) { const d = Math.abs(x - Wt / 2); if (d < bd) { bd = d; best = x; } }
      if (best >= 0) return { cx: best, cy: y };
    }
    return null;
  }

  // Ponto escolhido à mão (fx, fy de 0 a 1 na peça): acha o lugar válido mais perto, sem o texto sair da peça.
  function spotPerto(nm, Wt, Ht, tw, th, keep, fx, fy) {
    const R = Math.ceil(Math.max(tw, th) / 2) + keep;
    if (2 * R + 1 > Wt || 2 * R + 1 > Ht) return null;
    const er = U.box(nm, Wt, Ht, R, 'min'), tx = fx * Wt, ty = fy * Ht;
    let best = null, bd = Infinity;
    const st = Math.max(1, Math.floor(Math.min(Wt, Ht) / 400));
    for (let y = R; y < Ht - R; y += st) { const o = y * Wt; for (let x = R; x < Wt - R; x += st) if (er[o + x]) { const d = (x - tx) ** 2 + (y - ty) ** 2; if (d < bd) { bd = d; best = { cx: x, cy: y }; } } }
    return best;
  }
  const folga = (thick, px) => (thick | 0) + Math.max(1, Math.round(px * 0.06));   // quase colado na borda preta, sem encostar nela

  // Lugar do texto pelo FORMATO real das letras (não por um círculo em volta): o nome pode ficar rente à borda,
  // no pezinho da peça, que o laser corta e a bainha/overlock cobre.
  const erCache = new WeakMap();
  function erodida(nm, Wt, Ht, keep) {
    let c = erCache.get(nm); if (!c) erCache.set(nm, c = {});
    return c[keep] || (c[keep] = U.box(nm, Wt, Ht, keep, 'min'));
  }
  function pontosTexto(t) {
    if (t._pts) return t._pts;
    let pts = [];
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.a[y * t.w + x] > 60) pts.push([x - (t.w >> 1), y - (t.h >> 1)]);
    if (pts.length > 600) {   // amostra, mas guarda as pontas (onde o texto encosta primeiro)
      const k = Math.ceil(pts.length / 500), ext = [];
      let a = pts[0], b = pts[0], c = pts[0], d = pts[0];
      for (const q of pts) { if (q[0] < a[0]) a = q; if (q[0] > b[0]) b = q; if (q[1] < c[1]) c = q; if (q[1] > d[1]) d = q; }
      pts = pts.filter((_, i) => i % k === 0).concat([a, b, c, d]);
    }
    return (t._pts = pts);
  }
  function cabe(er, Wt, Ht, pts, cx, cy) {
    for (const [dx, dy] of pts) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= Wt || y >= Ht || !er[y * Wt + x]) return false; }
    return true;
  }
  // pos = {fx, fy} escolhido à mão: o lugar válido mais perto dele. Sem pos: embaixo, perto do meio (na barra).
  function spotTexto(nm, Wt, Ht, t, keep, pos) {
    if (t.w > Wt || t.h > Ht) return null;
    const er = erodida(nm, Wt, Ht, keep), pts = pontosTexto(t);
    if (pos) {
      const tx = Math.round(pos.fx * Wt), ty = Math.round(pos.fy * Ht), maxR = Math.max(Wt, Ht);
      if (cabe(er, Wt, Ht, pts, tx, ty)) return { cx: tx, cy: ty };
      for (let r = 1; r < maxR; r += r < 30 ? 1 : Math.max(2, r >> 5)) {
        let best = null, bd = Infinity;
        const passo = Math.max(1, r >> 4);
        for (let k = -r; k <= r; k += passo) for (const [x, y] of [[tx + k, ty - r], [tx + k, ty + r], [tx - r, ty + k], [tx + r, ty + k]]) {
          const d = (x - tx) ** 2 + (y - ty) ** 2;
          if (d < bd && cabe(er, Wt, Ht, pts, x, y)) { bd = d; best = { cx: x, cy: y }; }
        }
        if (best) return best;
      }
      return null;
    }
    const sy = Math.max(1, Math.floor(Ht / 500)), sx = Math.max(1, Math.floor(Wt / 300));
    for (let y = Ht - 1 - (t.h >> 1); y >= (t.h >> 1); y -= sy) {
      for (let d = 0; d < Wt / 2; d += sx) for (const x of d ? [Math.round(Wt / 2 - d), Math.round(Wt / 2 + d)] : [Math.round(Wt / 2)]) {
        if (cabe(er, Wt, Ht, pts, x, y)) return { cx: x, cy: y };
      }
    }
    return null;
  }

  // Onde o texto vai na peça (mesma regra no TIFF e no Corel).
  function lugarTexto(nm, Wt, Ht, label, thick) {
    let px = Math.max(3, label.px | 0), t = null, spot = null;
    const textos = label.curto && label.curto !== label.text ? [label.text, label.curto] : [label.text];
    if (label.pos) {
      // Lugar escolhido à mão (ex.: na pontinha da peça): o texto fica ALI. Se não couber no tamanho escolhido,
      // diminui a letra (e depois usa só o número) em vez de empurrar o texto para o meio da peça.
      const tx = label.pos.fx * Wt, ty = label.pos.fy * Ht;
      let melhor = null;
      for (const txt of textos) {
        for (let f = 1; f >= 0.45; f -= 0.1) {
          const pxi = Math.max(3, Math.round((label.px | 0) * f)), ti = textMask(txt, pxi, label.rot || 0);
          const sp = spotTexto(nm, Wt, Ht, ti, folga(thick, pxi), label.pos);
          if (!sp) continue;
          const d = Math.hypot(sp.cx - tx, sp.cy - ty), perto = d <= Math.max(ti.h, pxi) * 0.75;
          if (!melhor || (perto && !melhor.perto) || (perto === melhor.perto && !perto && d < melhor.d)) melhor = { sp, t: ti, px: pxi, d, perto };
          if (perto) break;
        }
        if (melhor && melhor.perto) break;
      }
      if (melhor) { spot = melhor.sp; t = melhor.t; px = melhor.px; }
    } else
    for (const txt of textos) {
      px = Math.max(3, label.px | 0);
      for (let k = 0; k < 3 && !spot; k++) {
        t = textMask(txt, px, label.rot || 0);
        spot = spotTexto(nm, Wt, Ht, t, folga(thick, px), label.pos);
        if (!spot) px = Math.round(px * 0.7);
      }
      if (spot) break;
    }
    return spot ? { spot, t, px, text: t.text } : null;
  }

  function stampLabel(out, OW, OH, b, nm, Wt, Ht, label, thick) {
    const lg = lugarTexto(nm, Wt, Ht, label, thick); if (!lg) return;
    const { spot, t } = lg;

    const x0 = spot.cx - (t.w >> 1), y0 = spot.cy - (t.h >> 1);
    // Cor do número: preto em fundo claro, branco em fundo escuro.
    let lum = 0, n = 0;
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
      const q = ((y0 + y + b) * OW + x0 + x + b) * 4; lum += 0.299 * out[q] + 0.587 * out[q + 1] + 0.114 * out[q + 2]; n++;
    }
    const ink = n && lum / n < 140 ? 255 : 0;
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
      const al = t.a[y * t.w + x]; if (!al) continue;
      const xx = x0 + x, yy = y0 + y; if (!nm[yy * Wt + xx]) continue;
      const q = ((yy + b) * OW + xx + b) * 4, f = al / 255;
      out[q] = Math.round(out[q] * (1 - f) + ink * f); out[q + 1] = Math.round(out[q + 1] * (1 - f) + ink * f); out[q + 2] = Math.round(out[q + 2] * (1 - f) + ink * f);
    }
  }

  // Tamanho da célula do encaixe: fina para as peças encostarem no espaço certo (5 mm entre peças) e o rolo gastar menos.
  function celula(st) {
    const mm = Math.min(2.5, Math.max(1, (st.gapMm > 0 ? st.gapMm : 5) / 4));
    return Math.max(3, Math.round(mm / 25.4 * st.dpi));
  }

  // Formato da peça numa grade de células (c px). 'mark' é a peça; 'test' é a peça com o espaço de folga em volta.
  function cellShape(it, c, g, rot) {
    const cw = Math.ceil(it.w / c), ch = Math.ceil(it.h / c), grid = new Uint8Array(cw * ch);
    // Amostra a cada step pixels e sempre a última linha e coluna, para não perder a borda da peça.
    const step = Math.max(1, Math.floor(c / 8));
    const coords = n => { const a = []; for (let v = 0; v < n; v += step) a.push(v); if (a[a.length - 1] !== n - 1) a.push(n - 1); return a; };
    const xs = coords(it.w), ys = coords(it.h);
    for (const y of ys) {
      const cy = Math.floor((rot ? it.h - 1 - y : y) / c);
      for (const x of xs) {
        if (!it.rgba[(y * it.w + x) * 4 + 3]) continue;
        grid[cy * cw + Math.floor((rot ? it.w - 1 - x : x) / c)] = 1;
      }
    }
    const spans = (m, W, H, off) => {
      const rows = [];
      for (let y = 0; y < H; y++) {
        const s = []; let l = -1;
        for (let x = 0; x <= W; x++) {
          const v = x < W && m[y * W + x];
          if (v && l < 0) l = x; else if (!v && l >= 0) { s.push([l - off, x - 1 - off]); l = -1; }
        }
        rows.push(s);
      }
      return rows;
    };
    const PW = cw + 2 * g, PH = ch + 2 * g, pad = new Uint8Array(PW * PH);
    for (let y = 0; y < ch; y++) pad.set(grid.subarray(y * cw, (y + 1) * cw), (y + g) * PW + g);
    const dil = g > 0 ? U.box(pad, PW, PH, g, 'max') : pad;
    return { cw, ch, g, mark: spans(grid, cw, ch, 0), test: spans(dil, PW, PH, g) };
  }

  // Giros que o encaixe pode usar: 0 sempre; 180 se "Permitir girar 180°" estiver marcado;
  // mais os ângulos autorizados à mão (ex.: 90, 270 ou pequenos giros como 5 e 355).
  function angulos(st) {
    if (Array.isArray(st)) return st.length ? st : [0];
    if (st === true) return [0, 180];
    if (!st || typeof st !== 'object') return [0];
    const a = [0];
    if (st.allowRot) a.push(180);
    for (const v of (st.girosExtra || [])) {
      const g = ((Math.round(v) % 360) + 360) % 360;
      if (!a.includes(g)) a.push(g);
    }
    return a;
  }
  // Lê "90, 270" / "5; 355" do campo de giros autorizados.
  function lerGiros(txt) {
    return String(txt || '').split(/[^\d.-]+/).filter(Boolean).map(Number).filter(v => isFinite(v) && Math.round(v) % 360 !== 0);
  }

  // Imagem da peça girada num ângulo qualquer (sentido horário, em volta do centro), já na caixa nova.
  const girCache = new WeakMap();
  function girarRGBA(r, ang) {
    ang = ((Math.round(ang) % 360) + 360) % 360;
    if (!ang) return r;
    let m = girCache.get(r); if (!m) girCache.set(r, m = {});
    if (m[ang]) return m[ang];
    const w = r.w, h = r.h, src = r.rgba;
    let W, H, rgba;
    if (ang % 90 === 0) {
      // giro reto: troca de pixels exata, sem perder nitidez
      W = ang === 180 ? w : h; H = ang === 180 ? h : w;
      rgba = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = ang === 90 ? h - 1 - y : ang === 180 ? w - 1 - x : y;
        const Y = ang === 90 ? x : ang === 180 ? h - 1 - y : w - 1 - x;
        const s = (y * w + x) * 4, d = (Y * W + X) * 4;
        rgba[d] = src[s]; rgba[d + 1] = src[s + 1]; rgba[d + 2] = src[s + 2]; rgba[d + 3] = src[s + 3];
      }
    } else {
      const rad = ang * Math.PI / 180, cs = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
      W = Math.ceil(w * cs + h * sn); H = Math.ceil(w * sn + h * cs);
      const a = document.createElement('canvas'); a.width = w; a.height = h;
      const id = a.getContext('2d').createImageData(w, h); id.data.set(src); a.getContext('2d').putImageData(id, 0, 0);
      const b = document.createElement('canvas'); b.width = W; b.height = H;
      const ctx = b.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.translate(W / 2, H / 2); ctx.rotate(rad); ctx.drawImage(a, -w / 2, -h / 2);
      rgba = ctx.getImageData(0, 0, W, H).data;
      // borda limpa: o pixel é da peça ou não é (a linha de corte não fica esfumaçada)
      for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] < 128) { rgba[i - 3] = rgba[i - 2] = rgba[i - 1] = rgba[i] = 0; } else rgba[i] = 255; }
    }
    return (m[ang] = { w: W, h: H, rgba });
  }

  // Pixels de uma peça já posta no rolo: a imagem certa e se ela vai de cabeça para baixo.
  function orientada(r, p) {
    if (p && p.ang && p.ang !== 180) return { img: girarRGBA(r, p.ang), flip: false };
    return { img: r, flip: !!(p && p.rot) };
  }

  // Formato da peça num giro qualquer, com o tamanho real (px) que ela ocupa assim.
  function shapeFor(it, c, g, ang) {
    let s;
    if (!ang) s = cellShape(it, c, g, false);
    else if (ang === 180) s = cellShape(it, c, g, true);
    else { const R = girarRGBA(it, ang); s = cellShape(R, c, g, false); s.pw = R.w; s.ph = R.h; }
    s.ang = ang;
    if (s.pw == null) { s.pw = it.w; s.ph = it.h; }
    return s;
  }

  // Rolo em células: o que já está ocupado, para testar onde cada peça cabe e tirar/recolocar peças.
  function novoRolo(cols) {
    const occ = [], pre = [], livre = [];   // livre[y]: o maior trecho vazio da linha (para pular linhas cheias rápido)
    const ensure = n => { while (occ.length < n) { occ.push(new Uint8Array(cols)); pre.push(new Int32Array(cols + 1)); livre.push(cols); } };
    const refaz = y => {
      const p = pre[y], row = occ[y]; let run = 0, mx = 0;
      for (let x = 0; x < cols; x++) { p[x + 1] = p[x] + row[x]; if (row[x]) run = 0; else if (++run > mx) mx = run; }
      livre[y] = mx;
    };
    // a linha mais larga da peça (com a folga): se a linha do rolo não tem um vão desse tamanho, a peça não cabe ali
    const larga = s => {
      if (s.larga) return s.larga;
      let w = 0, ri = 0;
      s.test.forEach((row, r) => { for (const [l, rr] of row) if (rr - l + 1 > w) { w = rr - l + 1; ri = r; } });
      return (s.larga = { w, ri });
    };
    // -1 = cabe; senão devolve o próximo X que vale testar (pula a peça que está no caminho)
    const fits = (s, X, Y) => {
      if (X < 0 || X + s.cw > cols) return cols;
      for (let r = 0; r < s.test.length; r++) {
        const yy = Y + r - s.g;
        if (yy < 0 || yy >= occ.length) continue;
        const p = pre[yy], row = occ[yy];
        for (const [l, rr] of s.test[r]) {
          const a = Math.max(0, X + l), b = Math.min(cols - 1, X + rr);
          if (a <= b && p[b + 1] - p[a] > 0) {
            let k = b; while (k > a && !row[k]) k--;
            return Math.max(X + 1, k - l + 1);
          }
        }
      }
      return -1;
    };
    // v = 1 põe a peça; v = 0 tira
    const marca = (s, X, Y, v) => {
      ensure(Y + s.ch);
      for (let r = 0; r < s.ch; r++) {
        const row = occ[Y + r];
        for (const [l, rr] of s.mark[r]) row.fill(v, X + l, X + rr + 1);
        refaz(Y + r);
      }
    };
    // Lugar com o fundo mais baixo (e mais à esquerda) entre os giros autorizados.
    // teto: não procura lugar com fundo acima disso (para recolocar uma peça só se for para baixo).
    // modo 'topo': o lugar mais alto na tela (menor Y) e mais à esquerda, em vez do fundo mais baixo.
    const melhor = (lista, teto, modo) => {
      let best = null;
      const chave = (Y, bottom) => modo === 'topo' ? Y * 4 + bottom / 1e6 : bottom;
      lista.forEach((s, si) => {
        if (s.cw > cols) return;
        const lg = larga(s);
        // Abaixo de tudo (occ.length + folga) sempre cabe, então best nunca fica vazio sem teto.
        for (let Y = 0; Y <= occ.length + s.g; Y++) {
          const bottom = Y + s.ch;
          if (best && (modo === 'topo' ? Y > best.Y : bottom > best.bottom)) break;
          if (teto != null && bottom > teto) break;
          const yr = Y + lg.ri - s.g;
          if (yr >= 0 && yr < occ.length && livre[yr] < lg.w) continue;
          let X = 0;
          while (X + s.cw <= cols) { const nx = fits(s, X, Y); if (nx < 0) break; X = nx; }
          if (X + s.cw <= cols) {
            const k = chave(Y, bottom);
            if (!best || k < best.k || (k === best.k && X < best.X)) best = { X, Y, si, bottom, s, k };
            break;
          }
        }
      });
      return best;
    };
    // teste rápido: a linha mais larga da peça tem um vão do tamanho dela nessa altura?
    const linhaOk = (s, Y) => { const lg = larga(s), yr = Y + lg.ri - s.g; return yr < 0 || yr >= occ.length || livre[yr] >= lg.w; };
    return { marca, melhor, fits, linhaOk };
  }

  // Encaixe pelo formato real das peças: cada peça vai para a posição mais baixa possível no rolo
  // (mais alta na tela) e mais à esquerda, sem encostar nas outras, testando os giros autorizados.
  // compacto: depois tira as peças de cima uma a uma e recoloca nos vãos que sobraram, até não dar mais para descer.
  function layout(items, rollPx, marginPx, gapPx, c, giros, tempoMs = 2500, compacto = false) {
    const warn = [];
    const g = Math.ceil(gapPx / c), A = angulos(giros);
    const shapes = items.map(it => {
      if (it.shapes) { const f = it.shapes.filter(s => A.includes(s.ang || 0)); return f.length ? f : [it.shapes[0]]; }
      return A.map(a => shapeFor(it, c, g, a));
    });
    let cols = Math.floor((rollPx - 2 * marginPx) / c);
    for (const s of shapes) {
      const menor = Math.min(...s.map(x => x.cw));
      if (menor > cols) { cols = menor; warn.push('Uma peça é mais larga que o rolo. O arquivo ficou mais largo para ela caber.'); }
    }
    const area = i => shapes[i][0].mark.reduce((t, row) => t + row.reduce((u, [l, r]) => u + r - l + 1, 0), 0);
    const idx = items.map((_, i) => i);
    // Testa algumas ordens de entrada e fica com a que gasta menos papel.
    const orders = [
      idx.slice().sort((a, b) => area(b) - area(a)),
      idx.slice().sort((a, b) => items[b].h - items[a].h),
      idx.slice().sort((a, b) => items[b].w - items[a].w),
      idx.slice().sort((a, b) => items[b].w * items[b].h - items[a].w * items[a].h),
      idx.slice().sort((a, b) => Math.max(items[b].w, items[b].h) - Math.max(items[a].w, items[a].h)),
    ];
    // mais algumas tentativas misturando a ordem (sempre as mesmas, para o resultado não mudar de uma vez para outra)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < (items.length > 60 ? 3 : 8); t++) orders.push(idx.slice().sort((a, b) => area(b) * (0.75 + rnd() * 0.5) - area(a) * (0.75 + rnd() * 0.5)));
    // compactar: testa também o jeito "mais para cima e para a esquerda", que às vezes fecha melhor os vãos
    const modos = compacto ? ['fundo', 'topo'] : ['fundo'];
    // nota do encaixe: primeiro o comprimento do rolo; empatando, o que deixa as peças mais embaixo (mais fechado)
    const nota = run => run.bottomPx * 1e7 + run.pos.reduce((t, p) => t + (p ? p.y + p.h : 0), 0);
    let bestRun = null, bestOrder = null, bestModo = 'fundo';
    for (const modo of modos) for (const order of orders) {
      const run = place(order, shapes, items, cols, marginPx, c, modo);
      if (!bestRun || nota(run) < nota(bestRun)) { bestRun = run; bestOrder = order; bestModo = modo; }
    }
    // Aperta mais: troca duas peças de lugar na ordem de entrada e fica com a troca se gastar menos rolo.
    const t0 = performance.now(), limite = items.length > 1 ? tempoMs : 0;
    let tent = 0;
    while (performance.now() - t0 < limite && tent < (tempoMs > 2500 ? 3000 : 400)) {
      tent++;
      const ord = bestOrder.slice(), i = Math.floor(rnd() * ord.length), j = Math.floor(rnd() * ord.length);
      if (i === j) continue;
      if (rnd() < 0.5) { [ord[i], ord[j]] = [ord[j], ord[i]]; } else { const [x] = ord.splice(i, 1); ord.splice(j, 0, x); }
      const run = place(ord, shapes, items, cols, marginPx, c, bestModo);
      // compactar: aceita também empate no comprimento se fechar mais, para continuar procurando a partir dali
      if (compacto ? nota(run) <= nota(bestRun) : run.bottomPx < bestRun.bottomPx) { bestRun = run; bestOrder = ord; }
    }
    let run = bestRun, antes = bestRun.bottomPx;
    if (compacto && items.length > 1) run = compactar(run, shapes, items, marginPx, c, Math.max(1500, tempoMs));
    return { pos: run.pos, width: Math.max(rollPx, cols * c + 2 * marginPx), height: run.bottomPx + marginPx, warn: [...new Set(warn)],
      compactado: compacto ? Math.max(0, antes - run.bottomPx) : 0 };
  }

  function posDe(i, k, shapes, items, marginPx, c) {
    const s = shapes[i][k.si];
    return { x: marginPx + k.X * c, y: marginPx + k.Y * c, rot: s.ang === 180, ang: s.ang || 0, w: s.pw, h: s.ph, w0: items[i].w, h0: items[i].h };
  }

  function place(order, shapes, items, cols, marginPx, c, modo) {
    const rolo = novoRolo(cols), cur = [], pos = [];
    let bottomPx = 0;
    for (const i of order) {
      const b = rolo.melhor(shapes[i], null, modo);
      rolo.marca(b.s, b.X, b.Y, 1);
      cur[i] = { X: b.X, Y: b.Y, si: b.si };
      pos[i] = posDe(i, cur[i], shapes, items, marginPx, c);
      bottomPx = Math.max(bottomPx, pos[i].y + pos[i].h);
    }
    return { pos, bottomPx, rolo, cur };
  }

  // Compactar, em duas partes:
  // 1) começando pelas peças do fim do rolo, tira cada uma e recoloca no lugar mais baixo que ela couber agora
  //    (inclusive girada, se o giro for autorizado). Repete enquanto alguma descer.
  // 2) "aperta o rolo": tenta um rolo um pouco mais curto. Tira as peças que passam do novo fim (e mais algumas
  //    do alto, sorteadas) e recoloca todas nos vãos. Se couberem, fica; se não, volta como estava e tenta outra mistura.
  function compactar(run, shapes, items, marginPx, c, tempoMs) {
    const { rolo, cur } = run, t0 = performance.now();
    const vivos = cur.map((k, i) => k ? i : -1).filter(i => i >= 0);
    const fundo = i => cur[i].Y + shapes[i][cur[i].si].ch;
    const area = i => shapes[i][0].mark.reduce((t, row) => t + row.reduce((u, [l, r]) => u + r - l + 1, 0), 0);
    const tira = i => { const k = cur[i]; rolo.marca(shapes[i][k.si], k.X, k.Y, 0); };
    const poe = (i, k) => { cur[i] = k; rolo.marca(shapes[i][k.si], k.X, k.Y, 1); };
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    let desceu = true, voltas = 0;
    while (desceu && voltas < 40 && performance.now() - t0 < tempoMs * 0.4) {
      desceu = false; voltas++;
      for (const i of vivos.slice().sort((a, b) => fundo(b) - fundo(a))) {
        const k = cur[i], f = fundo(i);
        tira(i);
        const b = rolo.melhor(shapes[i], f);
        poe(i, b ? { X: b.X, Y: b.Y, si: b.si } : k);
        if (b && b.bottom < f) desceu = true;
      }
    }

    let tent = 0;
    while (performance.now() - t0 < tempoMs && vivos.length > 1) {
      tent++;
      const L = Math.max(...vivos.map(fundo)), teto = L - 1;
      const tirar = new Set(vivos.filter(i => fundo(i) > teto));
      // mais algumas peças do alto do rolo, para abrir espaço de outro jeito a cada tentativa
      const altas = vivos.filter(i => !tirar.has(i) && fundo(i) > L * 0.55);
      const extra = Math.min(altas.length, tent % 5);
      for (let e = 0; e < extra; e++) tirar.add(altas[Math.floor(rnd() * altas.length)]);
      const lista = [...tirar], antes = new Map(lista.map(i => [i, cur[i]]));
      lista.forEach(tira);
      lista.sort((a, b) => area(b) * (0.8 + rnd() * 0.4) - area(a) * (0.8 + rnd() * 0.4));
      const postos = []; let ok = true;
      for (const i of lista) {
        const b = rolo.melhor(shapes[i], teto);
        if (!b) { ok = false; break; }
        poe(i, { X: b.X, Y: b.Y, si: b.si }); postos.push(i);
      }
      if (!ok) { postos.forEach(tira); lista.forEach(i => poe(i, antes.get(i))); }
    }
    const pos = [];
    let bottomPx = 0;
    cur.forEach((k, i) => { if (!k) return; pos[i] = posDe(i, k, shapes, items, marginPx, c); bottomPx = Math.max(bottomPx, pos[i].y + pos[i].h); });
    return { pos, bottomPx, rolo, cur };
  }

  // ---------- Manter o encaixe original ----------
  // Cada peça fica na mesma posição e no mesmo sentido do arquivo base (o encaixe montado pela equipe):
  // mesma coluna (centro da peça no mesmo lugar da largura) e na mesma ordem de cima para baixo.
  // A peça que cresceu empurra as de baixo; a que diminuiu sobe até encostar (com o espaço entre peças).
  // A largura do rolo não muda: só a altura do encaixe acompanha o tamanho.
  function layoutOriginal(items, rollPx, marginPx, gapPx, c) {
    // Três jeitos de acomodar as peças que não cabem mais na coluna delas, do mais fiel ao original ao mais solto.
    // Fica o mais fiel, a não ser que um mais solto gaste pelo menos 2% menos tecido.
    const jeitos = [[0.12, 0.6], [1, 0.6], [1, 0.1]], res = jeitos.map(([d, p]) => layoutOriginal1(items, rollPx, marginPx, gapPx, c, d, p));
    const menor = Math.min(...res.map(r => r.height));
    return res.find(r => r.height <= menor * 1.02);
  }
  function layoutOriginal1(items, rollPx, marginPx, gapPx, c, desvio, peso) {
    const warn = [], g = Math.ceil(gapPx / c);
    const shapes = items.map(it => it.shapeOrig && it.shapeOrig.c === c && it.shapeOrig.g === g ? it.shapeOrig.s : (it.shapeOrig = { c, g, s: shapeFor(it, c, g, 0) }).s);
    let cols = Math.floor((rollPx - 2 * marginPx) / c);
    for (const s of shapes) if (s.cw > cols) { cols = s.cw; warn.push('Uma peça é mais larga que o rolo. O arquivo ficou mais largo para ela caber.'); }
    const rolo = novoRolo(cols);
    const o = it => it.orig || { x: 0, y: 0, w: it.w, h: it.h };
    // de cima para baixo e da esquerda para a direita, como estão no arquivo base
    const ordem = items.map((_, i) => i).sort((a, b) => (o(items[a]).y - o(items[b]).y) || (o(items[a]).x - o(items[b]).x));
    const maxDesvio = Math.max(2, Math.round(cols * desvio));
    const pos = [];
    let bottomPx = 0;
    for (const i of ordem) {
      const s = shapes[i], it = items[i], oi = o(it);
      const cx = oi.x + oi.w / 2;   // centro da peça no arquivo base
      const X0 = Math.min(cols - s.cw, Math.max(0, Math.round((cx - it.w / 2 - marginPx) / c)));
      let best = null;
      for (let k = 0; k <= 2 * maxDesvio; k++) {
        const d = k === 0 ? 0 : (k % 2 ? (k + 1) / 2 : -k / 2), X = X0 + d;
        if (X < 0 || X + s.cw > cols) continue;
        const custoLado = Math.abs(d) * peso;   // andar para o lado custa um pouco: prefere ficar na coluna original
        if (best && custoLado >= best.nota) continue;
        // sobe a peça o máximo possível nessa coluna (até encostar nas de cima)
        for (let Y = 0; ; Y++) {
          if (best && Y + custoLado >= best.nota) break;
          if (rolo.linhaOk(s, Y) && rolo.fits(s, X, Y) === -1) { best = { X, Y, nota: Y + custoLado }; break; }
        }
      }
      if (!best) best = { X: X0, Y: 0 };
      rolo.marca(s, best.X, best.Y, 1);
      pos[i] = { x: marginPx + best.X * c, y: marginPx + best.Y * c, rot: false, ang: 0, w: s.pw, h: s.ph, w0: it.w, h0: it.h };
      bottomPx = Math.max(bottomPx, pos[i].y + s.ph);
    }
    return { pos, width: Math.max(rollPx, cols * c + 2 * marginPx), height: bottomPx + marginPx, warn };
  }

  // O encaixe que já foi montado ao gerar a grade, se ainda vale (mesmas peças e mesma configuração).
  function assinatura(st) { return JSON.stringify([st.rollCm, st.marginMm, st.gapMm, st.bleedMm, angulos(st), !!st.compactar, !!st.manterEncaixe, st.dpi]); }
  function laySalvo(st, size, parts) {
    const s = st.results && st.results[size];
    if (!s || !s.pos || s.assin !== assinatura(st) || s.pos.length !== parts.length) return null;
    if (!s.pos.every((p, i) => p && p.w0 === parts[i].w && p.h0 === parts[i].h)) return null;
    return { pos: s.pos, width: s.w, height: s.h, warn: [] };
  }

  function targetsPx(st, g, size) {
    const t = st.targets[g.id][size];
    return { W: U.px(t.w, st.dpi), H: U.px(t.h, st.dpi) };
  }

  // Especificação de cada pedaço de um tamanho (o que desenhar), sem desenhar ainda.
  function specsForSize(st, size) {
    const dpi = st.dpi, specs = [], warns = [];
    const rollPx = U.px(st.rollCm, dpi), marginPx = Math.round(st.marginMm / 25.4 * dpi), bleedPx = Math.round(st.bleedMm / 25.4 * dpi);
    const usable = rollPx - 2 * marginPx;
    const lpx = Math.max(3, Math.round((st.labelMm || 4) / 25.4 * dpi));
    // Tamanho como foi digitado (número fica número, letra fica letra) + o nome do pedaço (FRENTE, COSTAS…).
    // p.semEtiqueta: essa peça sai sem nada escrito; p.labelPos: lugar escolhido à mão na aba Peças (vale para todos os tamanhos)
    // Cada peça pode ter letra própria (labelMm), giro (labelRot) e, separado, número e nome cada um com lugar/giro/letra.
    const pxMm = mm => mm > 0 ? Math.max(3, Math.round(mm / 25.4 * dpi)) : lpx;
    const labelsDe = p => {
      if (st.marcarTamanho === false || p.semEtiqueta) return [];
      const nome = st.marcarNome !== false && p.nome ? p.nome : '';
      if (!p.separado) return [{ text: String(size) + (nome ? ' ' + nome : ''), curto: String(size), px: pxMm(p.labelMm), pos: p.labelPos || null, rot: p.labelRot || 0, id: 'Tamanho' }];
      const a = [{ text: String(size), curto: String(size), px: pxMm(p.numMm), pos: p.numPos || null, rot: p.numRot || 0, id: 'Tamanho' }];
      if (nome) a.push({ text: nome, curto: nome, px: pxMm(p.labelMm), pos: p.labelPos || null, rot: p.labelRot || 0, id: 'Nome' });
      return a;
    };
    for (const g of st.groups) {
      const alvo = targetsPx(st, g, size);
      for (const p of g.items) {
        // a estampa sempre acompanha a graduação (desenho diminui/aumenta com a peça), a menos que alguém tenha escolhido outra regra na mão
        const regra = !p.regraManual && (p.rule === 'fixa' || p.rule === 'barra' || p.rule === 'barraEsc') ? 'acompanha' : p.rule;
        const o = { bg: st.bg, bg0: st.an && st.an.bg, thick: st.thickOverride != null ? st.thickOverride : p.thick, outline: st.outline, bleed: bleedPx, rule: regra, labels: labelsDe(p) }; o.label = o.labels[0] || null;
        // molde da modelista: a peça sai com o contorno do PDF e a medida real dele (a menos que tenham digitado a medida à mão)
        const F = (st.mode === 'moldes' || st.mode === 'tabela') && st.formas && st.formas[size] && st.formas[size][p.n];
        // peça girada de lado em relação à primeira do grupo: largura e altura trocam
        const deLado = ((p.t || 0) & 3) % 2 === 1;
        let W = deLado ? alvo.H : alvo.W, H = deLado ? alvo.W : alvo.H;
        if (F) {
          o.forma = F;
          const t = st.targets[g.id][size];
          if (t.src.w !== 'manual') W = F.w; if (t.src.h !== 'manual') H = F.h;
        }
        const name = st.groupName(g);
        // Peça só de fundo mais comprida que o rolo (viés): divide em partes iguais sozinho.
        const tooLong = W + 2 * bleedPx > usable;
        if (tooLong && p.rule === 'fundo' && st.splitLong !== false) {
          const parts = Math.ceil((W + 2 * bleedPx) / (usable - 2 * bleedPx));
          const pw = Math.ceil(W / parts);
          for (let k = 0; k < parts; k++) specs.push({ p, W: pw, H, o, n: p.n, name, size });
          continue;
        }
        if (tooLong) warns.push({ lvl: 'alerta', txt: `Peça ${p.n} (${name}) tem ${U.fmt(U.cm(W, dpi))} cm e não cabe no rolo de ${U.fmt(st.rollCm, 0)} cm: use um rolo mais largo.` });
        specs.push({ p, W, H, o, n: p.n, name, size });
      }
    }
    return { specs, warns, rollPx, marginPx };
  }

  // Desenha um pedaço. Se parte da estampa ficaria fora do molde novo, resolve sozinho:
  // a estampa acompanha a graduação da peça (sem aviso para conferir).
  function drawSpec(sp) {
    let r = renderPiece(sp.p, sp.W, sp.H, sp.o);
    if (r.kept < 0.97 && sp.o.rule !== 'fundo') {
      const tries = sp.o.rule === 'barra' ? ['barraEsc', 'esticar'] : sp.o.rule === 'fixa' ? ['esticar'] : [];
      for (const rule of tries) {
        const r2 = renderPiece(sp.p, sp.W, sp.H, { ...sp.o, rule });
        if (r2.kept > r.kept) { r = r2; r.ajustada = true; }
        if (r.kept >= 0.97) break;
      }
    }
    r.n = sp.n; r.name = sp.name; r.size = sp.size;
    if (sp.p) r.orig = { x: sp.p.x, y: sp.p.y, w: sp.p.w, h: sp.p.h };   // onde a peça estava no arquivo base
    return r;
  }

  // Encaixa; se duas peças encostarem, abre mais espaço sozinho e encaixa de novo.
  function layoutSemEncostar(items, st, rollPx, marginPx, cell, blit, salvo) {
    // o encaixe montado ao gerar a grade vale para o TIFF e o Corel, se nada mudou
    if (salvo && (!blit || !blit(salvo))) return salvo;
    let gap = Math.round(st.gapMm / 25.4 * st.dpi), lay = null;
    for (let k = 0; k < 4; k++) {
      lay = st.manterEncaixe ? layoutOriginal(items, rollPx, marginPx, gap, cell) : layout(items, rollPx, marginPx, gap, cell, angulos(st), 2500, !!st.compactar);
      if (!blit || !blit(lay)) return lay;
      gap += Math.max(2, Math.round(2 / 25.4 * st.dpi));
    }
    return lay;
  }

  async function renderSize(st, size, onPiece) {
    const t0 = U.now(), dpi = st.dpi, res = [];
    const { specs, warns, rollPx, marginPx } = specsForSize(st, size);
    let ajustes = 0;
    for (const sp of specs) {
      const r = drawSpec(sp); if (r.ajustada) ajustes++;
      res.push(r);
      if (onPiece) onPiece(res.length);
      await U.tick();
    }
    const cell = celula(st);
    let out = null;
    const compor = lay => {
      const W = lay.width, H = lay.height;
      if (W * H * 3 > 1.8e9) throw new Error('O encaixe deste tamanho ficou grande demais para gerar de uma vez. Diminua a resolução.');
      const rgb = new Uint8Array(W * H * 3).fill(255), used = new Uint8Array(W * H);
      let overlap = 0;
      res.forEach((r0, i) => {
        const { x: px, y: py } = lay.pos[i], { img: R, flip: rot } = orientada(r0, lay.pos[i]), r = R;
        for (let y = 0; y < r.h; y++) {
          const so = rot ? (r.h - 1 - y) * r.w : y * r.w, oo = (py + y) * W + px;
          for (let x = 0; x < r.w; x++) {
            const q = (rot ? so + r.w - 1 - x : so + x) * 4;
            if (!r.rgba[q + 3]) continue;
            if (used[oo + x]) overlap++; else used[oo + x] = 1;
            const o = (oo + x) * 3; rgb[o] = r.rgba[q]; rgb[o + 1] = r.rgba[q + 1]; rgb[o + 2] = r.rgba[q + 2];
          }
        }
      });
      out = { W, H, rgb, overlap, lay };
      return overlap > 0;
    };
    layoutSemEncostar(res, st, rollPx, marginPx, cell, compor, laySalvo(st, size, res));
    lay_warn(out.lay, warns);
    const rotated = out.lay.pos.filter(p => p.ang).length;
    return { size, w: out.W, h: out.H, rgb: out.rgb, pieces: res.length, rotated, overlap: out.overlap, ajustes, ms: U.now() - t0, warns, parts: res, pos: out.lay.pos, assin: assinatura(st), compactado: out.lay.compactado || 0 };
  }
  function lay_warn(lay, warns) { (lay.warn || []).forEach(txt => warns.push({ lvl: 'alerta', txt })); }

  // ---------- Encaixe automático da grade completa (todos os tamanhos num rolo só) ----------
  // Para caber na memória: desenha cada pedaço, guarda só o formato para encaixar e solta a imagem;
  // depois monta o TIFF em faixas, redesenhando os pedaços da faixa, já comprimido.
  async function encaixeGrade(st, qtd, onProg) {
    // compactar: células mais finas (cerca de 2 mm) para as peças chegarem bem perto umas das outras
    const t0 = U.now(), dpi = st.dpi, cell = st.compactar ? Math.max(celula(st), Math.round(2 / 25.4 * dpi)) : Math.max(4, Math.round(5 / 25.4 * dpi));
    const A = angulos(st);
    const rollPx = U.px(st.rollCm, dpi), marginPx = Math.round(st.marginMm / 25.4 * dpi);
    let gap = Math.round(st.gapMm / 25.4 * dpi);
    const items = [], warns = [];
    const sizes = st.sizes.filter(s => (qtd[s] | 0) > 0);
    let total = 0; for (const s of sizes) total += specsForSize(st, s).specs.length * (qtd[s] | 0);
    let k = 0;
    for (const s of sizes) {
      const { specs, warns: w } = specsForSize(st, s); w.forEach(x => warns.push(x));
      for (let c = 0; c < (qtd[s] | 0); c++) for (const sp of specs) {
        const r = drawSpec(sp);
        const g = Math.ceil(gap / cell);
        const shapes = A.map(a => shapeFor(r, cell, g, a));
        items.push({ w: r.w, h: r.h, shapes, sp, rule: r.ajustada ? null : sp.o.rule });
        k++; if (onProg) onProg(`Preparando pedaço ${k} de ${total}…`);
        await U.tick();
      }
    }
    if (onProg) onProg('Encaixando todos os pedaços no rolo…'); await U.tick();
    const lay = layout(items, rollPx, marginPx, gap, cell, A, st.compactar ? 8000 : 12000, !!st.compactar);   // grade completa: procura por mais tempo
    lay_warn(lay, warns);
    const W = lay.width, H = lay.height;
    // Faixas de 256 linhas, comprimidas em LZW (o Corel, o Photoshop e o RIP abrem).
    const order = items.map((_, i) => i).sort((a, b) => lay.pos[a].y - lay.pos[b].y);
    const ROWS = 256, strips = [], counts = [];
    const pvW = Math.min(1100, W), pf = pvW / W, pvH = Math.max(1, Math.round(H * pf));
    const pv = document.createElement('canvas'); pv.width = pvW; pv.height = pvH;
    const pctx = pv.getContext('2d'), pid = pctx.createImageData(pvW, pvH); pid.data.fill(255);
    const ativos = new Map(); let next = 0;
    for (let y0 = 0; y0 < H; y0 += ROWS) {
      const rows = Math.min(ROWS, H - y0), buf = new Uint8Array(W * rows * 3).fill(255);
      while (next < order.length && lay.pos[order[next]].y < y0 + rows) { const i = order[next++]; ativos.set(i, orientada(drawSpec(items[i].sp), lay.pos[i])); }
      for (const [i, o] of ativos) {
        const r = o.img, rot = o.flip, { x: px, y: py } = lay.pos[i];
        if (py + r.h <= y0) { ativos.delete(i); continue; }
        const ya = Math.max(y0, py), yb = Math.min(y0 + rows, py + r.h);
        for (let yy = ya; yy < yb; yy++) {
          const y = yy - py, so = rot ? (r.h - 1 - y) * r.w : y * r.w, oo = ((yy - y0) * W + px) * 3;
          for (let x = 0; x < r.w; x++) {
            const q = (rot ? so + r.w - 1 - x : so + x) * 4;
            if (!r.rgba[q + 3]) continue;
            const o = oo + x * 3; buf[o] = r.rgba[q]; buf[o + 1] = r.rgba[q + 1]; buf[o + 2] = r.rgba[q + 2];
          }
        }
      }
      // miniatura: cada linha da prévia pega a linha correspondente do arquivo, se ela estiver nesta faixa
      for (let pyv = Math.ceil(y0 * pf); pyv < pvH; pyv++) {
        const sy = Math.min(H - 1, Math.floor(pyv / pf));
        if (sy >= y0 + rows) break;
        if (sy < y0) continue;
        for (let x = 0; x < pvW; x++) { const sx = Math.min(W - 1, Math.floor(x / pf)), s3 = ((sy - y0) * W + sx) * 3, d4 = (pyv * pvW + x) * 4; pid.data[d4] = buf[s3]; pid.data[d4 + 1] = buf[s3 + 1]; pid.data[d4 + 2] = buf[s3 + 2]; }
      }
      const comp = Tiff.lzw(buf);
      strips.push(comp); counts.push(comp.length);
      if (onProg) onProg(`Montando o TIFF do encaixe: ${Math.round(Math.min(100, (y0 + rows) / H * 100))}%…`);
      await U.tick();
    }
    pctx.putImageData(pid, 0, 0);
    const blob = Tiff.writeStrips(W, H, ROWS, strips, counts, dpi, 5);
    const porTam = {}; for (const it of items) porTam[it.sp.size] = (porTam[it.sp.size] || 0) + 1;
    return { w: W, h: H, blob, preview: pv, pieces: items.length, porTam, rotated: lay.pos.filter(p => p.ang).length, compactado: lay.compactado || 0, ms: U.now() - t0, warns };
  }

  // Conferência: refaz o tamanho base e compara pixel a pixel com o arquivo original.
  function selfCheck(st) {
    let ok = 0, tot = 0;
    const per = [];
    for (const p of st.pieces) {
      const r = renderPiece(p, p.w, p.h, { bg: st.bg, bg0: st.an && st.an.bg, thick: 0, outline: st.outline, bleed: 0, rule: p.rule });
      let pk = 0, pt = 0;
      for (let i = 0; i < p.mask.length; i++) {
        if (!p.mask[i] || p.band[i]) continue;
        const q = i * 4;
        const d2 = (r.rgba[q] - p.rgba[q]) ** 2 + (r.rgba[q + 1] - p.rgba[q + 1]) ** 2 + (r.rgba[q + 2] - p.rgba[q + 2]) ** 2;
        pt++; if (d2 < 900) pk++;
      }
      per.push({ n: p.n, score: pt ? pk / pt : 1 });
      ok += pk; tot += pt;
    }
    return { score: tot ? ok / tot : 1, per };
  }

  // Onde vai o número do tamanho (para o arquivo do Corel, que leva o número como texto editável).
  function labelPos(r, label, thick) {
    const lg = lugarTexto(r.nm, r.Wt, r.Ht, label, thick);
    return lg ? { x: lg.spot.cx + r.b, y: lg.spot.cy + r.b, px: lg.px, text: lg.text, rot: label.rot || 0 } : null;
  }

  function autoPos(p, text, px, rot = 0) {
    const t = textMask(text, px, rot), sp = spotTexto(p.mask, p.w, p.h, t, folga(p.thick, px), null);
    return sp ? { fx: sp.cx / p.w, fy: sp.cy / p.h } : { fx: 0.5, fy: 0.85 };
  }

  return { renderPiece, renderSize, autoPos, encaixeGrade, labelPos, celula, specsForSize, drawSpec, layout, layoutOriginal, selfCheck, RULE_NAMES, angulos, lerGiros, laySalvo, girarRGBA };
})();
