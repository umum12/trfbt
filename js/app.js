/* TRFBT PWA - UI & routing (hash-based, aman untuk subpath GitHub Pages) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = ReceiptEngine.escapeHtml;
  var fmt = function (n) { return (parseInt(n, 10) || 0).toLocaleString('id-ID'); };
  var VERSION = '1.0.0';

  var app = $('#app'), overlay = $('#overlay');
  var S = Store.getSettings();
  var cur = null, tpl = 1, dirty = false, previewSeq = 0, previewTimer = 0;
  var logoCache = { src: '', img: null };
  var deferredInstall = null, printerHook = null;
  var scanType = 'trf', scanAbort = null, scanPend = null;

  /* ---------- ikon ---------- */
  var sv = function (p, w) { return '<svg width="' + (w || 20) + '" height="' + (w || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; };
  var ICON = {
    back: sv('<polyline points="15 18 9 12 15 6"/>'),
    trf: sv('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
    pln: sv('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
    bill: sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    home: sv('<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    list: sv('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
    printer: sv('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    trash: sv('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 16),
    edit: sv('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
    plus: sv('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 16),
    x: sv('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 16)
  };
  var TYPE = {
    trf: { name: 'Struk Transfer', icon: ICON.trf, tone: 'tone-trf' },
    pln: { name: 'Token Listrik', icon: ICON.pln, tone: 'tone-pln' },
    tagihan: { name: 'Struk Tagihan', icon: ICON.bill, tone: 'tone-tagihan' }
  };

  /* ---------- util ---------- */
  var toastTimer;
  function toast(msg, cb) {
    var t = $('#toast');
    t.textContent = msg; t.onclick = cb || null;
    t.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, cb ? 9000 : 2800);
  }
  function nowStr() {
    var n = new Date(), p = function (x) { return ('0' + x).slice(-2); };
    return p(n.getDate()) + '-' + p(n.getMonth() + 1) + '-' + n.getFullYear() + ' ' + p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds());
  }
  function genRef() { return String(Date.now()).slice(-10) + ('0' + Math.floor(Math.random() * 100)).slice(-2); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function saveS(quiet) {
    if (!Store.saveSettings(S)) { toast('Gagal menyimpan: penyimpanan perangkat penuh'); return false; }
    if (!quiet) toast('Tersimpan');
    return true;
  }
  function itemTitle(x) {
    if (x.tipe === 'pln') return x.nama && x.nama !== '-' ? x.nama : 'Token PLN';
    if (x.tipe === 'tagihan') return x.nama && x.nama !== '-' ? x.nama : (x.layanan || 'Tagihan');
    return x.r_name || 'Transfer';
  }

  /* ---------- overlay ---------- */
  function closeOverlay() { overlay.innerHTML = ''; }
  function openLayer(cls, inner, onDismiss) {
    overlay.innerHTML = '<div class="bg ' + (cls === 'dialog' ? 'center' : '') + '"><div class="' + cls + '">' + inner + '</div></div>';
    var bg = overlay.firstChild;
    bg.addEventListener('click', function (e) { if (e.target === bg) { closeOverlay(); if (onDismiss) onDismiss(); } });
    return bg.firstChild;
  }
  function confirmBox(title, msg, ok) {
    return new Promise(function (res) {
      var d = openLayer('dialog', '<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p><div class="row-btns"><button class="btn ghost" data-r="0">Batal</button><button class="btn primary" data-r="1">' + esc(ok || 'Ya') + '</button></div>', function () { res(false); });
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-r]');
        if (b) { closeOverlay(); res(b.dataset.r === '1'); }
      });
    });
  }
  function formDialog(o) {
    var html = '<h3>' + esc(o.title) + '</h3>' + (o.desc ? '<p>' + esc(o.desc) + '</p>' : '') + o.fields.map(function (f) {
      return '<div class="fg"><label>' + esc(f.label) + '</label><input class="fi" id="fd_' + f.id + '" ' + (f.num ? 'inputmode="numeric" data-num="1"' : '') + ' placeholder="' + esc(f.ph || '') + '" autocomplete="off"></div>';
    }).join('') + '<div class="row-btns"><button class="btn ghost" data-r="0">Batal</button><button class="btn primary" data-r="1">Simpan</button></div>';
    var d = openLayer('dialog', html);
    d.addEventListener('input', function (e) {
      if (e.target.dataset.num) { var r = e.target.value.replace(/\D/g, ''); e.target.value = r ? fmt(r) : ''; }
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return;
      if (b.dataset.r === '0') { closeOverlay(); return; }
      var vals = {};
      o.fields.forEach(function (f) {
        var v = $('#fd_' + f.id, d).value.trim();
        vals[f.id] = f.num ? (v === '' ? null : parseInt(v.replace(/\D/g, ''), 10)) : v;
      });
      var err = o.onOk(vals);
      if (err) toast(err); else closeOverlay();
    });
    var first = $('input', d); if (first) first.focus();
  }

  /* ---------- router ---------- */
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function back() { if (history.length > 1) history.back(); else go('#/'); }
  function route() {
    if (cur && dirty) persist();
    cur = null; dirty = false; printerHook = null; app.onchange = null; app.oninput = null;
    clearTimeout(previewTimer);
    closeOverlay();
    var p = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    switch (p[0]) {
      case 'history': viewHistory(); break;
      case 'new': viewEditor(null, p[1]); break;
      case 'edit': viewEditor(p[1]); break;
      case 'printer': viewPrinter(); break;
      case 'settings': viewSettings(); break;
      case 'share': viewHome(); handleShared(); break;
      default: viewHome();
    }
  }
  function navHtml(on) {
    var b = function (id, ic, lb, to) { return '<button class="' + (on === id ? 'on' : '') + '" data-act="go" data-to="' + to + '"><span class="nb">' + ic + '</span>' + lb + '</button>'; };
    return '<div class="nav"><div>' + b('home', ICON.home, 'Beranda', '#/') + b('history', ICON.list, 'Riwayat', '#/history') + b('printer', ICON.printer, 'Printer', '#/printer') + b('settings', ICON.gear, 'Setelan', '#/settings') + '</div></div>';
  }
  function topbar(title, extra) {
    return '<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Kembali">' + ICON.back + '</button><h1>' + esc(title) + '</h1>' + (extra || '') + '</div>';
  }

  /* ---------- daftar riwayat ---------- */
  function itemHtml(x) {
    var T = TYPE[x.tipe] || TYPE.trf, dt = String(x.date || '').substring(0, 16);
    return '<div class="item"><button class="main" data-act="open" data-id="' + esc(x.id) + '"><span class="ii ' + T.tone + '">' + T.icon + '</span><span class="tx"><div class="t">' + esc(itemTitle(x)) + '</div><div class="s">' + esc(dt) + ' &nbsp;<span class="amt">Rp ' + fmt(x.amount) + '</span></div></span></button><button class="del" data-act="del" data-id="' + esc(x.id) + '" aria-label="Hapus">' + ICON.trash + '</button></div>';
  }

  /* ---------- Beranda ---------- */
  function viewHome() {
    var hist = Store.getHistory().slice(0, 5);
    app.innerHTML = '<div class="brand"><b>TRFBT</b>' + (deferredInstall ? '<button class="chip-install" data-act="install">Pasang aplikasi</button>' : '') + '</div>' +
      '<div class="page" style="padding-top:8px">' +
      '<button class="hero" data-act="scan" data-type="trf"><div><h2>Scan Bukti Transfer</h2><p>Pilih bukti transfer dari galeri, data terbaca otomatis lalu jadi struk.</p></div><div class="ico">' + sv('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', 30) + '</div></button>' +
      '<div class="grid2"><button class="tile" data-act="scan" data-type="pln"><span class="ti tone-pln">' + ICON.pln + '</span><div><h3>Token Listrik</h3><p>Scan bukti PLN</p></div></button>' +
      '<button class="tile" data-act="scan" data-type="tagihan"><span class="ti tone-tagihan">' + ICON.bill + '</span><div><h3>Tagihan</h3><p>Scan struk tagihan</p></div></button></div>' +
      '<div class="manual">Isi manual:<button data-act="new" data-type="trf">Transfer</button><button data-act="new" data-type="pln">Token</button><button data-act="new" data-type="tagihan">Tagihan</button></div>' +
      '<button class="help" data-act="shareHelp">Panduan upload &amp; share</button>' +
      '<div class="sec"><h4>Riwayat Cetak</h4><button data-act="go" data-to="#/history">Lihat semua</button></div>' +
      '<div class="list">' + (hist.length ? hist.map(itemHtml).join('') : '<div class="empty">Belum ada struk.<br>Buat struk pertama Anda dari tombol di atas.</div>') + '</div></div>' + navHtml('home');
  }

  /* ---------- Riwayat ---------- */
  function viewHistory() {
    app.innerHTML = topbar('Riwayat', '<button class="del" data-act="delall" aria-label="Hapus semua" style="width:auto;padding:0 12px;font-size:12px;font-weight:700;gap:6px;display:flex;align-items:center">' + ICON.trash + 'Semua</button>') +
      '<div class="page"><div class="fg"><input class="fi" id="q" type="search" placeholder="Cari nama, nominal, atau referensi"></div><div class="list" id="hl"></div></div>' + navHtml('history');
    var render = function () {
      var q = $('#q').value.trim().toLowerCase(), all = Store.getHistory();
      var rows = all.filter(function (x) {
        return !q || [itemTitle(x), x.amount, x.ref, x.layanan, x.no_meter, x.no_pel].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      $('#hl').innerHTML = rows.length ? rows.map(itemHtml).join('') : '<div class="empty">' + (all.length ? 'Tidak ada hasil.' : 'Belum ada riwayat transaksi.') + '</div>';
    };
    $('#q').addEventListener('input', render); render();
  }

  /* ---------- Editor ---------- */
  var LBL = {
    date: ['Waktu Transaksi'], ref: ['Nomor Referensi'], catatan: ['Catatan (opsional)'],
    r_name: ['Nama Penerima'], r_bank: ['Bank Tujuan'], r_num: ['No. Rekening'],
    id_pel: ['ID Pelanggan'], no_meter: ['No. Meter'], nama: ['Nama Pelanggan'], tarif_daya: ['Tarif / Daya'], kwh: ['Jml KWH'], token: ['Token (20 digit)', 'token'],
    layanan: ['Jenis Layanan (PDAM, BPJS, ...)'], no_pel: ['Nomor Pelanggan'], periode: ['Periode (contoh: Sep 2026)'],
    amount: ['Nominal', 'num'], admin: ['Biaya Admin', 'num'], denda: ['Denda', 'num']
  };
  var LAYOUT = {
    trf: ['~Waktu & referensi', ['date'], ['ref'], '~Pengirim (opsional)', ['@sender'], '~Penerima', ['r_name'], ['r_bank', 'r_num'], '~Pembayaran', ['amount', 'admin'], ['catatan']],
    pln: ['~Waktu & referensi', ['date'], ['ref'], '~Data pelanggan PLN', ['id_pel', 'no_meter'], ['nama'], ['tarif_daya', 'kwh'], ['token'], '~Pembayaran', ['amount', 'admin'], ['catatan']],
    tagihan: ['~Waktu & referensi', ['date'], ['ref'], '~Data pelanggan', ['layanan'], ['no_pel'], ['nama'], ['periode'], '~Pembayaran', ['amount', 'denda'], ['admin'], ['catatan']]
  };

  function newItem(type) {
    if (!TYPE[type]) type = 'trf';
    var d = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipe: type, date: nowStr(), ref: genRef(), amount: 0, denda: 0, admin: Store.calcAdmin(S, 0), catatan: '' };
    if (type === 'trf') {
      Object.assign(d, { r_name: '', r_bank: '', r_num: '', s_name: '', s_bank: '', s_num: '' });
      var sd = S.saved_senders[S.default_sender_idx];
      if (S.show_sender && sd) { d.s_name = sd.name; d.s_bank = sd.bank; d.s_num = sd.num; }
    } else if (type === 'pln') Object.assign(d, { id_pel: '', no_meter: '', nama: '', tarif_daya: '', kwh: '', token: '' });
    else Object.assign(d, { layanan: '', no_pel: '', nama: '', periode: '' });
    return d;
  }
  function persist() {
    if (!cur) return;
    if (!Store.upsert(cur)) toast('Gagal menyimpan: penyimpanan perangkat penuh');
    dirty = false;
  }
  function getLogo() {
    if (!S.logo) return Promise.resolve(null);
    if (logoCache.src === S.logo && logoCache.img) return Promise.resolve(logoCache.img);
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { logoCache = { src: S.logo, img: im }; res(im); };
      im.onerror = function () { res(null); };
      im.src = S.logo;
    });
  }
  function currentReceipt() { return Receipts.build(cur, S, tpl); }
  function renderPreview() {
    var seq = ++previewSeq;
    getLogo().then(function (logo) {
      var box = $('#paper');
      if (seq !== previewSeq || !box || !cur) return;
      box.replaceChildren(currentReceipt().toCanvas({ logo: logo, logoPct: S.logo_width }));
    });
  }
  function previewSoon() { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 120); }

  function viewEditor(id, type) {
    var isNew = !id;
    if (id) {
      var found = Store.getHistory().filter(function (x) { return x.id === id; })[0];
      if (!found) { toast('Struk tidak ditemukan'); go('#/'); return; }
      cur = JSON.parse(JSON.stringify(found));
    } else cur = newItem(type);
    tpl = Store.getTemplate(cur.tipe);
    var names = Receipts.TEMPLATE_NAMES[cur.tipe];
    app.innerHTML = topbar(TYPE[cur.tipe].name) +
      '<div class="tabs">' + names.map(function (n, i) { return '<button class="tab ' + (i + 1 === tpl ? 'on' : '') + '" data-act="tpl" data-n="' + (i + 1) + '">' + (i + 1) + '. ' + esc(n) + '</button>'; }).join('') + '</div>' +
      '<div class="stage"><div class="paper" id="paper"></div></div>' +
      '<div class="actions"><button class="btn ghost" data-act="form" aria-label="Edit data">' + ICON.edit + '</button><button class="btn green" data-act="share">BAGIKAN</button><button class="btn primary flex" data-act="print" id="btnPrint">CETAK</button></div>';
    renderPreview();
    if (isNew) { dirty = false; openForm(); }
  }

  function fieldHtml(k) {
    var d = LBL[k], t = d[1] || 'text', v;
    if (t === 'num') v = cur[k] ? fmt(cur[k]) : '';
    else if (t === 'token') v = String(cur[k] || '').replace(/(.{4})(?=.)/g, '$1 ');
    else v = cur[k] == null ? '' : cur[k];
    var ro = (k === 'admin' && S.admin_type === 'tiered') ? ' readonly' : '';
    return '<div class="fg"><label>' + esc(d[0]) + '</label><input class="fi" data-k="' + k + '" data-t="' + t + '" value="' + esc(v) + '"' + (t !== 'text' ? ' inputmode="numeric"' : '') + ro + ' autocomplete="off"></div>';
  }
  function senderHtml() {
    var idx = -1;
    S.saved_senders.forEach(function (s, i) { if (s.name === cur.s_name && s.bank === cur.s_bank) idx = i; });
    return '<div class="fg"><label>Pilih pengirim</label><select class="fi" id="senderSel"><option value="-1">Tanpa pengirim</option>' +
      S.saved_senders.map(function (s, i) { return '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + esc(s.name + ' (' + s.bank + ')') + '</option>'; }).join('') + '</select></div>';
  }
  function openForm() {
    var rows = LAYOUT[cur.tipe], html = '', pendingSep = '';
    rows.forEach(function (r) {
      if (typeof r === 'string') { pendingSep = r.slice(1); return; }
      var cells = r.filter(function (k) {
        if (k === 'admin') return S.show_admin_fee;
        if (k === '@sender') return S.show_sender && S.saved_senders.length > 0;
        return true;
      }).map(function (k) { return k === '@sender' ? senderHtml() : fieldHtml(k); });
      if (!cells.length) return;
      if (pendingSep) { html += '<div class="sep">' + esc(pendingSep) + '</div>'; pendingSep = ''; }
      html += cells.length > 1 ? '<div class="cols">' + cells.join('') + '</div>' : cells[0];
    });
    var sh = openLayer('sheet', '<div class="sh-head"><b>Edit Data</b><button data-act="closeForm">Selesai</button></div>' + html + '<button class="btn primary block" data-act="closeForm" style="margin-top:8px">Simpan</button>', function () { persist(); });
    sh.addEventListener('input', function (e) {
      var el = e.target, k = el.dataset.k; if (!k || !cur) return;
      var t = el.dataset.t, r;
      if (t === 'num') {
        r = el.value.replace(/\D/g, ''); cur[k] = r ? parseInt(r, 10) : 0; el.value = r ? fmt(cur[k]) : '';
        if (k === 'amount' && S.admin_type === 'tiered') {
          cur.admin = Store.calcAdmin(S, cur.amount);
          var a = $('[data-k="admin"]', sh); if (a) a.value = cur.admin ? fmt(cur.admin) : '';
        }
      } else if (t === 'token') {
        r = el.value.replace(/\D/g, '').slice(0, 24); cur[k] = r; el.value = r.replace(/(.{4})(?=.)/g, '$1 ');
      } else cur[k] = el.value;
      dirty = true; previewSoon();
    });
    sh.addEventListener('change', function (e) {
      if (e.target.id !== 'senderSel') return;
      var s = S.saved_senders[parseInt(e.target.value, 10)];
      cur.s_name = s ? s.name : ''; cur.s_bank = s ? s.bank : ''; cur.s_num = s ? s.num : '';
      dirty = true; renderPreview();
    });
  }

  async function doPrint(btn) {
    persist();
    var old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      if (!Printer.connected()) await Printer.pick();
      var logo = await getLogo();
      await Printer.print(currentReceipt().toEscPos({ logo: logo, logoPct: S.logo_width }));
      toast('Struk dikirim ke printer');
      if (S.printer_name !== Printer.name()) { S.printer_name = Printer.name(); saveS(true); }
    } catch (err) {
      toast((err && err.message) || 'Gagal mencetak');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  async function doShare() {
    persist();
    var logo = await getLogo();
    currentReceipt().toCanvas({ logo: logo, logoPct: S.logo_width }).toBlob(async function (blob) {
      if (!blob) { toast('Gagal membuat gambar struk'); return; }
      var file = new File([blob], 'struk-' + (cur ? cur.id : Date.now()) + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Struk' }); } catch (e) { if (e.name !== 'AbortError') toast('Gagal membagikan'); }
      } else { download(blob, file.name); toast('Gambar struk disimpan ke unduhan'); }
    }, 'image/png');
  }

  /* ---------- Scan OCR ---------- */
  var TYPE_DESC = { trf: 'Transfer antar bank atau e-wallet', pln: 'Pembelian token PLN prabayar', tagihan: 'PDAM, BPJS, PLN pascabayar, cicilan, pulsa, dll' };
  function infoBox(title, msg) {
    openLayer('dialog', '<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p><div class="row-btns"><button class="btn primary" data-act="closeOverlay">Tutup</button></div>');
  }
  function showLoading(t, sub) {
    openLayer('dialog', '<div style="text-align:center"><div class="spin dk"></div><h3 id="ldT">' + esc(t) + '</h3><p id="ldD">' + esc(sub) + '</p><button class="btn ghost block" data-act="cancelScan" style="box-shadow:none">Batal</button></div>', cancelScan);
  }
  function setLoading(t, sub) { var a = $('#ldT'), b = $('#ldD'); if (a) a.textContent = t; if (b) b.textContent = sub; }
  function cancelScan() { if (scanAbort) scanAbort.abort(); scanAbort = null; scanPend = null; closeOverlay(); }

  async function runScan(blob, type) {
    if (S.ocr_mode === 'server' && !navigator.onLine) { toast('Mode server butuh internet. Ganti ke mesin di perangkat atau isi manual.'); return; }
    var ac = new AbortController(); scanAbort = ac;
    showLoading('Memproses...', 'Menyiapkan gambar');
    try {
      var b64 = await OCR.prepare(blob);
      setLoading('Menganalisa struk...', 'Membaca data dari gambar');
      var data = await OCR.run(S, { device_id: S.device_id, image_base64: b64, scan_type: type }, ac.signal, function (m) { setLoading('Menganalisa struk...', m); });
      if (scanAbort !== ac) return;
      scanAbort = null; closeOverlay(); handleScanResult(data, type);
    } catch (e) {
      if (scanAbort !== ac) return;
      scanAbort = null; closeOverlay();
      if (e.name !== 'AbortError') infoBox('Scan gagal', e.message || 'Terjadi kesalahan.');
    }
  }
  function handleScanResult(data, type) {
    if (!data || typeof data !== 'object') { infoBox('Scan gagal', 'Respon server kosong.'); return; }
    if (type !== 'auto') {
      if (data.status === 'error') infoBox('Gagal', data.message || 'Gagal memproses struk.');
      else openFromOcr(data, type);
      return;
    }
    if (data.status === 'need_choice') { scanPend = { session: data.ocr_session || null, detected: data.detected_type || '', result: null }; showTypeChoice(); }
    else if (data.status === 'error') {
      if (data.ocr_session) { scanPend = { session: data.ocr_session, detected: data.detected_type || '', result: null }; showTypeChoice(); toast('Data belum terbaca, pilih jenis struk'); }
      else infoBox('Gagal', data.message || 'Gagal memproses struk.');
    } else {
      scanPend = { session: data.ocr_session || null, detected: data.tipe_struk || data.detected_type || 'trf', result: data };
      showAutoConfirm();
    }
  }
  function summaryHtml(d, t) {
    var rows = t === 'pln' ? [['Nama', d.nama], ['No. Meter', d.no_meter], ['Nominal', d.amount]]
      : t === 'tagihan' ? [['Layanan', d.layanan], ['Nama', d.nama], ['Total', d.amount]]
      : [['Penerima', d.r_name], ['Bank', d.r_bank], ['Nominal', d.amount]];
    return rows.map(function (r) {
      var v = r[0] === 'Nominal' || r[0] === 'Total' ? (parseInt(String(r[1]).replace(/\D/g, ''), 10) ? 'Rp ' + fmt(String(r[1]).replace(/\D/g, '')) : '') : String(r[1] == null ? '' : r[1]).trim();
      return v && v !== '-' ? '<div><span>' + esc(r[0]) + '</span><b>' + esc(v) + '</b></div>' : '';
    }).join('');
  }
  function showAutoConfirm() {
    var t = TYPE[scanPend.detected] ? scanPend.detected : 'trf', T = TYPE[t];
    var sum = summaryHtml(scanPend.result, t);
    openLayer('sheet', '<div class="tcard"><span class="ti ' + T.tone + '">' + T.icon + '</span><div><b>' + T.name.replace('Struk ', '') + '</b><span>' + TYPE_DESC[t] + '</span></div></div>' +
      (sum ? '<div class="sum">' + sum + '</div>' : '') +
      '<p style="text-align:center;font-weight:700;font-size:13px;margin-bottom:12px">Apakah jenis struk ini sudah benar?</p>' +
      '<button class="btn primary block" data-act="autoYes" style="margin-bottom:10px">Ya, lanjutkan</button>' +
      '<button class="btn ghost block" data-act="typeChoice" style="margin-bottom:6px;box-shadow:none;color:var(--primary)">Bukan, pilih jenis lain</button>' +
      '<button class="btn block" data-act="cancelScan" style="box-shadow:none;color:var(--muted)">Batal</button>', cancelScan);
  }
  function showTypeChoice() {
    var sub = scanPend && scanPend.result ? 'Pilih jenis yang sesuai dengan gambar Anda.' : 'Sistem belum yakin jenis struk ini. Pilih yang sesuai.';
    openLayer('sheet', '<h3 style="font-size:18px;font-weight:800;margin-bottom:4px">Pilih jenis struk</h3><p style="font-size:13px;color:var(--muted);margin-bottom:14px">' + sub + '</p>' +
      ['trf', 'pln', 'tagihan'].map(function (t) {
        var T = TYPE[t];
        return '<button class="opt ' + (scanPend && scanPend.detected === t ? 'sg' : '') + '" data-act="chooseType" data-t="' + t + '"><span class="ti ' + T.tone + '">' + T.icon + '</span><span class="m"><b>' + T.name.replace('Struk ', '') + '</b><span>' + TYPE_DESC[t] + '</span></span>' + (scanPend && scanPend.detected === t ? '<i>Saran</i>' : '') + '</button>';
      }).join('') + '<button class="btn block" data-act="cancelScan" style="box-shadow:none;color:var(--muted)">Batal</button>', cancelScan);
  }
  async function chooseType(t) {
    var p = scanPend; if (!p) return;
    if (p.result && p.result.tipe_struk === t) { closeOverlay(); scanPend = null; openFromOcr(p.result, t); return; }
    if (!p.session) { closeOverlay(); scanPend = null; infoBox('Sesi berakhir', 'Silakan pilih ulang gambar struk Anda.'); return; }
    var ac = new AbortController(); scanAbort = ac;
    showLoading('Memproses ulang...', 'Membaca data sebagai ' + TYPE[t].name.replace('Struk ', ''));
    try {
      var data = await OCR.run(S, { device_id: S.device_id, ocr_session: p.session, scan_type: t }, ac.signal);
      if (scanAbort !== ac) return;
      scanAbort = null; scanPend = null; closeOverlay();
      if (data.status === 'error') infoBox('Gagal', data.message || 'Gagal memproses struk.'); else openFromOcr(data, t);
    } catch (e) {
      if (scanAbort !== ac) return;
      scanAbort = null; scanPend = null; closeOverlay();
      if (e.name !== 'AbortError') infoBox('Scan gagal', e.message || 'Terjadi kesalahan.');
    }
  }
  function openFromOcr(raw, type) {
    var d = newItem(type);
    var pick = function () {
      for (var i = 0; i < arguments.length; i++) { var v = raw[arguments[i]]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; }
      return '';
    };
    var digits = function (v) { return parseInt(String(v).replace(/\D/g, ''), 10) || 0; };
    if (type === 'trf') {
      d.r_name = pick('r_name', 'name', 'nama'); d.r_bank = pick('r_bank', 'bank'); d.r_num = pick('r_num', 'num', 'rek');
      var sn = pick('s_name', 'pengirim');
      if (sn) { d.s_name = sn; d.s_bank = pick('s_bank'); d.s_num = pick('s_num') || '-'; }
    } else if (type === 'pln') {
      d.id_pel = pick('id_pel') || '-'; d.no_meter = pick('no_meter') || '-'; d.nama = pick('nama') || '-';
      d.tarif_daya = pick('tarif_daya') || '-'; d.kwh = pick('kwh') || '-'; d.token = String(pick('token')).replace(/\D/g, '');
    } else {
      d.layanan = pick('layanan') || '-'; d.no_pel = pick('no_pel') || '-'; d.nama = pick('nama') || '-'; d.periode = pick('periode') || '-';
      d.denda = digits(pick('denda'));
    }
    d.ref = String(pick('ref', 'referensi') || d.ref);
    d.date = String(pick('date') || d.date);
    d.amount = digits(pick('amount', 'amt', 'nominal'));
    d.catatan = String(pick('catatan'));
    d.admin = digits(pick('admin')) || Store.calcAdmin(S, d.amount);
    if (!Store.upsert(d)) toast('Gagal menyimpan: penyimpanan perangkat penuh');
    go('#/edit/' + d.id);
    toast('Periksa hasil scan, ketuk ikon pensil untuk memperbaiki');
  }
  async function handleShared() {
    history.replaceState(null, '', '#/');
    try {
      var c = await caches.open('share-inbox'), key = new URL('shared-image', document.baseURI).href;
      var r = await c.match(key);
      if (!r) { toast('Tidak ada gambar yang dibagikan'); return; }
      var blob = await r.blob(); await c.delete(key);
      runScan(blob, 'auto');
    } catch (e) { toast('Gagal membaca gambar yang dibagikan'); }
  }

  /* ---------- Printer ---------- */
  function viewPrinter() {
    var draw = function () {
      var ok = Printer.connected(), sup = Printer.supported();
      app.innerHTML = topbar('Printer') + '<div class="page">' +
        '<div class="card"><h3>Status</h3><p style="font-size:15px;font-weight:800;margin-bottom:4px">' + esc(Printer.name() || S.printer_name || 'Belum dipilih') + '</p>' +
        '<p style="font-size:13px;font-weight:600"><span class="dot ' + (ok ? 'ok' : '') + '"></span>' + (ok ? 'Terhubung' : 'Terputus') + '</p></div>' +
        (sup ? '<button class="btn primary block" data-act="pickPrinter" style="margin-bottom:10px">' + (ok ? 'Ganti printer' : 'Pilih &amp; hubungkan printer') + '</button>' +
          (ok ? '<div class="row-btns" style="margin:0 0 10px"><button class="btn ghost" data-act="testPrint">Test print</button><button class="btn danger" data-act="discPrinter">Putuskan</button></div>' : '')
          : '<div class="note" style="background:#FEF2F2;border-color:#FECACA">Browser ini tidak mendukung Web Bluetooth. Pakai Chrome di Android. Anda tetap bisa memakai tombol Bagikan.</div>') +
        '<div class="note"><b>Penting:</b> PWA hanya bisa terhubung ke printer thermal <b>Bluetooth LE (BLE)</b>. Printer Bluetooth klasik (SPP) tidak muncul di daftar. Jika printer Anda tidak terdeteksi, gunakan tombol <b>Bagikan</b> lalu kirim gambar struk ke aplikasi cetak (mis. RawBT).<br><br>Tidak perlu pairing lewat pengaturan HP; cukup nyalakan printer lalu pilih dari daftar.</div></div>' + navHtml('printer');
    };
    printerHook = draw; draw();
  }

  /* ---------- Setelan ---------- */
  function sw(k, label) { return '<label class="sw"><span>' + label + '</span><input type="checkbox" data-s="' + k + '"' + (S[k] ? ' checked' : '') + '></label>'; }
  function viewSettings() {
    var y = window.scrollY;
    var rules = S.admin_rules.slice().sort(function (a, b) { return a.min - b.min; });
    app.innerHTML = topbar('Setelan') + '<div class="page">' +
      '<div class="card"><h3>Struk &amp; logo</h3>' +
      '<div class="logo-box">' + (S.logo ? '<img src="' + S.logo + '" alt="Logo">' : 'Tidak ada logo') + '</div>' +
      '<div class="fg"><label>Ukuran logo <b id="lp" style="color:var(--primary)">' + S.logo_width + '%</b></label><input type="range" min="20" max="100" value="' + S.logo_width + '" data-s="logo_width"></div>' +
      '<div class="cols" style="margin-bottom:14px"><button class="btn dashed" data-act="pickLogo">Ganti logo</button><button class="btn danger" data-act="rmLogo" style="padding:11px;font-size:13px">Hapus</button></div>' +
      '<div class="fg"><label>Nama usaha / toko</label><input class="fi" data-s="name" value="' + esc(S.name) + '" placeholder="TRFBT CELL"></div>' +
      sw('store_big', 'Nama toko ukuran besar') +
      '<div class="fg" style="margin-top:8px"><label>Alamat / kontak</label><input class="fi" data-s="address" value="' + esc(S.address) + '" placeholder="Jl. Mawar No. 12"></div>' +
      '<div class="fg"><label>Pesan footer</label><input class="fi" data-s="footer" value="' + esc(S.footer) + '" placeholder="Terima kasih"></div>' +
      sw('cut_ref', 'Referensi hanya 8 digit terakhir') + '</div>' +

      '<div class="card"><h3>Biaya admin</h3>' + sw('show_admin_fee', 'Tampilkan biaya admin di struk') +
      '<div class="fg" style="margin-top:8px"><label>Tipe</label><select class="fi" data-s="admin_type"><option value="fixed"' + (S.admin_type === 'fixed' ? ' selected' : '') + '>Tetap (satu harga)</option><option value="tiered"' + (S.admin_type === 'tiered' ? ' selected' : '') + '>Bertingkat (sesuai nominal)</option></select></div>' +
      (S.admin_type === 'fixed'
        ? '<div class="fg"><label>Biaya admin default (Rp)</label><input class="fi" data-s="admin" data-t="num" inputmode="numeric" value="' + (S.admin ? fmt(S.admin) : '') + '" placeholder="2.500"></div>'
        : '<div class="fg"><label>Aturan rentang nominal</label>' + (rules.length ? rules.map(function (r) {
          return '<div class="mini"><div class="m"><b>Rp ' + fmt(r.min) + ' - ' + (r.max == null ? 'ke atas' : 'Rp ' + fmt(r.max)) + '</b><span>Admin Rp ' + fmt(r.fee) + '</span></div><button class="del" data-act="delRule" data-i="' + S.admin_rules.indexOf(r) + '" aria-label="Hapus aturan">' + ICON.x + '</button></div>';
        }).join('') : '<div class="empty" style="padding:8px">Belum ada aturan</div>') + '<button class="btn dashed block" data-act="addRule">' + ICON.plus + ' Tambah aturan</button></div>') + '</div>' +

      '<div class="card"><h3>Pengirim (struk transfer)</h3>' + sw('show_sender', 'Tampilkan data pengirim di struk') +
      '<div style="margin-top:10px">' + (S.saved_senders.length ? S.saved_senders.map(function (s, i) {
        return '<div class="mini ' + (i === S.default_sender_idx ? 'on' : '') + '"><button class="m" data-act="defSender" data-i="' + i + '" style="text-align:left"><b>' + esc(s.name) + (i === S.default_sender_idx ? ' (default)' : '') + '</b><span>' + esc(s.bank) + ' - ' + esc(s.num) + '</span></button><button class="del" data-act="delSender" data-i="' + i + '" aria-label="Hapus pengirim">' + ICON.x + '</button></div>';
      }).join('') : '<div class="empty" style="padding:8px">Belum ada pengirim tersimpan</div>') + '<button class="btn dashed block" data-act="addSender">' + ICON.plus + ' Tambah pengirim</button></div></div>' +

      '<div class="card"><h3>Mesin OCR</h3><div class="fg"><label>Pembaca gambar</label><select class="fi" data-s="ocr_mode"><option value="local"' + (S.ocr_mode === 'local' ? ' selected' : '') + '>Di perangkat (tanpa server)</option><option value="server"' + (S.ocr_mode === 'server' ? ' selected' : '') + '>Server sendiri</option></select></div>' +
      (S.ocr_mode === 'server'
        ? '<div class="fg"><label>Alamat server</label><input class="fi" data-s="ocr_url" value="' + esc(S.ocr_url) + '" autocapitalize="off" spellcheck="false"></div><div class="fg"><label>ID perangkat</label><input class="fi" data-s="device_id" value="' + esc(S.device_id) + '" autocapitalize="off" spellcheck="false"></div><p style="font-size:12px;color:var(--muted);line-height:1.5">Server harus mengizinkan CORS dari alamat situs ini.</p>'
        : '<p style="font-size:12px;color:var(--muted);line-height:1.5">Gambar dibaca langsung di HP, tidak dikirim ke mana pun. Pemakaian pertama mengunduh mesin OCR sekitar 15 MB (butuh internet), setelah itu tersimpan dan bisa offline. Hasil bisa meleset pada gambar buram, jadi selalu periksa sebelum cetak.</p>') + '</div>' +

      '<div class="card"><h3>Data &amp; cadangan</h3><p style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px">Semua data tersimpan di perangkat ini saja. Buat cadangan sebelum menghapus data browser atau ganti HP.</p>' +
      '<button class="btn ghost block" data-act="backup" style="margin-bottom:10px;box-shadow:none">Unduh cadangan (.json)</button>' +
      '<button class="btn ghost block" data-act="restore" style="margin-bottom:10px;box-shadow:none">Pulihkan dari cadangan</button>' +
      '<button class="btn danger block" data-act="delall">Hapus semua riwayat</button></div>' +
      '<p style="text-align:center;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px">TRFBT PWA V.' + VERSION + '</p></div>' + navHtml('settings');
    window.scrollTo(0, y);

    app.oninput = function (e) {
      var el = e.target;
      if (el.dataset.t === 'num') { var r = el.value.replace(/\D/g, ''); el.value = r ? fmt(r) : ''; }
      if (el.type === 'range') $('#lp').textContent = el.value + '%';
    };
    app.onchange = function (e) {
      var el = e.target, k = el.dataset.s; if (!k) return;
      var v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'range') v = parseInt(el.value, 10);
      else if (el.dataset.t === 'num') v = parseInt(el.value.replace(/\D/g, ''), 10) || 0;
      else v = el.value;
      S[k] = v; saveS();
      if (k === 'admin_type' || k === 'show_sender' || k === 'ocr_mode') viewSettings();
    };
  }

  function resizeLogo(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var w = Math.min(384, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
        if (h > 384) { h = 384; w = Math.round(im.naturalWidth * h / im.naturalHeight); }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85));
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Gambar tidak bisa dibaca')); };
      im.src = url;
    });
  }

  /* ---------- aksi (event delegation) ---------- */
  var actions = {
    go: function (el) { go(el.dataset.to); },
    closeOverlay: closeOverlay,
    scan: function (el) { scanType = el.dataset.type; $('#fileScan').click(); },
    cancelScan: cancelScan,
    autoYes: function () { var p = scanPend; closeOverlay(); scanPend = null; if (p && p.result) openFromOcr(p.result, TYPE[p.detected] ? p.detected : 'trf'); },
    typeChoice: function () { showTypeChoice(); },
    chooseType: function (el) { chooseType(el.dataset.t); },
    shareHelp: function () {
      infoBox('Panduan upload & share', 'Cara 1: ketuk tombol Scan, lalu pilih bukti transfer dari galeri. Cara 2 (setelah aplikasi terpasang): di aplikasi bank pilih Bagikan, lalu pilih TRFBT. Jika aplikasi bank memblokir fitur bagikan, screenshot dulu bukti transfernya lalu pilih dari galeri.');
    },
    back: back,
    new: function (el) { go('#/new/' + el.dataset.type); },
    open: function (el) { go('#/edit/' + el.dataset.id); },
    install: function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () { deferredInstall = null; route(); });
    },
    del: function (el) {
      confirmBox('Hapus struk?', 'Struk ini akan dihapus dari riwayat.', 'Hapus').then(function (ok) {
        if (ok) { Store.remove(el.dataset.id); toast('Struk dihapus'); route(); }
      });
    },
    delall: function () {
      if (!Store.getHistory().length) { toast('Riwayat sudah kosong'); return; }
      confirmBox('Hapus semua riwayat?', 'Seluruh riwayat struk dihapus permanen. Setelan tetap aman.', 'Hapus semua').then(function (ok) {
        if (ok) { Store.clearHistory(); toast('Riwayat dihapus'); route(); }
      });
    },
    tpl: function (el) {
      tpl = parseInt(el.dataset.n, 10); Store.setTemplate(cur.tipe, tpl);
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('on', b === el); });
      renderPreview();
    },
    form: function () { openForm(); },
    closeForm: function () { closeOverlay(); persist(); renderPreview(); },
    print: function (el) { doPrint(el); },
    share: doShare,
    pickPrinter: function () { Printer.pick().then(function (n) { S.printer_name = n; saveS(true); toast('Printer terhubung'); }).catch(function (e) { toast(e.message || 'Gagal menghubungkan'); }); },
    discPrinter: function () { Printer.disconnect(); },
    testPrint: function () {
      var rb = new ReceiptEngine.Builder();
      rb.center('TEST PRINT OK', { bold: true, size: 1 }).center('KONEKSI BERHASIL').sep('-').center(S.name || 'TRFBT');
      Printer.print(rb.toEscPos()).then(function () { toast('Test print terkirim'); }).catch(function (e) { toast(e.message || 'Gagal mencetak'); });
    },
    pickLogo: function () { $('#fileLogo').click(); },
    rmLogo: function () { S.logo = ''; saveS(); viewSettings(); },
    addRule: function () {
      formDialog({
        title: 'Aturan admin baru', desc: 'Tentukan rentang nominal dan biayanya. Kosongkan maksimal jika tanpa batas.',
        fields: [{ id: 'min', label: 'Minimal (Rp)', num: 1, ph: '0' }, { id: 'max', label: 'Maksimal (Rp)', num: 1, ph: 'Tanpa batas' }, { id: 'fee', label: 'Biaya admin (Rp)', num: 1, ph: '2.500' }],
        onOk: function (v) {
          var min = v.min || 0;
          if (v.max !== null && min >= v.max) return 'Minimal harus lebih kecil dari maksimal';
          S.admin_rules.push({ min: min, max: v.max, fee: v.fee || 0 });
          if (saveS()) viewSettings();
        }
      });
    },
    delRule: function (el) { S.admin_rules.splice(parseInt(el.dataset.i, 10), 1); saveS(); viewSettings(); },
    addSender: function () {
      formDialog({
        title: 'Pengirim baru', fields: [{ id: 'name', label: 'Nama pengirim' }, { id: 'bank', label: 'Bank pengirim', ph: 'BCA / BRI / DANA' }, { id: 'num', label: 'Nomor rekening (opsional)' }],
        onOk: function (v) {
          if (!v.name || !v.bank) return 'Nama dan bank wajib diisi';
          S.saved_senders.push({ name: v.name, bank: v.bank, num: v.num || '-' });
          if (S.saved_senders.length === 1) S.default_sender_idx = 0;
          if (saveS()) viewSettings();
        }
      });
    },
    defSender: function (el) { S.default_sender_idx = parseInt(el.dataset.i, 10); saveS(); viewSettings(); },
    delSender: function (el) {
      var i = parseInt(el.dataset.i, 10);
      S.saved_senders.splice(i, 1);
      if (S.default_sender_idx === i) S.default_sender_idx = -1; else if (S.default_sender_idx > i) S.default_sender_idx--;
      saveS(); viewSettings();
    },
    backup: function () {
      var d = new Date(), p = function (x) { return ('0' + x).slice(-2); };
      download(new Blob([JSON.stringify(Store.exportAll())], { type: 'application/json' }), 'trfbt-backup-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json');
      toast('Cadangan diunduh');
    },
    restore: function () { $('#fileBackup').click(); }
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e);
  });

  $('#fileScan').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (f) runScan(f, scanType);
  });
  $('#fileLogo').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    resizeLogo(f).then(function (data) { S.logo = data; if (saveS()) viewSettings(); }).catch(function (err) { toast(err.message); });
  });
  $('#fileBackup').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    f.text().then(function (txt) {
      var obj = JSON.parse(txt);
      return confirmBox('Pulihkan cadangan?', 'Setelan dan riwayat saat ini akan diganti dengan isi file cadangan.', 'Pulihkan').then(function (ok) {
        if (!ok) return;
        Store.importAll(obj); S = Store.getSettings(); toast('Cadangan dipulihkan'); go('#/');
      });
    }).catch(function (err) { toast(err.message && err.name !== 'SyntaxError' ? err.message : 'File cadangan tidak valid'); });
  });

  /* ---------- PWA ---------- */
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (!location.hash || location.hash === '#/') route(); });
  window.addEventListener('appinstalled', function () { deferredInstall = null; });
  Printer.onChange(function () { if (printerHook) printerHook(); });
  window.addEventListener('hashchange', route);

  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) toast('Versi baru siap. Ketuk untuk memuat ulang', function () { location.reload(); });
    });
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  if (!S.device_id) {
    S.device_id = 'PWA-' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase();
    saveS(true);
  }
  route();
})();
