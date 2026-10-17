/* Template struk: transfer (trf), token PLN (pln), tagihan */
(function (g) {
  'use strict';
  var R = g.ReceiptEngine;
  function num(v) { return parseInt(v, 10) || 0; }
  function has(v) { var t = String(v == null ? '' : v).trim(); return t !== '' && t !== '-'; }
  function showAdmin(S) { return S.show_admin_fee !== false; }
  function total(d, S) { return num(d.amount) + num(d.denda) + (showAdmin(S) ? num(d.admin) : 0); }
  function refOf(d, S) { var r = String(d.ref || '-'); return (S.cut_ref && r.length > 8) ? r.slice(-8) : r; }
  function dateParts(d) { var s = String(d.date || ''); var p = s.split(' '); return { all: s, day: p[0] || s, time: p[1] || '' }; }

  function header(rb, S) {
    rb.center(S.name || 'TRFBT CELL', { bold: true, size: S.store_big ? 1 : 0 });
    if (S.address) rb.center(S.address);
  }
  function footer(rb, S) {
    rb.feed(1); rb.sep('-');
    rb.center('** TRANSAKSI BERHASIL **', { bold: true });
    rb.center('SALINAN - TRFBT');
    rb.center(S.footer || 'TERIMA KASIH', { bold: true });
  }
  function adminLine(rb, d, S) { if (showAdmin(S)) rb.money('ADMIN', d.admin); }
  function dateRows(rb, dt) { rb.lr('TANGGAL', dt.day); if (dt.time) rb.lr('WAKTU', dt.time); }

  function buildTrf(d, S, t) {
    var rb = new R.Builder(), dt = dateParts(d), tot = R.formatRupiah(total(d, S)), ref = refOf(d, S);
    var snd = S.show_sender && (has(d.s_name) || has(d.s_bank));
    header(rb, S);
    if (t === 1) {
      rb.sep('='); dateRows(rb, dt); rb.sep('-');
      rb.center('KODE REFERENSI'); rb.center(ref, { bold: true }); rb.sep('-');
      if (snd) {
        rb.center('DATA PENGIRIM', { bold: true });
        if (has(d.s_name)) rb.lr('NAMA', d.s_name);
        if (has(d.s_bank)) rb.lr('BANK', d.s_bank);
        if (has(d.s_num)) rb.lr('NO REKENING', d.s_num);
        rb.sep('-');
      }
      rb.center('DATA PENERIMA', { bold: true });
      rb.lr('BANK TUJUAN', d.r_bank); rb.lr('NO REKENING', d.r_num); rb.lr('PENERIMA', d.r_name);
      rb.sep('-'); rb.money('NOMINAL', d.amount); adminLine(rb, d, S);
      rb.sep('='); rb.lr('TOTAL', tot, { bold: true }); rb.sep('=');
    } else if (t === 2) {
      rb.feed(1); rb.center(dt.all); rb.feed(1);
      if (snd) {
        rb.left('PENGIRIM:');
        if (has(d.s_name)) rb.left(d.s_name, { bold: true });
        rb.left([d.s_bank, d.s_num].filter(has).join(' ')); rb.feed(1);
      }
      rb.left('PENERIMA:'); rb.left(has(d.r_name) ? d.r_name : '-', { bold: true });
      rb.left([d.r_bank, d.r_num].filter(has).join(' ')); rb.feed(1);
      rb.money('NOMINAL', d.amount); adminLine(rb, d, S);
      rb.sep('-'); rb.lr('TOTAL', tot, { bold: true });
    } else {
      rb.sep('-'); rb.lr('TGL', dt.day); rb.sep('-');
      rb.kv('TUJUAN', [d.r_bank, d.r_num].filter(has).join(' - ') || '-', { labelWidth: 8 });
      rb.kv('PENERIMA', d.r_name, { labelWidth: 8 });
      rb.money('NOMINAL', d.amount); rb.sep('-');
      rb.lr('TOTAL', tot, { bold: true }); rb.left('REF: ' + ref); rb.sep('-');
    }
    rb.note(d.catatan); footer(rb, S);
    return rb;
  }

  function buildPln(d, S, t) {
    var rb = new R.Builder(), dt = dateParts(d), tot = R.formatRupiah(total(d, S)), ref = refOf(d, S);
    var token = R.formatToken(d.token);
    header(rb, S);
    if (t === 1) {
      rb.sep('='); rb.center('STRUK PEMBELIAN TOKEN LISTRIK', { bold: true }); rb.sep('=');
      dateRows(rb, dt); rb.sep('-');
      rb.kv('ID PEL', d.id_pel); rb.kv('NO METER', d.no_meter); rb.kv('NAMA', d.nama);
      rb.kv('TARIF/DAYA', d.tarif_daya); rb.kv('JML KWH', d.kwh); rb.sep('-');
      rb.center('STROOM / TOKEN', { bold: true }); rb.center(token, { bold: true, size: 1 }); rb.sep('-');
      rb.money('NOMINAL', d.amount); adminLine(rb, d, S);
      rb.sep('='); rb.lr('TOTAL', tot, { bold: true }); rb.sep('=');
      rb.kv('REF', ref);
    } else if (t === 2) {
      rb.feed(1); rb.center('PEMBELIAN TOKEN PLN', { bold: true }); rb.center(dt.all); rb.sep('-');
      rb.kv('METER', d.no_meter, { labelWidth: 6 }); rb.kv('NAMA', d.nama, { labelWidth: 6, bold: true });
      rb.kv('TRF/DY', d.tarif_daya, { labelWidth: 6 }); rb.kv('KWH', d.kwh, { labelWidth: 6 }); rb.sep('-');
      rb.center(token, { bold: true, size: 1 }); rb.sep('-');
      rb.money('NOMINAL', d.amount); adminLine(rb, d, S);
      rb.sep('-'); rb.lr('TOTAL', tot, { bold: true }); rb.left('SN: ' + ref);
    } else {
      rb.feed(1); rb.center('TOKEN PLN', { bold: true });
      rb.center(d.nama, { bold: true }); rb.center(d.no_meter); rb.feed(1);
      rb.center(token, { bold: true, size: 1 }); rb.feed(1);
      if (has(d.kwh)) rb.center(d.kwh + ' KWH');
      rb.center(tot, { bold: true }); rb.center(dt.all); rb.center('REF ' + ref);
    }
    rb.note(d.catatan); footer(rb, S);
    return rb;
  }

  function costLines(rb, d, S) {
    rb.money('TAGIHAN', d.amount);
    if (num(d.denda) > 0) rb.money('DENDA', d.denda);
    adminLine(rb, d, S);
  }

  function buildBill(d, S, t) {
    var rb = new R.Builder(), dt = dateParts(d), tot = R.formatRupiah(total(d, S)), ref = refOf(d, S);
    header(rb, S);
    if (t === 1) {
      rb.sep('='); rb.center('STRUK PEMBAYARAN TAGIHAN', { bold: true }); rb.sep('=');
      dateRows(rb, dt); rb.sep('-');
      rb.kv('JENIS LAYANAN', d.layanan, { labelWidth: 15 }); rb.kv('NOMOR PELANGGAN', d.no_pel, { labelWidth: 15 });
      rb.kv('NAMA PELANGGAN', d.nama, { labelWidth: 15 }); rb.kv('PERIODE', d.periode, { labelWidth: 15 });
      rb.sep('-'); costLines(rb, d, S);
      rb.sep('='); rb.lr('TOTAL', tot, { bold: true }); rb.sep('=');
      rb.kv('REF', ref, { labelWidth: 15 });
    } else if (t === 2) {
      rb.feed(1); rb.center('STRUK LUNAS', { bold: true }); rb.center(dt.all); rb.sep('-');
      rb.kv('LAYANAN', d.layanan, { labelWidth: 9, bold: true }); rb.kv('NO PEL', d.no_pel, { labelWidth: 9 });
      rb.kv('NAMA', d.nama, { labelWidth: 9, bold: true }); rb.kv('PERIODE', d.periode, { labelWidth: 9 });
      rb.sep('-'); costLines(rb, d, S);
      rb.sep('-'); rb.lr('TOTAL', tot, { bold: true }); rb.left('SN: ' + ref);
    } else {
      rb.feed(1); rb.center(d.layanan, { bold: true });
      rb.center(d.nama, { bold: true }); rb.center(d.no_pel);
      if (has(d.periode)) rb.center(d.periode);
      rb.feed(1); rb.center(tot, { bold: true, size: 1 }); rb.feed(1);
      rb.center(dt.all); rb.center('REF ' + ref);
    }
    rb.note(d.catatan); footer(rb, S);
    return rb;
  }

  g.Receipts = {
    TEMPLATE_NAMES: { trf: ['Standar', 'Ringkas', 'Minimalis'], pln: ['Standar', 'Ringkas', 'Token Besar'], tagihan: ['Standar', 'Ringkas', 'Minimalis'] },
    total: total,
    build: function (d, S, t) {
      t = t >= 1 && t <= 3 ? t : 1;
      if (d.tipe === 'pln') return buildPln(d, S, t);
      if (d.tipe === 'tagihan') return buildBill(d, S, t);
      return buildTrf(d, S, t);
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.Receipts;
})(typeof window !== 'undefined' ? window : globalThis);
