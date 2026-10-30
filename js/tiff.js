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
    return { width: bmp.width, height: bmp.height, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data, dpi: null };
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
