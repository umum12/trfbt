/* Klien OCR: kirim gambar ke server (kontrak sama dengan ocr_v4.php versi APK) */
(function (g) {
  'use strict';
  var DEFAULT_URL = 'https://trfbt.net/ocr_v4.php';

  /* Perkecil gambar (maks 1600px) -> base64 JPEG tanpa prefix */
  function prepare(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('File bukan gambar yang valid.')); };
      im.src = url;
    });
  }

  async function request(url, payload, signal) {
    var r;
    try {
      r = await fetch(url || DEFAULT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('Gagal terhubung ke server OCR. Periksa internet, dan pastikan server mengizinkan akses dari alamat situs ini (CORS).');
    }
    try { return await r.json(); }
    catch (e) { throw new Error('Respon server OCR tidak valid (HTTP ' + r.status + ').'); }
  }

  /* ---------- OCR di perangkat (Tesseract.js, dimuat dari CDN lalu di-cache) ---------- */
  var TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var worker = null, loading = null, onLog = null, sessions = {}, sessionOrder = [];

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.Tesseract) return res();
      var s = document.createElement('script');
      s.src = src; s.crossOrigin = 'anonymous';
      s.onload = res;
      s.onerror = function () { rej(new Error('Mesin OCR belum bisa diunduh. Sambungkan internet untuk pemakaian pertama.')); };
      document.head.appendChild(s);
    });
  }
  function getWorker() {
    if (worker) return Promise.resolve(worker);
    if (!loading) {
      loading = (async function () {
        await loadScript(TESS_URL);
        var w = await Tesseract.createWorker('eng', 1, { logger: function (m) { if (onLog) onLog(m); } });
        await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        worker = w; return w;
      })().catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }
  function killWorker() { if (worker) { try { worker.terminate(); } catch (e) {} } worker = null; loading = null; }
  function remember(text) {
    var id = 'L' + Date.now().toString(36);
    sessions[id] = text; sessionOrder.push(id);
    while (sessionOrder.length > 3) delete sessions[sessionOrder.shift()];
    return id;
  }
  function build(text, type, id) {
    var r = OCRParse.parse(text, type);
    r.status = 'success'; r.tipe_struk = type; r.ocr_session = id;
    return r;
  }
  async function local(payload, signal, onStatus) {
    if (payload.ocr_session) {
      var t = sessions[payload.ocr_session];
      return t ? build(t, payload.scan_type, payload.ocr_session) : { status: 'error', message: 'Sesi berakhir. Pilih ulang gambar.' };
    }
    onLog = function (m) {
      if (!onStatus) return;
      if (m.status === 'recognizing text') onStatus('Membaca teks ' + Math.round((m.progress || 0) * 100) + '%');
      else onStatus('Menyiapkan mesin OCR (hanya sekali, perlu internet)...');
    };
    var aborted = new Promise(function (_, rej) {
      signal.addEventListener('abort', function () { killWorker(); var e = new Error('Dibatalkan'); e.name = 'AbortError'; rej(e); });
    });
    var res = await Promise.race([getWorker().then(function (w) { return w.recognize('data:image/jpeg;base64,' + payload.image_base64); }), aborted]);
    var text = (res.data && res.data.text) || '';
    if (text.replace(/\s/g, '').length < 15) return { status: 'error', message: 'Teks pada gambar tidak terbaca. Coba gambar yang lebih jelas atau isi manual.' };
    var id = remember(text);
    if (payload.scan_type === 'auto') {
      var d = OCRParse.detect(text);
      return d.confident ? build(text, d.type, id) : { status: 'need_choice', ocr_session: id, detected_type: d.type };
    }
    return build(text, payload.scan_type, id);
  }

  /* S.ocr_mode: 'local' (default) atau 'server' */
  function run(S, payload, signal, onStatus) {
    return S.ocr_mode === 'server' ? request(S.ocr_url, payload, signal) : local(payload, signal, onStatus);
  }

  g.OCR = { DEFAULT_URL: DEFAULT_URL, prepare: prepare, request: request, run: run };
})(window);
