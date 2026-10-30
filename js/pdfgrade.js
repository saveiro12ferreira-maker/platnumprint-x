// Leitura da tabela de medidas da modelista a partir de um PDF com texto.
const PdfGrade = (() => {
  const SIZE_RE = /^(PP|P|M|G|GG|XG|XGG|EG|EGG|EXG|G[1-5]|XS|S|L|XL|XXL|XXXL)$/i;
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  async function readRows(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('O leitor de PDF não carregou. Confira a conexão com a internet e recarregue a página.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows = [];
    for (let pn = 1; pn <= pdf.numPages; pn++) {
      const page = await pdf.getPage(pn);
      const tc = await page.getTextContent();
      const items = tc.items
        .map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: (it.str || '').trim() }))
        .filter(it => it.s);
      const pr = [];
      for (const it of items) {
        let r = pr.find(r => Math.abs(r.y - it.y) < 3);
        if (!r) { r = { y: it.y, cells: [] }; pr.push(r); }
        r.cells.push(it);
      }
      pr.sort((a, b) => b.y - a.y);
      for (const r of pr) { r.cells.sort((a, b) => a.x - b.x); rows.push(merge(r.cells)); }
    }
    return rows;
  }

  // Palavras muito próximas viram uma célula só ("Comprimento total"); números ficam separados.
  function merge(cells) {
    const out = [];
    for (const c of cells) {
      const last = out[out.length - 1];
      if (last && c.x - (last.x + last.w) < 4 && !U.isNum(last.s) && !U.isNum(c.s)) { last.s += ' ' + c.s; last.w = c.x + c.w - last.x; }
      else out.push({ ...c });
    }
    return out;
  }

  const center = c => c.x + c.w / 2;
  const nearest = (cols, x) => cols.reduce((best, k) => Math.abs(k.x - x) < Math.abs(best.x - x) ? k : best, cols[0]);

  function parse(rows) {
    // Formato 1: tamanhos no cabeçalho das colunas, uma medida por linha.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], sz = r.filter(c => SIZE_RE.test(c.s));
      if (sz.length < 2 || sz.length < r.length - 1) continue;
      const cols = sz.map(c => ({ size: c.s.toUpperCase(), x: center(c) }));
      const med = {};
      for (let j = i + 1; j < rows.length; j++) {
        const rr = rows[j];
        if (!rr.length || U.isNum(rr[0].s) || SIZE_RE.test(rr[0].s)) continue;
        const nums = rr.slice(1).filter(c => U.isNum(c.s));
        if (nums.length < 2) continue;
        const vals = {};
        nums.forEach(c => { vals[nearest(cols, center(c)).size] = U.num(c.s); });
        med[rr[0].s] = vals;
      }
      if (Object.keys(med).length) return { sizes: cols.map(c => c.size), medidas: med, formato: 'tamanhos nas colunas' };
    }
    // Formato 2: um tamanho por linha, medidas nas colunas.
    const sizeRows = rows.map((r, i) => ({ r, i }))
      .filter(o => o.r.length >= 2 && SIZE_RE.test(o.r[0].s) && o.r.slice(1).some(c => U.isNum(c.s)));
    if (sizeRows.length >= 2) {
      let header = null;
      for (let k = sizeRows[0].i - 1; k >= 0; k--) if (rows[k].length >= 2) { header = rows[k]; break; }
      const cols = header
        ? header.slice(1).map(c => ({ name: c.s, x: center(c) }))
        : sizeRows[0].r.slice(1).map((c, k) => ({ name: 'Medida ' + (k + 1), x: center(c) }));
      const med = {};
      cols.forEach(c => { med[c.name] = {}; });
      sizeRows.forEach(o => {
        const size = o.r[0].s.toUpperCase();
        o.r.slice(1).filter(c => U.isNum(c.s)).forEach(c => { med[nearest(cols, center(c)).name][size] = U.num(c.s); });
      });
      return { sizes: sizeRows.map(o => o.r[0].s.toUpperCase()), medidas: med, formato: 'tamanhos nas linhas' };
    }
    return null;
  }

  return { readRows, parse };
})();
