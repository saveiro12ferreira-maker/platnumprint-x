// Motor de grade: refaz cada peça na medida nova, recoloca a estampa pela regra e encaixa no rolo.
const Grade = (() => {
  const RULE_NAMES = { barra: 'segue a barra', fixa: 'estampa fixa', esticar: 'estica com a peça', fundo: 'só fundo' };

  // Refaz uma peça com largura Wt e altura Ht (pixels, sem sangria).
  function renderPiece(p, Wt, Ht, o) {
    const W = p.w, H = p.h, sx = Wt / W, sy = Ht / H, b = o.bleed | 0, OW = Wt + 2 * b, OH = Ht + 2 * b;
    const mapX = new Int32Array(Wt), mapY = new Int32Array(Ht);
    for (let x = 0; x < Wt; x++) mapX[x] = Math.min(W - 1, Math.floor((x + 0.5) / sx));
    for (let y = 0; y < Ht; y++) mapY[y] = Math.min(H - 1, Math.floor((y + 0.5) / sy));

    // Molde novo: o contorno original ampliado ou reduzido para a medida do tamanho.
    const nm = new Uint8Array(Wt * Ht);
    for (let y = 0; y < Ht; y++) {
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
    let dx = 0, dy = 0;
    if (rule === 'fixa') {
      dx = p.anchorX === 'left' ? 0 : p.anchorX === 'right' ? Wt - W : Math.round((Wt - W) / 2);
      dy = p.anchorY === 'top' ? 0 : p.anchorY === 'bottom' ? Ht - H : Math.round((Ht - H) / 2);
    }
    let nt = null, nb = null;
    if (rule === 'barra' || rule === 'barraEsc') { const pr = U.profiles(nm, Wt, Ht); nt = pr.top; nb = pr.bot; }
    const bottom = p.edge === 'bottom';

    let copied = 0;
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
        if (k >= 0) { const s = k * 4; out[q] = S[s]; out[q + 1] = S[s + 1]; out[q + 2] = S[s + 2]; copied++; }
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

    if (o.label && o.label.text) stampLabel(out, OW, OH, b, nm, Wt, Ht, o.label, o.thick | 0);

    // Quanto da estampa coube no molde novo (1 = tudo).
    const expected = rule === 'fixa' ? p.artCount : rule === 'barra' ? p.artCount * sx : (rule === 'esticar' || rule === 'barraEsc') ? p.artCount * sx * sy : 0;
    const kept = expected > 0 ? Math.min(1, copied / expected) : 1;
    return { w: OW, h: OH, rgba: out, sx, sy, kept, nm, Wt, Ht, b };
  }


  // ---------- Número do tamanho em cada pedaço ----------
  const textCache = new Map();
  function textMask(text, px) {
    const key = text + '|' + px;
    if (textCache.has(key)) return textCache.get(key);
    const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
    let cv = mk(8, 8), ctx = cv.getContext('2d');
    const font = `700 ${px}px Arial, Helvetica, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 2, h = Math.ceil(px * 1.15) + 2;
    cv = mk(w, h); ctx = cv.getContext('2d');
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
    ctx.fillText(text, 1, h / 2);
    const d = ctx.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    const r = { w, h, a };
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
  const folga = (thick, px) => (thick | 0) + Math.max(2, Math.round(px * 0.15));   // perto da borda, sem encostar no contorno

  function stampLabel(out, OW, OH, b, nm, Wt, Ht, label, thick) {
    let px = Math.max(8, label.px | 0), t = null, spot = null;
    const textos = label.curto && label.curto !== label.text ? [label.text, label.curto] : [label.text];
    for (const txt of textos) {
      px = Math.max(8, label.px | 0);
      for (let k = 0; k < 3 && !spot; k++) {
        t = textMask(txt, px);
        spot = label.pos ? spotPerto(nm, Wt, Ht, t.w, t.h, folga(thick, px), label.pos.fx, label.pos.fy) : labelSpot(nm, Wt, Ht, t.w, t.h, folga(thick, px));
        if (!spot) px = Math.round(px * 0.7);
      }
      if (spot) break;
    }
    if (!spot) return;
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

  // Encaixe pelo formato real das peças: cada peça vai para a posição mais alta e mais à esquerda
  // onde cabe sem encostar nas outras, testando também girada 180°.
  function layout(items, rollPx, marginPx, gapPx, c, allowRot, tempoMs = 2500) {
    const warn = [];
    const g = Math.ceil(gapPx / c);
    const shapes = items.map(it => {
      if (it.shapes) return allowRot ? it.shapes : [it.shapes[0]];
      const s = [cellShape(it, c, g, false)];
      if (allowRot) s.push(cellShape(it, c, g, true));
      return s;
    });
    let cols = Math.floor((rollPx - 2 * marginPx) / c);
    for (const s of shapes) if (s[0].cw > cols) { cols = s[0].cw; warn.push('Uma peça é mais larga que o rolo. O arquivo ficou mais largo para ela caber.'); }
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
    let bestRun = null, bestOrder = null;
    for (const order of orders) {
      const run = place(order, shapes, items, cols, marginPx, c);
      if (!bestRun || run.bottomPx < bestRun.bottomPx) { bestRun = run; bestOrder = order; }
    }
    // Aperta mais: troca duas peças de lugar na ordem de entrada e fica com a troca se gastar menos rolo (até ~2,5 s).
    const t0 = performance.now(), limite = items.length > 1 ? tempoMs : 0;
    let tent = 0;
    while (performance.now() - t0 < limite && tent < (tempoMs > 2500 ? 3000 : 400)) {
      tent++;
      const ord = bestOrder.slice(), i = Math.floor(rnd() * ord.length), j = Math.floor(rnd() * ord.length);
      if (i === j) continue;
      if (rnd() < 0.5) { [ord[i], ord[j]] = [ord[j], ord[i]]; } else { const [x] = ord.splice(i, 1); ord.splice(j, 0, x); }
      const run = place(ord, shapes, items, cols, marginPx, c);
      if (run.bottomPx < bestRun.bottomPx) { bestRun = run; bestOrder = ord; }
    }
    return { pos: bestRun.pos, width: Math.max(rollPx, cols * c + 2 * marginPx), height: bestRun.bottomPx + marginPx, warn: [...new Set(warn)] };
  }

  function place(order, shapes, items, cols, marginPx, c) {
    const occ = [], pre = [];
    const ensure = n => { while (occ.length < n) { occ.push(new Uint8Array(cols)); pre.push(new Int32Array(cols + 1)); } };
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
    const pos = [];
    let bottomPx = 0;
    for (const i of order) {
      let best = null;
      shapes[i].forEach((s, rot) => {
        // Abaixo de tudo (occ.length + folga) sempre cabe, então best nunca fica vazio.
        for (let Y = 0; Y <= occ.length + s.g; Y++) {
          if (best && Y + s.ch > best.bottom) break;
          let X = 0;
          while (X + s.cw <= cols) { const nx = fits(s, X, Y); if (nx < 0) break; X = nx; }
          if (X + s.cw <= cols) {
            const bottom = Y + s.ch;
            if (!best || bottom < best.bottom || (bottom === best.bottom && X < best.X)) best = { X, Y, rot, bottom, s };
            break;
          }
        }
      });
      const { X, Y, rot, s } = best;
      ensure(Y + s.ch);
      for (let r = 0; r < s.ch; r++) {
        const row = occ[Y + r];
        for (const [l, rr] of s.mark[r]) row.fill(1, X + l, X + rr + 1);
        const p = pre[Y + r];
        for (let x = 0; x < cols; x++) p[x + 1] = p[x] + row[x];
      }
      pos[i] = { x: marginPx + X * c, y: marginPx + Y * c, rot: rot === 1 };
      bottomPx = Math.max(bottomPx, marginPx + Y * c + items[i].h);
    }
    return { pos, bottomPx };
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
    const lpx = Math.max(10, Math.round((st.labelMm || 4) / 25.4 * dpi));
    // Tamanho como foi digitado (número fica número, letra fica letra) + o nome do pedaço (FRENTE, COSTAS…).
    // p.semEtiqueta: essa peça sai sem nada escrito; p.labelPos: lugar escolhido à mão na aba Peças (vale para todos os tamanhos)
    const labelDe = p => st.marcarTamanho === false || p.semEtiqueta ? null
      : { text: String(size) + (st.marcarNome !== false && p.nome ? ' ' + p.nome : ''), curto: String(size), px: lpx, pos: p.labelPos || null };
    for (const g of st.groups) {
      const { W, H } = targetsPx(st, g, size);
      for (const p of g.items) {
        const o = { bg: st.bg, thick: st.thickOverride != null ? st.thickOverride : p.thick, outline: st.outline, bleed: bleedPx, rule: p.rule, label: labelDe(p) };
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
    return r;
  }

  // Encaixa; se duas peças encostarem, abre mais espaço sozinho e encaixa de novo.
  function layoutSemEncostar(items, st, rollPx, marginPx, cell, blit) {
    let gap = Math.round(st.gapMm / 25.4 * st.dpi), lay = null;
    for (let k = 0; k < 4; k++) {
      lay = layout(items, rollPx, marginPx, gap, cell, st.allowRot);
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
      res.forEach((r, i) => {
        const { x: px, y: py, rot } = lay.pos[i];
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
    layoutSemEncostar(res, st, rollPx, marginPx, cell, compor);
    lay_warn(out.lay, warns);
    const rotated = out.lay.pos.filter(p => p.rot).length;
    return { size, w: out.W, h: out.H, rgb: out.rgb, pieces: res.length, rotated, overlap: out.overlap, ajustes, ms: U.now() - t0, warns, parts: res, pos: out.lay.pos };
  }
  function lay_warn(lay, warns) { (lay.warn || []).forEach(txt => warns.push({ lvl: 'alerta', txt })); }

  // ---------- Encaixe automático da grade completa (todos os tamanhos num rolo só) ----------
  // Para caber na memória: desenha cada pedaço, guarda só o formato para encaixar e solta a imagem;
  // depois monta o TIFF em faixas, redesenhando os pedaços da faixa, já comprimido.
  async function encaixeGrade(st, qtd, onProg) {
    const t0 = U.now(), dpi = st.dpi, cell = Math.max(4, Math.round(5 / 25.4 * dpi));
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
        const shapes = [cellShape(r, cell, g, false), cellShape(r, cell, g, true)];
        items.push({ w: r.w, h: r.h, shapes, sp, rule: r.ajustada ? null : sp.o.rule });
        k++; if (onProg) onProg(`Preparando pedaço ${k} de ${total}…`);
        await U.tick();
      }
    }
    if (onProg) onProg('Encaixando todos os pedaços no rolo…'); await U.tick();
    const lay = layout(items, rollPx, marginPx, gap, cell, st.allowRot, 12000);   // grade completa: procura por mais tempo
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
      while (next < order.length && lay.pos[order[next]].y < y0 + rows) { const i = order[next++]; ativos.set(i, drawSpec(items[i].sp)); }
      for (const [i, r] of ativos) {
        const { x: px, y: py, rot } = lay.pos[i];
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
    return { w: W, h: H, blob, preview: pv, pieces: items.length, porTam, rotated: lay.pos.filter(p => p.rot).length, ms: U.now() - t0, warns };
  }

  // Conferência: refaz o tamanho base e compara pixel a pixel com o arquivo original.
  function selfCheck(st) {
    let ok = 0, tot = 0;
    const per = [];
    for (const p of st.pieces) {
      const r = renderPiece(p, p.w, p.h, { bg: st.bg, thick: 0, outline: st.outline, bleed: 0, rule: p.rule });
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
    const textos = label.curto && label.curto !== label.text ? [label.text, label.curto] : [label.text];
    for (const text of textos) {
      let px = label.px;
      for (let k = 0; k < 3; k++) {
        const t = textMask(text, px), sp = label.pos ? spotPerto(r.nm, r.Wt, r.Ht, t.w, t.h, folga(thick, px), label.pos.fx, label.pos.fy) : labelSpot(r.nm, r.Wt, r.Ht, t.w, t.h, folga(thick, px));
        if (sp) return { x: sp.cx + r.b, y: sp.cy + r.b, px, text };
        px = Math.round(px * 0.7);
      }
    }
    return null;
  }

  function autoPos(p, text, px) {
    const t = textMask(text, px), sp = labelSpot(p.mask, p.w, p.h, t.w, t.h, folga(p.thick, px));
    return sp ? { fx: sp.cx / p.w, fy: sp.cy / p.h } : { fx: 0.5, fy: 0.85 };
  }

  return { renderPiece, renderSize, autoPos, encaixeGrade, labelPos, celula, specsForSize, drawSpec, layout, selfCheck, RULE_NAMES };
})();
