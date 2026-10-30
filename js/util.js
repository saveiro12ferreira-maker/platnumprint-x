// Funções pequenas usadas em todo o motor.
const U = {
  cm: (px, dpi) => px / dpi * 2.54,
  px: (cm, dpi) => Math.max(1, Math.round(cm / 2.54 * dpi)),
  fmt: (v, d = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }),
  secs: ms => U.fmt(ms / 1000, 1) + ' s',
  now: () => performance.now(),
  // Devolve a vez para a tela atualizar. MessageChannel não é freado quando a aba fica em segundo plano.
  tick: () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }),
  isNum: s => /^-?\d+([.,]\d+)?$/.test(String(s).replace(/\s/g, '')),
  num: s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.')),
  hex: ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(),
  rgb: h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)),

  // Erosão ('min') ou dilatação ('max') de uma máscara 0/1 com janela quadrada de raio r.
  // Fora da imagem conta como 0, então a borda da peça sempre é erodida.
  box(m, W, H, r, mode) {
    const need = 2 * r + 1, isMin = mode === 'min';
    const tmp = new Uint8Array(W * H), res = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const o = y * W; let s = 0;
      for (let x = 0; x <= Math.min(r, W - 1); x++) s += m[o + x];
      for (let x = 0; x < W; x++) {
        tmp[o + x] = isMin ? (s === need ? 1 : 0) : (s > 0 ? 1 : 0);
        const add = x + r + 1, rem = x - r;
        if (add < W) s += m[o + add];
        if (rem >= 0) s -= m[o + rem];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = 0; y <= Math.min(r, H - 1); y++) s += tmp[y * W + x];
      for (let y = 0; y < H; y++) {
        res[y * W + x] = isMin ? (s === need ? 1 : 0) : (s > 0 ? 1 : 0);
        const add = y + r + 1, rem = y - r;
        if (add < H) s += tmp[add * W + x];
        if (rem >= 0) s -= tmp[rem * W + x];
      }
    }
    return res;
  },

  // Primeira e última linha preenchida de cada coluna da máscara (-1 quando vazia).
  profiles(m, W, H) {
    const top = new Int32Array(W).fill(-1), bot = new Int32Array(W).fill(-1);
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) if (m[o + x]) { if (top[x] < 0) top[x] = y; bot[x] = y; }
    }
    return { top, bot };
  },

  // Miniatura de um buffer RGB ou RGBA, por amostragem simples.
  preview(buf, w, h, ch, maxW) {
    const f = Math.min(1, maxW / w), pw = Math.max(1, Math.round(w * f)), ph = Math.max(1, Math.round(h * f));
    const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
    const ctx = cv.getContext('2d'), id = ctx.createImageData(pw, ph), o = id.data;
    for (let y = 0; y < ph; y++) {
      const sy = Math.min(h - 1, Math.floor((y + .5) / f));
      for (let x = 0; x < pw; x++) {
        const sx = Math.min(w - 1, Math.floor((x + .5) / f)), s = (sy * w + sx) * ch, q = (y * pw + x) * 4;
        const a = ch === 4 ? buf[s + 3] : 255;
        if (a < 128) { o[q] = o[q + 1] = o[q + 2] = 255; } else { o[q] = buf[s]; o[q + 1] = buf[s + 1]; o[q + 2] = buf[s + 2]; }
        o[q + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return { canvas: cv, f };
  },
};
