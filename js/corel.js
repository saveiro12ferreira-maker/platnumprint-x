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

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const idOk = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');

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
    const lay = Grade.laySalvo(st, size, parts) || Grade.layout(parts, rollPx, marginPx, Math.round(st.gapMm / 25.4 * dpi), cell, Grade.angulos(st), 2500, !!st.compactar);
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
      const pts = simplify(trace(r.nm, r.Wt, r.Ht), Math.max(0.6, dpi * 0.004));
      const d = pts.length > 2 ? 'M' + pts.map(([px, py]) => `${(x + r.b + px + 0.5).toFixed(1)} ${(y + r.b + py + 0.5).toFixed(1)}`).join(' L') + ' Z' : '';
      out.push(`<g id="Peca_${r.n}_${idOk(r.name)}_tam_${idOk(size)}"${tf}>`);
      out.push(`<image id="Estampa_${r.n}" x="${x}" y="${y}" width="${r.w}" height="${r.h}" xlink:href="${pngData(r)}"/>`);
      if (d) out.push(`<path id="Corte_${r.n}" d="${d}" fill="none" stroke="#000000" stroke-width="${(dpi * 0.25 / 25.4).toFixed(2)}"/>`);
      for (const L of (specs[i].o.labels || (specs[i].o.label ? [specs[i].o.label] : []))) {
        const lp = Grade.labelPos(r, L, specs[i].o.thick);
        if (lp) out.push(`<text id="${L.id || 'Tamanho'}_${r.n}" x="${x + lp.x}" y="${y + lp.y}" font-family="Arial" font-weight="bold" font-size="${lp.px}" text-anchor="middle" dominant-baseline="central" fill="#000000"${lp.rot ? ` transform="rotate(${lp.rot} ${x + lp.x} ${y + lp.y})"` : ''}>${esc(lp.text)}</text>`);
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
