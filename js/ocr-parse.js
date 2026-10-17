/* Parser teks hasil OCR -> field struk (transfer, token PLN, tagihan). Heuristik; hasil selalu bisa diedit. */
(function (g) {
  'use strict';

  var BANKS = [
    ['BCA', 'BCA|BANK CENTRAL ASIA'], ['BRI', 'BRI|BANK RAKYAT'], ['BNI', 'BNI|BANK NEGARA'], ['MANDIRI', 'MANDIRI|LIVIN'],
    ['BSI', 'BSI|SYARIAH INDONESIA'], ['CIMB NIAGA', 'CIMB'], ['PERMATA', 'PERMATA'], ['DANAMON', 'DANAMON'], ['BTN', 'BTN'],
    ['MEGA', 'BANK MEGA'], ['OCBC', 'OCBC'], ['PANIN', 'PANIN'], ['JENIUS', 'JENIUS|BTPN'], ['SEABANK', 'SEABANK|SEA BANK'],
    ['JAGO', 'JAGO'], ['NEO COMMERCE', 'NEO COMMERCE|BANK NEO'], ['MAYBANK', 'MAYBANK'], ['BANK DKI', 'BANK DKI|DKI'],
    ['DANA', 'DANA'], ['OVO', 'OVO'], ['GOPAY', 'GOPAY|GO-PAY'], ['SHOPEEPAY', 'SHOPEEPAY|SHOPEE PAY'], ['LINKAJA', 'LINKAJA|LINK AJA'], ['ISAKU', 'ISAKU']
  ].map(function (b) { return [b[0], new RegExp('(^|[^A-Z0-9])(' + b[1] + ')([^A-Z0-9]|$)')]; });

  var MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGU: 8, AGT: 8, AUG: 8, AGS: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12 };
  var LABELISH = /^(TANGGAL|WAKTU|NOMINAL|JUMLAH|TOTAL|BIAYA|ADMIN|REF|NO\b|NOMOR|BANK|CATATAN|BERITA|STATUS|JENIS|SUMBER|PENGIRIM|PENERIMA|TUJUAN|NAMA|REKENING|PERIODE|TARIF|KWH|TOKEN|ID\b|IDPEL|HARGA|TAGIHAN|DENDA)/i;

  function lines(text) {
    return String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function digitsOf(s) { return String(s).replace(/\D/g, ''); }
  function fixDigits(s) {
    var d = (String(s).match(/\d/g) || []).length;
    return d >= String(s).replace(/\s/g, '').length * 0.6 ? String(s).replace(/[Oo]/g, '0').replace(/[lI]/g, '1') : s;
  }
  function toRp(s) {
    s = String(s).replace(/[^\d.,]/g, '');
    if (s.length > 3) s = s.replace(/[.,]\d{2}$/, '');
    return parseInt(digitsOf(s), 10) || 0;
  }
  function amountOnLine(line) {
    var m = /(?:RP|IDR)\s*[.:]?\s*(\d[\d.,]*)/i.exec(line);
    if (m) return toRp(m[1]);
    var all = line.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,}/g);
    return all ? toRp(all[all.length - 1]) : 0;
  }
  function pickAmount(L, labels) {
    for (var k = 0; k < labels.length; k++) {
      var re = new RegExp('(^|[^A-Z])(' + labels[k] + ')', 'i');
      for (var i = 0; i < L.length; i++) {
        if (!re.test(L[i])) continue;
        var v = amountOnLine(L[i]) || (L[i + 1] ? amountOnLine(L[i + 1]) : 0);
        if (v > 0) return v;
      }
    }
    for (var j = 0; j < L.length; j++) { if (/(?:RP|IDR)\s*[.:]?\s*\d/i.test(L[j])) { var a = amountOnLine(L[j]); if (a > 0) return a; } }
    return 0;
  }
  function valueAfter(L, pat) {
    var re = new RegExp('^(?:' + pat + ')\\s*[:\\-]?\\s*(.*)$', 'i');
    for (var i = 0; i < L.length; i++) {
      var m = re.exec(L[i]);
      if (!m) continue;
      var rest = m[1].trim();
      if (rest) return rest;
      if (L[i + 1] && !LABELISH.test(L[i + 1])) return L[i + 1];
    }
    return '';
  }
  function isName(s) {
    s = String(s || '').trim();
    var letters = (s.match(/[A-Za-z]/g) || []).length;
    return s.length >= 3 && s.length <= 45 && letters >= 3 && letters / s.length > 0.6 && !/(?:RP|IDR)\s*\d/i.test(s) && !bankIn(s);
  }
  function cleanName(s) {
    return String(s || '').replace(/[\]!]/g, 'I').split(/\s+[-–]\s+/)[0].replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z0-9.,' ]+$/, '').trim().toUpperCase();
  }
  function bankIn(s) {
    var u = String(s).toUpperCase();
    for (var i = 0; i < BANKS.length; i++) if (BANKS[i][1].test(u)) return BANKS[i][0];
    return '';
  }

  function parseDate(text) {
    var now = new Date(), p2 = function (n) { return ('0' + n).slice(-2); };
    var T = text.toUpperCase().replace(/[,]/g, ' ');
    var d, mo, y, hh, mm, ss, m;
    var tm = /(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/;
    if ((m = /(\d{1,2})[\s\-\/]+([A-Z]{3,9})\.?[\s\-\/]+(\d{4})/.exec(T)) && MONTHS[m[2].slice(0, 3)]) {
      d = +m[1]; mo = MONTHS[m[2].slice(0, 3)]; y = +m[3];
    } else if ((m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(T))) {
      d = +m[1]; mo = +m[2]; y = +m[3];
    } else if ((m = /(\d{4})-(\d{2})-(\d{2})/.exec(T))) {
      y = +m[1]; mo = +m[2]; d = +m[3];
    } else return '';
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return '';
    var rest = T.slice(m.index + m[0].length), t = tm.exec(rest.slice(0, 40));
    if (t && +t[1] < 24 && +t[2] < 60) { hh = +t[1]; mm = +t[2]; ss = t[3] ? +t[3] : 0; }
    else { hh = now.getHours(); mm = now.getMinutes(); ss = now.getSeconds(); }
    return p2(d) + '-' + p2(mo) + '-' + y + ' ' + p2(hh) + ':' + p2(mm) + ':' + p2(ss);
  }

  function findRef(L) {
    var v = valueAfter(L, 'NO\\.? ?REF(?:ERENSI)?|NOMOR REFERENSI|KODE REFERENSI|ID TRANSAKSI|NO\\.? ?TRANSAKSI|NOMOR TRANSAKSI|REFERENCE|REF');
    var m = /[A-Z0-9]{6,}/i.exec(v.replace(/[\s-]/g, ''));
    return m ? m[0].toUpperCase() : '';
  }

  function parseTrf(text) {
    var L = lines(text), out = {}, i;
    var rs = 0;
    for (i = 0; i < L.length; i++) if (/PENERIMA|TUJUAN|KEPADA|TRANSFER KE|^KE\b/i.test(L[i])) { rs = i; break; }
    // rekening
    var acc = '', accIdx = -1;
    for (i = 0; i < L.length && !acc; i++) {
      if (i < rs && rs > 0) continue;
      if (/REF|TRANSAKSI|KODE|WAKTU|TANGGAL|NOMINAL|SALDO|(?:RP|IDR)\s*\d/i.test(L[i]) && !/REKENING|TUJUAN|PENERIMA/i.test(L[i])) continue;
      var m = /(?:\d[ -]?){8,16}/.exec(fixDigits(L[i]));
      if (m) { var dg = digitsOf(m[0]); if (dg.length >= 8 && dg.length <= 16) { acc = dg; accIdx = i; } }
    }
    out.r_num = acc;
    // nama penerima
    var name = cleanName(valueAfter(L, 'NAMA PENERIMA|NAMA TUJUAN|NAMA REKENING|PENERIMA|KEPADA|TRANSFER KE'));
    if (!isName(name) || /^\d/.test(name)) {
      name = '';
      if (accIdx >= 0) {
        var order = [accIdx - 1, accIdx + 1, accIdx - 2, accIdx + 2];
        for (var k = 0; k < order.length && !name; k++) {
          var c = L[order[k]];
          if (c && !LABELISH.test(c) && isName(cleanName(c))) name = cleanName(c);
        }
      }
    }
    out.r_name = name;
    // bank
    var bank = bankIn(valueAfter(L, 'BANK TUJUAN|BANK PENERIMA|BANK'));
    if (!bank) {
      var from = Math.max(0, (accIdx >= 0 ? accIdx : rs) - 2), to = Math.min(L.length, (accIdx >= 0 ? accIdx : rs) + 3);
      for (i = from; i < to && !bank; i++) bank = bankIn(L[i]);
    }
    if (!bank) for (i = rs; i < L.length && !bank; i++) if (!/PENGIRIM|SUMBER|DARI/i.test(L[i])) bank = bankIn(L[i]);
    out.r_bank = bank;
    // pengirim
    var sn = cleanName(valueAfter(L, 'NAMA PENGIRIM|PENGIRIM|SUMBER DANA|DARI'));
    if (isName(sn)) out.s_name = sn;
    out.ref = findRef(L);
    out.date = parseDate(text);
    out.amount = pickAmount(L, ['NOMINAL', 'JUMLAH TRANSFER', 'JUMLAH', 'AMOUNT', 'TOTAL TRANSFER', 'TOTAL']);
    out.catatan = valueAfter(L, 'CATATAN|BERITA|PESAN|KETERANGAN|NOTES').slice(0, 40);
    return out;
  }

  function parsePln(text) {
    var L = lines(text), out = {}, i, m;
    var token = '';
    for (i = 0; i < L.length && !token; i++) {
      m = /\d{4}(?:[ -]\d{4}){4}/.exec(fixDigits(L[i]));
      if (m) token = digitsOf(m[0]);
    }
    if (!token) for (i = 0; i < L.length && !token; i++) { var dg = digitsOf(fixDigits(L[i])); if (dg.length === 20) token = dg; }
    out.token = token;
    var meter = digitsOf(fixDigits(valueAfter(L, 'NO\\.? ?METER|NOMOR METER|NO\\.? ?MTR|METER')));
    out.no_meter = /^\d{9,13}$/.test(meter) ? meter : '';
    var idp = digitsOf(fixDigits(valueAfter(L, 'ID ?PEL(?:ANGGAN)?|IDPEL|NO\\.? ?PELANGGAN|NOMOR PELANGGAN')));
    out.id_pel = /^\d{9,14}$/.test(idp) ? idp : '';
    out.nama = cleanName(valueAfter(L, 'NAMA PELANGGAN|NAMA'));
    out.tarif_daya = valueAfter(L, 'TARIF ?\\/ ?DAYA|TARIF|DAYA').toUpperCase().replace(/\s+/g, '');
    var kwh = /\d+[.,]?\d*/.exec(valueAfter(L, 'JML ?KWH|JUMLAH ?KWH|KWH|TOTAL ?KWH'));
    out.kwh = kwh ? kwh[0].replace(',', '.') : '';
    out.ref = findRef(L);
    out.date = parseDate(text);
    out.amount = pickAmount(L, ['NOMINAL', 'RP STROOM|RP TOKEN|RP STR', 'HARGA', 'RP BAYAR|TOTAL BAYAR|TOTAL', 'JUMLAH']);
    return out;
  }

  var SERVICES = [
    [/PDAM|PERUMDA AIR|AIR MINUM/, 'PDAM'], [/BPJS ?KETENAGA|BPJSTK/, 'BPJS KETENAGAKERJAAN'], [/BPJS/, 'BPJS KESEHATAN'],
    [/INDIHOME|TELKOM/, 'TELKOM / INDIHOME'], [/PGN|GAS RUMAH/, 'PGN / GAS'], [/PASCABAYAR|TAGIHAN LISTRIK|PLN/, 'PLN PASCABAYAR'],
    [/FIF|ADIRA|WOM FINANCE|BAF|MEGA FINANCE|ANGSURAN|CICILAN/, 'ANGSURAN'], [/KREDIVO|AKULAKU|SPAYLATER|PAYLATER|HOME CREDIT/, 'PAYLATER'],
    [/KARTU KREDIT/, 'KARTU KREDIT'], [/ASURANSI|PREMI/, 'ASURANSI'], [/SAMSAT|PKB/, 'PAJAK KENDARAAN'], [/PBB/, 'PBB'],
    [/PAKET DATA|PULSA/, 'PULSA / DATA'], [/TOP ?UP|SALDO|E-?MONEY|E-?TOLL/, 'TOP UP SALDO'], [/BIZNET|FIRST MEDIA|MYREPUBLIC|ICONNET|INTERNET/, 'INTERNET'],
    [/TRANSVISION|K-?VISION|MNC VISION|TV KABEL/, 'TV KABEL'], [/ZAKAT|INFAQ|DONASI/, 'ZAKAT / DONASI'], [/SPP|SEKOLAH|UKT|KULIAH/, 'PENDIDIKAN']
  ];

  function parseBill(text) {
    var L = lines(text), out = {}, U = text.toUpperCase(), i;
    out.layanan = '';
    for (i = 0; i < SERVICES.length; i++) if (SERVICES[i][0].test(U)) { out.layanan = SERVICES[i][1]; break; }
    if (!out.layanan) out.layanan = valueAfter(L, 'JENIS LAYANAN|LAYANAN|PRODUK|JENIS TAGIHAN').toUpperCase().slice(0, 30);
    var np = valueAfter(L, 'NO\\.? ?PELANGGAN|NOMOR PELANGGAN|ID ?PEL(?:ANGGAN)?|NO\\.? ?PEL|NO\\.? ?VA|NOMOR VA|NO\\.? ?KONTRAK|NOMOR KONTRAK|NO\\.? ?HP|NO\\.? ?TUJUAN|NOMOR TUJUAN|NOP|NO\\.? ?POLIS');
    out.no_pel = fixDigits(np).replace(/\s+/g, '').toUpperCase();
    out.nama = cleanName(valueAfter(L, 'NAMA PELANGGAN|NAMA PESERTA|NAMA'));
    out.periode = valueAfter(L, 'PERIODE|BL\\/TH|BLN\\/THN|BULAN|MASA').toUpperCase().slice(0, 24);
    var denda = pickAmount(L.filter(function (l) { return /DENDA/i.test(l); }), ['DENDA']);
    out.denda = /DENDA/i.test(text) ? denda : 0;
    out.ref = findRef(L);
    out.date = parseDate(text);
    out.amount = pickAmount(L, ['TOTAL TAGIHAN|JUMLAH TAGIHAN', 'TAGIHAN', 'TOTAL BAYAR|TOTAL PEMBAYARAN', 'HARGA|NOMINAL', 'TOTAL', 'JUMLAH']);
    return out;
  }

  function detect(text) {
    var U = text.toUpperCase(), L = lines(text);
    var hasToken = false;
    L.forEach(function (l) { if (/\d{4}(?:[ -]\d{4}){4}/.test(fixDigits(l))) hasToken = true; });
    var s = { pln: 0, trf: 0, tagihan: 0 };
    if (hasToken) s.pln += 3;
    if (/TOKEN|STROOM|KWH|PRABAYAR/.test(U)) s.pln += 2;
    if (/NO\.? ?METER|NOMOR METER/.test(U)) s.pln += 1;
    if (/TRANSFER|PENERIMA|REKENING TUJUAN|BANK TUJUAN|BI-?FAST|ANTAR ?BANK|SESAMA BANK|KIRIM UANG/.test(U)) s.trf += 2;
    if (/PENGIRIM|SUMBER DANA|BERITA TRANSFER/.test(U)) s.trf += 1;
    if (/TAGIHAN|PELANGGAN|PDAM|BPJS|ANGSURAN|PERIODE|PPOB|DENDA|PEMBAYARAN/.test(U)) s.tagihan += 2;
    if (/NO\.? ?(?:PEL|VA|KONTRAK)|NAMA PELANGGAN/.test(U)) s.tagihan += 1;
    var order = ['pln', 'trf', 'tagihan'].sort(function (a, b) { return s[b] - s[a]; });
    var best = order[0], lead = s[best] - s[order[1]];
    return { type: s[best] > 0 ? best : 'trf', confident: (hasToken && s.pln >= 3 && lead >= 1) || (s[best] >= 2 && lead >= 2), scores: s };
  }

  function parse(text, type) {
    var r = type === 'pln' ? parsePln(text) : type === 'tagihan' ? parseBill(text) : parseTrf(text);
    Object.keys(r).forEach(function (k) { if (r[k] === '' || r[k] === undefined) delete r[k]; });
    return r;
  }

  g.OCRParse = { detect: detect, parse: parse, parseDate: parseDate, lines: lines };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.OCRParse;
})(typeof window !== 'undefined' ? window : globalThis);
