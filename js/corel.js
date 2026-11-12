// Arquivo editável para o Corel (SVG): cada pedaço é um grupo separado com a imagem da estampa,
// a linha de corte em vetor e o número do tamanho como texto. Abre em Arquivo → Importar no CorelDRAW.
const Corel = (() => {
  // Contorno externo da peça (vizinhança de Moore), no sentido horário.
  function trace(nm, W, H) {
    let sx = -1, sy = -1;
    for (let y = 0; y < H && sx < 0; y++) for (let x = 0; x < W; x++) if (nm[y * W + x]) { sx = x; sy = y; break; }
    if (sx < 0) return [];
    const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && nm[y * W + x];
    const pts = [[sx, sy]];
    let x = sx, y = sy, dir = 7, first = -1, lim = 4 * (W + H) * 8;
    while (lim-- > 0) {
      let moved = false;
      for (let k = 0; k < 8; k++) {
        const d = (dir + 6 + k) % 8, nx = x + D[d][0], ny = y + D[d][1];
        if (on(nx, ny)) {
          if (x === sx && y === sy && pts.length > 1 && d === first) return pts;
          if (first < 0) first = d;
          x = nx; y = ny; dir = d; moved = true; pts.push([x, y]); break;
        }
      }
      if (!moved) return pts; // pixel solto
    }
    return pts;
  }

  // Simplifica a linha (Ramer–Douglas–Peucker) sem perder a forma: tolerância de ~0,1 mm.
  // Linha fechada (começa e termina no mesmo ponto): divide no ponto mais longe do início e simplifica as duas metades.
  function simplify(pts, eps) {
    if (pts.length < 4) return pts;
    let m = 0, md = -1;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > md) { md = d; m = i; } }
    const a = rdp(pts.slice(0, m + 1), eps), b = rdp(pts.slice(m), eps);
    return a.concat(b.slice(1));
  }
  function rdp(pts, eps) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
      if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  function pngData(r) {
    const cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h;
    const ctx = cv.getContext('2d'), id = ctx.createImageData(r.w, r.h); id.data.set(r.rgba); ctx.putImageData(id, 0, 0);
    return cv.toDataURL('image/png');
  }
  // PNG sem perda nenhuma, mas bem mais leve que o do navegador (pedido 12/11: "não pode perder qualidade"):
  // pixel a pixel igual ao original, só que sem canal de transparência (fora da peça fica branco e a peça é recortada
  // pela própria linha) e com o melhor filtro PNG escolhido linha a linha antes de compactar.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(buf, a, b) { let c = 0xffffffff; for (let i = a; i < b; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function pngSemPerda(r) {
    // v38 (12/11): PNG com transparência (RGBA). Antes era só RGB: o que é fora da peça virava BRANCO e, onde o
    // retângulo da imagem passava por cima da peça vizinha (peças encaixadas), aparecia um pedaço branco em cima dela.
    const W = r.w, H = r.h, S = r.rgba, L = W * 4, raw = new Uint8Array((L + 1) * H);
    const lin = new Uint8Array(L), ant = new Uint8Array(L), cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(L));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) { const q = (y * W + x) * 4, a = S[q + 3]; for (let k = 0; k < 3; k++) lin[x * 4 + k] = a ? S[q + k] : 255; lin[x * 4 + 3] = a; }
      let melhor = 0, menor = Infinity;
      for (let f = 0; f < 5; f++) {
        const c = cand[f]; let soma = 0;
        for (let i = 0; i < L; i++) {
          const v = lin[i], esq = i >= 4 ? lin[i - 4] : 0, cima = y ? ant[i] : 0, ce = i >= 4 && y ? ant[i - 4] : 0;
          let p;
          if (f === 0) p = 0; else if (f === 1) p = esq; else if (f === 2) p = cima; else if (f === 3) p = (esq + cima) >> 1;
          else { const pp = esq + cima - ce, pa = Math.abs(pp - esq), pb = Math.abs(pp - cima), pc = Math.abs(pp - ce); p = pa <= pb && pa <= pc ? esq : pb <= pc ? cima : ce; }
          const d = (v - p) & 255; c[i] = d; soma += d < 128 ? d : 256 - d;
        }
        if (soma < menor) { menor = soma; melhor = f; }
      }
      const o = y * (L + 1); raw[o] = melhor; raw.set(cand[melhor], o + 1); ant.set(lin);
    }
    const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    const parte = (tipo, dados) => { const b = new Uint8Array(12 + dados.length), dv = new DataView(b.buffer); dv.setUint32(0, dados.length); for (let i = 0; i < 4; i++) b[4 + i] = tipo.charCodeAt(i); b.set(dados, 8); dv.setUint32(8 + dados.length, crc32(b, 4, 8 + dados.length)); return b; };
    const ih = new Uint8Array(13), dv = new DataView(ih.buffer); dv.setUint32(0, W); dv.setUint32(4, H); ih[8] = 8; ih[9] = 6;
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), parte('IHDR', ih), parte('IDAT', z), parte('IEND', new Uint8Array(0))], { type: 'image/png' });
    const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(png); });
    return b64;
  }

  // Arquivo mais leve para o Corel (pedido 12/11: o SVG com PNG era tão pesado que o Corel quase não abria):
  // a estampa vai em JPG (fundo branco fora da peça, recortado pela própria linha da peça) e, no modo "leve",
  // com menos pontos por polegada. O TIFF de impressão continua na resolução cheia.
  function jpgData(r, fator, qual) {
    const a = document.createElement('canvas'); a.width = r.w; a.height = r.h;
    const id = a.getContext('2d').createImageData(r.w, r.h); id.data.set(r.rgba); a.getContext('2d').putImageData(id, 0, 0);
    const w = Math.max(1, Math.round(r.w * fator)), h = Math.max(1, Math.round(r.h * fator));
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const ctx = b.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(a, 0, 0, w, h);
    const url = b.toDataURL('image/jpeg', qual); a.width = a.height = b.width = b.height = 1;
    return url;
  }

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const idOk = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');

  // Recorte = contorno de tudo que é pintado na imagem (peça + sangria), para nada fora dela cobrir a peça vizinha
  function recorteDe(r, x, y, dpi) {
    const W = r.w, H = r.h, A = r.rgba, m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = A[i * 4 + 3] ? 1 : 0;
    // folga de 1 px para fora (a linha simplificada não pode comer a beira pintada)
    const g = U.box(m, W, H, 1, 'max');
    const pts = simplify(trace(g, W, H), Math.max(0.6, dpi * 0.002));
    return pts.length > 2 ? 'M' + pts.map(([px, py]) => `${(x + px + 0.5).toFixed(1)} ${(y + py + 0.5).toFixed(1)}`).join(' L') + ' Z' : '';
  }

  async function svgSize(st, size, onProg) {
    const dpi = st.dpi, mm = v => (v / dpi * 25.4).toFixed(2);
    const { specs, rollPx, marginPx } = Grade.specsForSize(st, size);
    const parts = [];
    for (const sp of specs) {
      parts.push(Grade.drawSpec({ ...sp, o: { ...sp.o, label: null, labels: [] } }));
      if (onProg) onProg(`Corel ${size}: pedaço ${parts.length} de ${specs.length}…`);
      await U.tick();
    }
    const cell = Grade.celula(st);
    // mesmo encaixe do TIFF (o que foi montado ao gerar a grade), para o Corel bater com o TIFF
    const lay = Grade.laySalvo(st, size, parts) || (st.manterEncaixe ? Grade.layoutOriginal(parts, rollPx, marginPx, Math.round(st.gapMm / 25.4 * dpi), cell) : Grade.layout(parts, rollPx, marginPx, Math.round(st.gapMm / 25.4 * dpi), cell, Grade.angulos(st), 2500, !!st.compactar));
    const W = lay.width, H = lay.height;
    const out = [`<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${mm(W)}mm" height="${mm(H)}mm" viewBox="0 0 ${W} ${H}">`,
      `<title>Tamanho ${esc(size)} · ${parts.length} pedaços · ${U.fmt(U.cm(W, dpi))} × ${U.fmt(U.cm(H, dpi))} cm</title>`,
      `<g id="Tamanho_${idOk(size)}">`];
    for (let i = 0; i < parts.length; i++) {
      const r = parts[i], p = lay.pos[i], ang = p.ang || (p.rot ? 180 : 0);
      // a peça gira em volta do centro do lugar dela no encaixe
      const cx = p.x + (p.w || r.w) / 2, cy = p.y + (p.h || r.h) / 2, x = cx - r.w / 2, y = cy - r.h / 2;
      const tf = ang ? ` transform="rotate(${ang} ${cx} ${cy})"` : '';
      // linha de corte = a risca da modelagem (lado de dentro da borda preta), quando a peça veio do PDF da modelista
      const fm = specs[i].o.formaMolde, tb = specs[i].o.bordaFora || 0, naRisca = fm && tb && r.Wt === fm.w + 2 * tb && r.Ht === fm.h + 2 * tb;
      const pts = naRisca ? simplify(trace(fm.m, fm.w, fm.h), Math.max(0.6, dpi * 0.004)).map(([px, py]) => [px + tb, py + tb])
        : simplify(trace(r.nm, r.Wt, r.Ht), Math.max(0.6, dpi * 0.004));
      const d = pts.length > 2 ? 'M' + pts.map(([px, py]) => `${(x + r.b + px + 0.5).toFixed(1)} ${(y + r.b + py + 0.5).toFixed(1)}`).join(' L') + ' Z' : '';
      out.push(`<g id="Peca_${r.n}_${idOk(r.name)}_tam_${idOk(size)}"${tf}>`);
      const qual = st.corelQualidade || 'semperda';
      if (qual === 'semperda') {
        const dc = recorteDe(r, x, y, dpi), recorta = !!dc;
        if (recorta) out.push(`<clipPath id="Recorte_${r.n}_${i}"><path d="${dc}"/></clipPath>`);
        out.push(`<image id="Estampa_${r.n}" x="${x}" y="${y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"${recorta ? ` clip-path="url(#Recorte_${r.n}_${i})"` : ''} xlink:href="${await pngSemPerda(r)}"/>`);
      } else if (qual === 'original') out.push(`<image id="Estampa_${r.n}" x="${x}" y="${y}" width="${r.w}" height="${r.h}" xlink:href="${pngData(r)}"/>`);
      else {
        // JPG recortado pelo contorno da peça (a parte branca fora da peça não aparece)
        const dc = recorteDe(r, x, y, dpi);
        const fator = qual === 'leve' ? Math.min(1, 150 / dpi) : 1, jq = qual === 'leve' ? 0.85 : 0.92, recorta = !!dc;
        if (recorta) out.push(`<clipPath id="Recorte_${r.n}_${i}"><path d="${dc}"/></clipPath>`);
        out.push(`<image id="Estampa_${r.n}" x="${x}" y="${y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"${recorta ? ` clip-path="url(#Recorte_${r.n}_${i})"` : ''} xlink:href="${jpgData(r, fator, jq)}"/>`);
      }
      if (d) out.push(`<path id="Corte_${r.n}" d="${d}" fill="none" stroke="#000000" stroke-width="${(dpi * 0.25 / 25.4).toFixed(2)}"/>`);
      for (const L of (specs[i].o.labels || (specs[i].o.label ? [specs[i].o.label] : []))) {
        const lp = Grade.labelPos(r, L, specs[i].o.thick);
        if (lp) out.push(`<text id="${L.id || 'Tamanho'}_${r.n}" x="${x + lp.x}" y="${y + lp.y}" font-family="Arial" font-weight="bold" font-size="${lp.px}" text-anchor="middle" dominant-baseline="central" fill="${lp.cor ? U.hex(lp.cor) : '#000000'}"${lp.rot ? ` transform="rotate(${lp.rot} ${x + lp.x} ${y + lp.y})"` : ''}>${esc(lp.text)}</text>`);
      }
      out.push('</g>');
      parts[i] = null;
      if (onProg) onProg(`Corel ${size}: gravando pedaço ${i + 1} de ${lay.pos.length}…`);
      await U.tick();
    }
    out.push('</g>', '</svg>');
    return new Blob([out.join('\n')], { type: 'image/svg+xml' });
  }

  return { svgSize, trace, simplify, rdp };
})();
