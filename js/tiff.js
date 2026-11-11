// Leitura do arquivo base (TIFF, PNG, JPG) e gravação do TIFF final.
const Tiff = {
  async readImage(file) {
    if (/\.tiff?$/i.test(file.name)) {
      if (typeof UTIF === 'undefined') throw new Error('O leitor de TIFF não carregou. Confira a conexão com a internet e recarregue a página.');
      const buf = await file.arrayBuffer();
      const ifds = UTIF.decode(buf);
      // O Photoshop pode guardar miniaturas: usa a maior imagem do arquivo.
      let ifd = null, best = 0;
      for (const d of ifds) {
        const a = (d.t256 ? d.t256[0] : 0) * (d.t257 ? d.t257[0] : 0);
        if (a > best) { best = a; ifd = d; }
      }
      if (!ifd) throw new Error('Não achei nenhuma imagem dentro desse TIFF.');
      UTIF.decodeImage(buf, ifd);
      const data = UTIF.toRGBA8(ifd);
      let dpi = null;
      if (ifd.t282) dpi = Array.isArray(ifd.t282) ? ifd.t282[0] : ifd.t282;
      if (dpi && ifd.t296 && ifd.t296[0] === 3) dpi *= 2.54;
      return { width: ifd.width, height: ifd.height, data, dpi: dpi ? Math.round(dpi) : null };
    }
    const bmp = await createImageBitmap(file);
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    let dpi = null;
    try { dpi = Tiff.dpiDoArquivo(new Uint8Array(await file.slice(0, 262144).arrayBuffer())); } catch (e) { dpi = null; }
    return { width: bmp.width, height: bmp.height, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data, dpi };
  },

  // Resolução gravada no PNG (pHYs) ou no JPG (JFIF ou EXIF). Sem isso o motor usaria o dpi da tela e erraria a medida.
  dpiDoArquivo(b) {
    const u32 = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    if (b[0] === 0x89 && b[1] === 0x50) {                       // PNG
      let i = 8;
      while (i + 12 <= b.length) {
        const len = u32(i), tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
        if (tipo === 'pHYs' && b[i + 16] === 1) return Math.round(u32(i + 8) * 0.0254);
        if (tipo === 'IDAT' || tipo === 'IEND') break;
        i += 12 + len;
      }
      return null;
    }
    if (b[0] === 0xFF && b[1] === 0xD8) {                       // JPG
      let i = 2;
      while (i + 4 < b.length && b[i] === 0xFF) {
        const mk = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
        if (mk === 0xE0 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'JFIF') {
          const un = b[i + 11], x = (b[i + 12] << 8) | b[i + 13];
          if (un === 1 && x > 1) return x; if (un === 2 && x > 1) return Math.round(x * 2.54);
        }
        if (mk === 0xE1 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif') {
          const t = i + 10, le = b[t] === 0x49, r16 = o => le ? b[t + o] | (b[t + o + 1] << 8) : (b[t + o] << 8) | b[t + o + 1];
          const r32 = o => le ? (b[t + o] | (b[t + o + 1] << 8) | (b[t + o + 2] << 16) | (b[t + o + 3] << 24)) >>> 0 : ((b[t + o] << 24) | (b[t + o + 1] << 16) | (b[t + o + 2] << 8) | b[t + o + 3]) >>> 0;
          const ifd = r32(4), n = r16(ifd); let res = null, unit = 2;
          for (let k = 0; k < n; k++) {
            const e = ifd + 2 + k * 12, tag = r16(e);
            if (tag === 0x011A) { const off = r32(e + 8); res = r32(off) / (r32(off + 4) || 1); }
            if (tag === 0x0128) unit = r16(e + 8);
          }
          if (res > 1) return Math.round(unit === 3 ? res * 2.54 : res);
        }
        if (mk === 0xDA) break;
        i += 2 + len;
      }
    }
    return null;
  },

  // PackBits linha por linha (o padrão TIFF não deixa uma sequência passar de uma linha para a outra).
  packBits(buf, rowBytes, rows) {
    const out = new Uint8Array(rows * (rowBytes + Math.ceil(rowBytes / 128) + 2));
    let o = 0;
    for (let r = 0; r < rows; r++) {
      const a = r * rowBytes, e = a + rowBytes;
      let i = a;
      while (i < e) {
        let run = 1;
        while (i + run < e && run < 128 && buf[i + run] === buf[i]) run++;
        if (run >= 3) { out[o++] = 257 - run; out[o++] = buf[i]; i += run; continue; }
        let lit = 1;
        while (i + lit < e && lit < 128) {
          if (i + lit + 2 < e && buf[i + lit] === buf[i + lit + 1] && buf[i + lit] === buf[i + lit + 2]) break;
          lit++;
        }
        out[o++] = lit - 1; out.set(buf.subarray(i, i + lit), o); o += lit; i += lit;
      }
    }
    return out.slice(0, o);
  },

  // LZW do padrão TIFF (o mesmo do Photoshop/Corel): começa com 9 bits, troca de tamanho um código antes ("early change").
  lzw(buf) {
    const out = new Uint8Array(Math.max(1024, Math.ceil(buf.length * 1.4) + 16));
    let o = 0, acc = 0, nb = 0, width = 9, next = 258;
    const put = c => { acc = (acc << width) | c; nb += width; while (nb >= 8) { nb -= 8; out[o++] = (acc >>> nb) & 255; } acc &= (1 << nb) - 1; };
    let dict = new Map();
    put(256);
    if (!buf.length) { put(257); if (nb) out[o++] = (acc << (8 - nb)) & 255; return out.slice(0, o); }
    let w = buf[0];
    for (let i = 1; i < buf.length; i++) {
      const c = buf[i], key = w * 256 + c, hit = dict.get(key);
      if (hit !== undefined) { w = hit; continue; }
      put(w);
      dict.set(key, next++);
      if (next === 4094) { put(256); dict = new Map(); next = 258; width = 9; }
      else if (next === 512) width = 10; else if (next === 1024) width = 11; else if (next === 2048) width = 12;
      w = c;
    }
    put(w); next++;
    if (next === 4094) { put(256); width = 9; }
    else if (next === 512) width = 10; else if (next === 1024) width = 11; else if (next === 2048) width = 12;
    put(257);
    if (nb) out[o++] = (acc << (8 - nb)) & 255;
    return out.slice(0, o);
  },

  // TIFF RGB em faixas comprimidas (PackBits), com a resolução gravada. As faixas vêm prontas.
  writeStrips(w, h, rowsPerStrip, strips, counts, dpi, comp = 32773) {
    const ns = strips.length, n = 13, ifdSize = 2 + n * 12 + 4;
    let off = 8;
    const offsets = [];
    for (const c of counts) { offsets.push(off); off += c; }
    if (off % 2) off++;
    const ifdOff = off, bpsOff = ifdOff + ifdSize, xresOff = bpsOff + 6, yresOff = xresOff + 8, soOff = yresOff + 8, sbOff = soOff + ns * 4, end = sbOff + ns * 4;
    const head = new ArrayBuffer(8), hv = new DataView(head);
    hv.setUint16(0, 0x4949, true); hv.setUint16(2, 42, true); hv.setUint32(4, ifdOff, true);
    const tail = new ArrayBuffer(end - ifdOff), dv = new DataView(tail);
    let p = 0; dv.setUint16(p, n, true); p += 2;
    const tag = (id, type, count, val) => {
      dv.setUint16(p, id, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true);
      if (type === 3 && count === 1) dv.setUint16(p + 8, val, true); else dv.setUint32(p + 8, val, true);
      p += 12;
    };
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, 3, bpsOff); tag(259, 3, 1, comp);
    tag(262, 3, 1, 2); tag(273, 4, ns, ns === 1 ? offsets[0] : soOff); tag(277, 3, 1, 3); tag(278, 4, 1, rowsPerStrip);
    tag(279, 4, ns, ns === 1 ? counts[0] : sbOff); tag(282, 5, 1, xresOff); tag(283, 5, 1, yresOff);
    tag(284, 3, 1, 1); tag(296, 3, 1, 2);
    dv.setUint32(p, 0, true);
    const L = x => x - ifdOff;
    for (let i = 0; i < 3; i++) dv.setUint16(L(bpsOff) + i * 2, 8, true);
    dv.setUint32(L(xresOff), dpi, true); dv.setUint32(L(xresOff) + 4, 1, true);
    dv.setUint32(L(yresOff), dpi, true); dv.setUint32(L(yresOff) + 4, 1, true);
    for (let i = 0; i < ns; i++) { dv.setUint32(L(soOff) + i * 4, offsets[i], true); dv.setUint32(L(sbOff) + i * 4, counts[i], true); }
    const pad = (8 + counts.reduce((a, b) => a + b, 0)) % 2 ? [new Uint8Array(1)] : [];
    return new Blob([head, ...strips, ...pad, tail], { type: 'image/tiff' });
  },

  // TIFF RGB sem compressão, com a resolução gravada (abre no Corel, Photoshop e RIP).
  writeRGB(w, h, rgb, dpi) {
    const n = 13, ifdSize = 2 + n * 12 + 4;
    const bpsOff = 8 + ifdSize, xresOff = bpsOff + 6, yresOff = xresOff + 8, dataOff = yresOff + 8;
    const buf = new ArrayBuffer(dataOff), dv = new DataView(buf);
    dv.setUint16(0, 0x4949, true); dv.setUint16(2, 42, true); dv.setUint32(4, 8, true);
    let p = 8; dv.setUint16(p, n, true); p += 2;
    const tag = (id, type, count, val) => {
      dv.setUint16(p, id, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true);
      if (type === 3 && count === 1) dv.setUint16(p + 8, val, true); else dv.setUint32(p + 8, val, true);
      p += 12;
    };
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, 3, bpsOff); tag(259, 3, 1, 1);
    tag(262, 3, 1, 2); tag(273, 4, 1, dataOff); tag(277, 3, 1, 3); tag(278, 4, 1, h);
    tag(279, 4, 1, w * h * 3); tag(282, 5, 1, xresOff); tag(283, 5, 1, yresOff);
    tag(284, 3, 1, 1); tag(296, 3, 1, 2);
    dv.setUint32(p, 0, true);
    for (let i = 0; i < 3; i++) dv.setUint16(bpsOff + i * 2, 8, true);
    dv.setUint32(xresOff, dpi, true); dv.setUint32(xresOff + 4, 1, true);
    dv.setUint32(yresOff, dpi, true); dv.setUint32(yresOff + 4, 1, true);
    return new Blob([buf, rgb], { type: 'image/tiff' });
  },
};
