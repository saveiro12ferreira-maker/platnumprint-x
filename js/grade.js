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
    if (rule === 'barra') { const pr = U.profiles(nm, Wt, Ht); nt = pr.top; nb = pr.bot; }
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

    // Quanto da estampa coube no molde novo (1 = tudo).
    const expected = rule === 'fixa' ? p.artCount : rule === 'barra' ? p.artCount * sx : rule === 'esticar' ? p.artCount * sx * sy : 0;
    const kept = expected > 0 ? Math.min(1, copied / expected) : 1;
    return { w: OW, h: OH, rgba: out, sx, sy, kept };
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
  function layout(items, rollPx, marginPx, gapPx, c, allowRot) {
    const warn = [];
    const g = Math.ceil(gapPx / c);
    const shapes = items.map(it => {
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
    ];
    let bestRun = null;
    for (const order of orders) {
      const run = place(order, shapes, items, cols, marginPx, c);
      if (!bestRun || run.bottomPx < bestRun.bottomPx) bestRun = run;
    }
    return { pos: bestRun.pos, width: Math.max(rollPx, cols * c + 2 * marginPx), height: bestRun.bottomPx + marginPx, warn: [...new Set(warn)] };
  }

  function place(order, shapes, items, cols, marginPx, c) {
    const occ = [], pre = [];
    const ensure = n => { while (occ.length < n) { occ.push(new Uint8Array(cols)); pre.push(new Int32Array(cols + 1)); } };
    const fits = (s, X, Y) => {
      if (X < 0 || X + s.cw > cols) return false;
      for (let r = 0; r < s.test.length; r++) {
        const yy = Y + r - s.g;
        if (yy < 0 || yy >= occ.length) continue;
        const p = pre[yy];
        for (const [l, rr] of s.test[r]) {
          const a = Math.max(0, X + l), b = Math.min(cols - 1, X + rr);
          if (a <= b && p[b + 1] - p[a] > 0) return false;
        }
      }
      return true;
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
          for (; X + s.cw <= cols; X++) if (fits(s, X, Y)) break;
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

  async function renderSize(st, size, onPiece) {
    const t0 = U.now(), dpi = st.dpi, res = [], warns = [];
    const rollPx = U.px(st.rollCm, dpi), marginPx = Math.round(st.marginMm / 25.4 * dpi), bleedPx = Math.round(st.bleedMm / 25.4 * dpi);
    const usable = rollPx - 2 * marginPx;
    for (const g of st.groups) {
      const { W, H } = targetsPx(st, g, size);
      for (const p of g.items) {
        const o = { bg: st.bg, thick: st.thickOverride != null ? st.thickOverride : p.thick, outline: st.outline, bleed: bleedPx, rule: p.rule };
        const name = st.groupName(g);
        // Peça só de fundo mais comprida que o rolo (viés): divide em partes iguais, se a opção estiver ligada.
        const tooLong = W + 2 * bleedPx > usable;
        if (tooLong && st.splitLong && p.rule === 'fundo') {
          const parts = Math.ceil((W + 2 * bleedPx) / (usable - 2 * bleedPx));
          const pw = Math.ceil(W / parts);
          for (let k = 0; k < parts; k++) { const r = renderPiece(p, pw, H, o); r.n = p.n; r.name = name; r.kept = 1; r.sx = 1; res.push(r); }
          warns.push({ lvl: 'alerta', txt: `Peça ${p.n} (${name}) tem ${U.fmt(U.cm(W, dpi))} cm e não cabe no rolo: foi dividida em ${parts} partes de ${U.fmt(U.cm(pw, dpi))} cm. Lembre de emendar na costura.` });
          if (onPiece) onPiece(res.length);
          await U.tick();
          continue;
        }
        if (tooLong) warns.push({ lvl: 'alerta', txt: `Peça ${p.n} (${name}) tem ${U.fmt(U.cm(W, dpi))} cm e não cabe no rolo de ${U.fmt(st.rollCm, 0)} cm.` + (p.rule === 'fundo' ? ' Ligue a opção de dividir peças longas ou ajuste a medida.' : ' Ajuste a medida ou use um rolo mais largo.') });
        const r = renderPiece(p, W, H, o);
        r.n = p.n; r.name = name;
        if (p.rule === 'barra' && Math.abs(r.sx - 1) > 0.001)
          warns.push({ lvl: 'info', txt: `Peça ${p.n} (${r.name}): as flores da barra ficam ${U.fmt(Math.abs(r.sx - 1) * 100)}% ${r.sx > 1 ? 'mais largas' : 'mais estreitas'} para acompanhar a peça.` });
        if (r.kept < 0.97)
          warns.push({ lvl: 'alerta', txt: `Peça ${p.n} (${r.name}): ${U.fmt((1 - r.kept) * 100)}% da estampa ficou fora do molde novo. Confira a regra ou a âncora.` });
        res.push(r);
        if (onPiece) onPiece(res.length);
        await U.tick();
      }
    }
    const cell = Math.max(4, Math.round(5 / 25.4 * dpi));
    const lay = layout(res, rollPx, marginPx, Math.round(st.gapMm / 25.4 * dpi), cell, st.allowRot);
    lay.warn.forEach(txt => warns.push({ lvl: 'alerta', txt }));
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
    if (overlap > 0) warns.push({ lvl: 'alerta', txt: `Duas peças encostaram uma na outra no encaixe (${overlap} pixels). Aumente o espaço entre peças.` });
    const rotated = lay.pos.filter(p => p.rot).length;
    return { size, w: W, h: H, rgb, pieces: res.length, rotated, overlap, ms: U.now() - t0, warns };
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

  return { renderPiece, renderSize, layout, selfCheck, RULE_NAMES };
})();
