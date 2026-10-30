// Tela de entrada da equipe. É só de fachada: o site é estático, então não há como proteger de verdade.
// A senha não fica escrita aqui; só a "impressão digital" (SHA-256) de usuário e senha.
const Acesso = (() => {
  const SALT = 'platnumprint-x';
  const USERS = { equipe: '654b1386bacb7c48f58be5799640bb5503df9bf2b49095e9c8703c989056cf53' };
  const KEY = 'pp_acesso';

  // SHA-256 próprio, para funcionar até abrindo o index.html direto do computador.
  function sha256(str) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(str), l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n);
    m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
    const r = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  const $ = s => document.querySelector(s);
  const logged = () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } };

  function show(on) {
    document.body.classList.toggle('travado', on);
    // Esconde direto pelo código também, para valer mesmo se o navegador ainda estiver com o visual antigo em cache.
    document.querySelectorAll('body > header, body > main').forEach(e => { e.style.display = on ? 'none' : ''; });
    $('#login').hidden = !on;
    const u = logged();
    $('#quem').textContent = u ? u : '';
    if (on) setTimeout(() => $('#lgUser').focus(), 50);
  }

  function entrar(e) {
    e.preventDefault();
    const u = $('#lgUser').value.trim().toLowerCase(), p = $('#lgPass').value;
    if (!u || !p) { $('#lgErr').textContent = 'Preencha usuário e senha.'; return; }
    if (USERS[u] && USERS[u] === sha256(`${SALT}|${u}|${p}`)) {
      try { sessionStorage.setItem(KEY, u); } catch (err) { /* sem armazenamento: vale só até recarregar */ }
      $('#lgPass').value = ''; $('#lgErr').textContent = '';
      show(false);
    } else {
      $('#lgErr').textContent = 'Usuário ou senha incorretos.';
      $('#lgPass').value = ''; $('#lgPass').focus();
    }
  }

  function sair() {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* nada a limpar */ }
    show(true);
  }

  $('#lgForm').addEventListener('submit', entrar);
  $('#lgPass').addEventListener('input', () => { $('#lgErr').textContent = ''; });
  $('#btnSair').addEventListener('click', sair);
  show(!logged());
  return { sha256 };
})();
