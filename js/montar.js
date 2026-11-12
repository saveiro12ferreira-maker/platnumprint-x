// Montar a arte nos moldes (pedido 12/11, igual à ferramenta "ClickMoldes" do Corel):
// em vez de mandar um encaixe já estampado, a pessoa pega os moldes vazios da modelista (PDF do tamanho base),
// escolhe a arte de cada peça (frente, costas, manga…), como ela encaixa (cobrir, caber inteira, esticar),
// a posição e a margem, e põe nome, número ou logo em cima. O motor monta o "arquivo base" sozinho e segue a
// grade normal: cada tamanho sai no molde daquele tamanho, com a arte acompanhando a peça.
const Montar = (() => {
  const $ = s => document.querySelector(s);
  const el = (t, a = {}, k = []) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n === 'text') e.textContent = v; else if (n.startsWith('on')) e.addEventListener(n.slice(2), v); else if (v !== false && v != null) e.setAttribute(n, v === true ? '' : v); } for (const c of [].concat(k)) if (c != null) e.append(c); return e; };
  const MODOS = { cobrir: 'Cobrir a peça toda', caber: 'Caber inteira', esticar: 'Esticar até a beira', nada: 'Sem arte (só a cor de fundo)' };
  const POS = { centro: 'Centro', topo: 'Em cima', base: 'Embaixo', esq: 'Esquerda', dir: 'Direita' };
  const S = { artes: [], pecas: [], tam: null, arquivo: null, sel: null };   // sel = {peca, elem} elemento escolhido para clicar na miniatura

  const dpi = () => Math.round(U.num($('#dpi').value)) || 200;
  const pxCm = (cm, d) => cm / 2.54 * d;

  // ---------- artes (imagens) ----------
  async function lerArte(file) {
    let cv;
    if (/\.tiff?$/i.test(file.name)) {
      const img = await Tiff.readImage(file); cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const id = cv.getContext('2d').createImageData(img.width, img.height); id.data.set(img.data); cv.getContext('2d').putImageData(id, 0, 0);
    } else {
      const bmp = await createImageBitmap(file); cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close();
    }
    const mini = document.createElement('canvas'), k = 90 / Math.max(cv.width, cv.height); mini.width = Math.max(1, cv.width * k); mini.height = Math.max(1, cv.height * k);
    mini.getContext('2d').drawImage(cv, 0, 0, mini.width, mini.height);
    return { nome: file.name.replace(/\.[^.]+$/, ''), cv, mini };
  }
  async function onArtes(files) {
    const info = $('#mtInfo');
    for (const f of files) { info.textContent = `Abrindo ${f.name}…`; await U.tick(); try { S.artes.push(await lerArte(f)); } catch (e) { info.textContent = `Não consegui abrir ${f.name}: ${e.message}`; } }
    // peça sem arte ainda recebe a primeira
    for (const p of S.pecas) if (p.arte == null && S.artes.length) p.arte = 0;
    info.textContent = `${S.artes.length} arte(s) carregada(s).`;
    render();
  }

  // ---------- moldes do tamanho base ----------
  function pdfDoBase() {
    const tam = $('#baseSize').value, fs = (App.pdfsGuardados && App.pdfsGuardados()) || [];
    return fs.find(f => Moldes.tamDoNome(f.name) === tam) || null;
  }
  async function pegarMoldes(file) {
    const info = $('#mtInfo');
    file = file || pdfDoBase();
    if (!file) { info.textContent = `Coloque os PDFs da modelista no 2️⃣ (ou escolha aqui o PDF do tamanho ${$('#baseSize').value || 'base'}) e escolha em "Este arquivo é o tamanho" qual é o tamanho base.`; return; }
    S.tam = Moldes.tamDoNome(file.name) || $('#baseSize').value; S.arquivo = file.name;
    if (S.tam && [...$('#baseSize').options].some(o => o.value === S.tam)) { $('#baseSize').value = S.tam; $('#baseSize').dispatchEvent(new Event('change')); }
    info.textContent = `Lendo os moldes de ${file.name}…`; await U.tick();
    const pz = await Moldes.ler(file), d = dpi();
    S.pecas = [];
    for (let j = 0; j < pz.length; j++) {
      info.textContent = `Desenhando o molde ${j + 1} de ${pz.length}…`; await U.tick();
      const f = await Moldes.forma(pz.doc, pz[j], d);
      S.pecas.push({ j, w: f.w, h: f.h, m: f.m, nome: `PEÇA ${j + 1}`, qtd: 1, espelhar: true, arte: S.artes.length ? 0 : null, modo: 'cobrir', pos: 'centro', margem: 0, fundo: '#ffffff', elems: [] });
    }
    render();
    info.textContent = `${S.pecas.length} moldes do tamanho ${S.tam}. Escolha a arte de cada peça; os nomes escritos nos moldes estão sendo lidos…`;
    // nomes e quantidades escritos no molde (ex.: "MANGA 2X") — em segundo plano (o Montar espera terminar)
    S.lendo = lerNomes(pz, info); await S.lendo; S.lendo = null;
  }
  async function lerNomes(pz, info) {
    for (let j = 0; j < pz.length; j++) {
      try {
        const f = await Moldes.forma(pz.doc, pz[j], 150, { texto: true }), r = await Moldes.lerNome(f.texto), p = S.pecas[j];
        if (r && p && !p.nomeManual) { p.nome = r.nome.replace(/^\d+\s+/, '') || r.nome; if (r.qtd && !p.qtdManual) p.qtd = Math.min(8, r.qtd); render(); }
      } catch (e) { /* sem nome, segue */ }
    }
    info.textContent = `${S.pecas.length} moldes do tamanho ${S.tam} prontos. Escolha a arte de cada peça e clique em "Montar e ler".`;
  }

  // forma da peça girada (0/90/180/270) e espelhada (o par da manga): a arte NÃO espelha, só o molde
  function formaDe(p, espelho) {
    const g = ((p.gir || 0) % 360 + 360) % 360, key = g + (espelho ? 'e' : '');
    p._f = p._f || {}; if (p._f[key]) return p._f[key];
    const { w, h, m } = p, W = g % 180 ? h : w, H = g % 180 ? w : h, o = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      let X, Y; if (g === 0) { X = x; Y = y; } else if (g === 90) { X = h - 1 - y; Y = x; } else if (g === 180) { X = w - 1 - x; Y = h - 1 - y; } else { X = y; Y = w - 1 - x; }
      if (espelho) X = W - 1 - X;
      o[Y * W + X] = 1;
    }
    return (p._f[key] = { w: W, h: H, m: o });
  }

  // ---------- desenhar uma peça (arte + elementos, recortada no molde) ----------
  // k = escala (1 = dpi do arquivo). Devolve um canvas do tamanho da peça.
  function desenhar(p, k, espelho) {
    const F = formaDe(p, espelho);
    const W = Math.max(1, Math.round(F.w * k)), H = Math.max(1, Math.round(F.h * k)), d = dpi() * k;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = p.fundo || '#ffffff'; ctx.fillRect(0, 0, W, H);
    const a = p.arte != null && p.modo !== 'nada' ? S.artes[p.arte] : null;
    if (a) {
      const mg = pxCm(p.margem || 0, d), bw = W + 2 * mg, bh = H + 2 * mg, iw = a.cv.width, ih = a.cv.height;
      let w, h;
      if (p.modo === 'esticar') { w = bw; h = bh; }
      else { const s = p.modo === 'caber' ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih); w = iw * s; h = ih * s; }
      let x = (W - w) / 2, y = (H - h) / 2;
      if (p.pos === 'topo') y = -mg; if (p.pos === 'base') y = H + mg - h; if (p.pos === 'esq') x = -mg; if (p.pos === 'dir') x = W + mg - w;
      ctx.drawImage(a.cv, x, y, w, h);
    }
    for (const e of p.elems) {
      const cx = e.x * W, cy = e.y * H;
      ctx.save(); ctx.translate(cx, cy); if (e.rot) ctx.rotate(e.rot * Math.PI / 180);
      if (e.tipo === 'texto' && e.txt) {
        const hp = Math.max(2, pxCm(e.cm || 3, d));
        ctx.font = `${e.negrito === false ? '' : '800 '}${hp}px ${e.fonte || 'Arial Black, Arial, sans-serif'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (e.borda) { ctx.lineWidth = Math.max(1, hp * 0.12); ctx.strokeStyle = e.borda; ctx.lineJoin = 'round'; ctx.strokeText(e.txt, 0, 0); }
        ctx.fillStyle = e.cor || '#000'; ctx.fillText(e.txt, 0, 0);
      } else if (e.tipo === 'logo' && e.arte != null && S.artes[e.arte]) {
        const L = S.artes[e.arte].cv, w = Math.max(2, pxCm(e.cm || 8, d)), h = w * L.height / L.width;
        ctx.drawImage(L, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
    // recorta no molde
    const id = ctx.getImageData(0, 0, W, H), D = id.data;
    for (let y = 0; y < H; y++) { const sy = Math.min(F.h - 1, Math.floor(y / k)); for (let x = 0; x < W; x++) if (!F.m[sy * F.w + Math.min(F.w - 1, Math.floor(x / k))]) D[(y * W + x) * 4 + 3] = 0; }
    ctx.putImageData(id, 0, 0);
    return cv;
  }

  // ---------- montar o arquivo base e mandar ler ----------
  async function montar() {
    const info = $('#mtInfo');
    if (!S.pecas.length) { info.textContent = 'Primeiro pegue os moldes do tamanho base.'; return; }
    if (S.lendo) { info.textContent = 'Terminando de ler os nomes e quantidades escritos nos moldes…'; await S.lendo; }
    const d = dpi(), gap = Math.round(pxCm(3, d)), larg = Math.round(pxCm(Math.max(60, U.num($('#mtLargura').value) || 150), d)), risca = Math.max(2, Math.round(pxCm(0.06, d)));
    // lista de cópias (peça com 2X sai duas vezes; a 2ª espelhada se pedir)
    const itens = [];
    for (const p of S.pecas) for (let c = 0; c < Math.max(1, p.qtd | 0); c++) itens.push({ p, esp: c % 2 === 1 && p.espelhar });
    // prateleiras
    let x = gap, y = gap, alt = 0; const lug = [];
    for (const it of itens) {
      const F = formaDe(it.p, it.esp), w = F.w + 2 * risca, h = F.h + 2 * risca;
      if (x + w + gap > larg && x > gap) { x = gap; y += alt + gap; alt = 0; }
      lug.push({ ...it, x, y }); x += w + gap; alt = Math.max(alt, h);
    }
    const W = Math.max(larg, ...lug.map(l => l.x + formaDe(l.p, l.esp).w + 2 * risca + gap)), H = y + alt + gap;
    if (W * H > 260e6) { info.textContent = `Ficou grande demais (${U.fmt(U.cm(W, d))} × ${U.fmt(U.cm(H, d))} cm a ${d} dpi). Baixe a resolução e tente de novo.`; return; }
    info.textContent = `Montando ${itens.length} peças (${U.fmt(U.cm(W, d))} × ${U.fmt(U.cm(H, d))} cm a ${d} dpi)…`; await U.tick();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    for (const l of lug) {
      const pc = desenhar(l.p, 1, l.esp);
      // risca (contorno preto) em volta da peça, como no arquivo do Corel
      const rc = document.createElement('canvas'); rc.width = pc.width + 2 * risca; rc.height = pc.height + 2 * risca;
      const rx = rc.getContext('2d');
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; rx.drawImage(pc, risca + Math.cos(t) * risca, risca + Math.sin(t) * risca); }
      rx.globalCompositeOperation = 'source-in'; rx.fillStyle = '#000'; rx.fillRect(0, 0, rc.width, rc.height);
      rx.globalCompositeOperation = 'source-over'; rx.drawImage(pc, risca, risca);
      ctx.drawImage(rc, l.x, l.y);
      await U.tick();
    }
    const im = ctx.getImageData(0, 0, W, H); cv.width = cv.height = 1;
    const nome = `Arte montada ${S.arquivo ? S.arquivo.replace(/\.pdf$/i, '') : ''}`.trim();
    S.ultima = { W, H, data: im.data, d, nome };
    info.textContent = `Montado. Lendo como arquivo base do tamanho ${S.tam || $('#baseSize').value}…`;
    await App.lerMontada({ width: W, height: H, data: im.data, dpi: d }, nome + '.png');
    info.textContent = `✔ Arte montada e lida (${itens.length} peças, tamanho ${S.tam || $('#baseSize').value}). Siga nas abas Peças e Gerar como sempre.`;
  }
  async function baixarPng() {
    const u = S.ultima; if (!u) { $('#mtInfo').textContent = 'Monte primeiro.'; return; }
    const cv = document.createElement('canvas'); cv.width = u.W; cv.height = u.H; cv.getContext('2d').putImageData(new ImageData(u.data, u.W, u.H), 0, 0);
    cv.toBlob(b => { const a = el('a', { href: URL.createObjectURL(b), download: u.nome + '.png' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); cv.width = cv.height = 1; }, 'image/png');
  }

  // ---------- tela ----------
  function opcoes(obj, atual) { return Object.entries(obj).map(([v, t]) => el('option', { value: v, selected: v === atual, text: t })); }
  function selArte(atual, onch, vazio) {
    const s = el('select', { onchange: e => onch(e.target.value === '' ? null : +e.target.value) }, [el('option', { value: '', text: vazio || '— sem arte —' }), ...S.artes.map((a, i) => el('option', { value: i, selected: i === atual, text: a.nome }))]);
    return s;
  }
  function miniatura(p) {
    const F = formaDe(p, false), k = Math.min(1, 220 / Math.max(F.w, F.h));
    const cv = desenhar(p, k, false); cv.className = 'mt-mini'; cv.title = 'Clique para pôr ali o elemento escolhido (nome, número ou logo)';
    cv.addEventListener('click', ev => {
      const r = cv.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
      const e = S.sel && S.sel.peca === p ? S.sel.elem : p.elems[p.elems.length - 1];
      if (!e) return; e.x = fx; e.y = fy; render();
    });
    return cv;
  }
  function campoNum(v, on, passo, w) { return el('input', { type: 'number', step: passo || 0.5, value: v, style: `width:${w || 64}px`, onchange: e => { on(U.num(e.target.value)); render(); } }); }
  function linhaElem(p, e, i) {
    const marca = S.sel && S.sel.elem === e;
    const tira = el('button', { type: 'button', class: 'mini', title: 'Tirar', text: '✕', onclick: () => { p.elems.splice(i, 1); if (marca) S.sel = null; render(); } });
    const esc = el('button', { type: 'button', class: 'mini' + (marca ? ' mt-on' : ''), title: 'Escolher: depois clique na miniatura para pôr no lugar', text: marca ? '📍 escolhido' : '📍', onclick: () => { S.sel = { peca: p, elem: e }; render(); } });
    if (e.tipo === 'texto') return el('div', { class: 'mt-el' }, [esc, el('input', { value: e.txt || '', placeholder: 'NOME ou 10', style: 'width:110px', onchange: ev => { e.txt = ev.target.value; render(); } }),
      'letra', campoNum(e.cm, v => e.cm = v, 0.5, 58), 'cm', el('input', { type: 'color', value: e.cor || '#000000', onchange: ev => { e.cor = ev.target.value; render(); } }),
      'giro', campoNum(e.rot || 0, v => e.rot = v, 5, 58), '°', tira]);
    return el('div', { class: 'mt-el' }, [esc, 'logo', selArte(e.arte, v => { e.arte = v; render(); }, '— escolha a imagem —'), 'largura', campoNum(e.cm, v => e.cm = v, 0.5, 58), 'cm', 'giro', campoNum(e.rot || 0, v => e.rot = v, 5, 58), '°', tira]);
  }
  function cartao(p) {
    const s = (k, v) => { p[k] = v; render(); };
    return el('div', { class: 'mt-card' }, [
      miniatura(p),
      el('div', { class: 'mt-campos' }, [
        el('div', { class: 'row', style: 'margin:0' }, [el('input', { value: p.nome, style: 'width:130px;font-weight:700', title: 'Nome da peça', onchange: e => { p.nome = e.target.value.toUpperCase(); p.nomeManual = true; render(); } }),
          el('span', { class: 'muted', text: `${U.fmt(U.cm(p.w, dpi()))} × ${U.fmt(U.cm(p.h, dpi()))} cm` }),
          el('label', { title: 'Quantas vezes essa peça sai no arquivo (ex.: manga 2X)' }, ['Qtd ', el('input', { type: 'number', min: 1, max: 8, value: p.qtd, style: 'width:52px', onchange: e => { p.qtd = Math.max(1, U.num(e.target.value) | 0); p.qtdManual = true; render(); } })]),
          el('button', { type: 'button', class: 'mini', title: 'Gira o molde 90° (a arte continua em pé)', text: `⟳ ${p.gir || 0}°`, onclick: () => s('gir', ((p.gir || 0) + 90) % 360) }),
          p.qtd > 1 ? el('label', { title: 'O par sai com o molde espelhado (a arte e os textos não espelham)' }, [el('input', { type: 'checkbox', checked: p.espelhar, onchange: e => s('espelhar', e.target.checked) }), ' espelhar o par']) : null]),
        el('div', { class: 'row', style: 'margin:6px 0' }, [el('label', {}, ['Arte ', selArte(p.arte, v => s('arte', v))]),
          el('select', { onchange: e => s('modo', e.target.value) }, opcoes(MODOS, p.modo)),
          el('select', { onchange: e => s('pos', e.target.value) }, opcoes(POS, p.pos))]),
        el('div', { class: 'row', style: 'margin:6px 0' }, [el('label', { title: 'Sobra da arte para fora da peça (sangria)' }, ['Margem ', campoNum(p.margem, v => p.margem = v, 0.5), ' cm']),
          el('label', {}, ['Fundo ', el('input', { type: 'color', value: p.fundo, onchange: e => s('fundo', e.target.value) })]),
          el('button', { type: 'button', class: 'mini', title: 'Copia arte, encaixe, posição, margem, fundo e elementos desta peça para todas as outras', text: '⧉ Igual em todas', onclick: () => { for (const q of S.pecas) if (q !== p) Object.assign(q, { arte: p.arte, modo: p.modo, pos: p.pos, margem: p.margem, fundo: p.fundo, elems: p.elems.map(e => ({ ...e })) }); render(); } })]),
        ...p.elems.map((e, i) => linhaElem(p, e, i)),
        el('div', { class: 'row', style: 'margin:6px 0' }, [
          el('button', { type: 'button', class: 'mini', text: '＋ Nome / número', onclick: () => { const e = { tipo: 'texto', txt: '', cm: 3, cor: '#000000', x: 0.5, y: 0.3 }; p.elems.push(e); S.sel = { peca: p, elem: e }; render(); } }),
          el('button', { type: 'button', class: 'mini', text: '＋ Logo / imagem', onclick: () => { const e = { tipo: 'logo', arte: S.artes.length ? S.artes.length - 1 : null, cm: 8, x: 0.5, y: 0.3 }; p.elems.push(e); S.sel = { peca: p, elem: e }; render(); } })])
      ])
    ]);
  }
  function render() {
    $('#mtArtes').replaceChildren(...S.artes.map((a, i) => el('div', { class: 'mt-arte', title: a.nome }, [a.mini, el('span', { text: a.nome }),
      el('button', { type: 'button', class: 'mini', title: 'Usar esta arte em todas as peças', text: 'em todas', onclick: () => { S.pecas.forEach(p => { p.arte = i; if (p.modo === 'nada') p.modo = 'cobrir'; }); render(); } })])));
    $('#mtPecas').replaceChildren(...S.pecas.map(cartao));
    $('#mtMontar').disabled = !S.pecas.length;
  }

  function ligar() {
    if (!$('#mtBox')) return;
    $('#mtArtesIn').addEventListener('change', e => { if (e.target.files.length) onArtes([...e.target.files]); e.target.value = ''; });
    $('#mtPdfIn').addEventListener('change', e => { if (e.target.files[0]) pegarMoldes(e.target.files[0]).catch(er => { $('#mtInfo').textContent = 'Erro: ' + er.message; }); e.target.value = ''; });
    $('#mtPegar').addEventListener('click', () => pegarMoldes().catch(er => { console.error(er); $('#mtInfo').textContent = 'Erro: ' + er.message; }));
    $('#mtMontar').addEventListener('click', () => montar().catch(er => { console.error(er); $('#mtInfo').textContent = 'Erro ao montar: ' + er.message; }));
    $('#mtBaixar').addEventListener('click', baixarPng);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
  return { S, desenhar, montar, pegarMoldes, onArtes };
})();
