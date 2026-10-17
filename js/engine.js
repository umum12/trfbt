/* Receipt engine: teks 32 kolom -> canvas (preview/share) & ESC/POS (printer) */
(function (g) {
  'use strict';
  var WIDTH = 32;

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clean(value, keepCase) {
    var t = value == null ? '' : String(value);
    if (t.normalize) t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
    return keepCase ? t : t.toUpperCase();
  }
  function toInt(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
    var d = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    return d ? parseInt(d, 10) : 0;
  }
  function formatRupiah(v) { return 'RP ' + toInt(v).toLocaleString('id-ID'); }
  function formatToken(v) {
    var d = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    return d ? d.replace(/(.{4})(?=.)/g, '$1 ') : '-';
  }
  function wrapText(text, width) {
    var words = String(text).split(' ').filter(function (w) { return w.length > 0; });
    var lines = [], cur = '';
    words.forEach(function (word) {
      var w = word;
      while (w.length > width) {
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!w) return;
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= width) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur || lines.length === 0) lines.push(cur);
    return lines;
  }

  function Builder(width) { this.width = width || WIDTH; this.lines = []; }

  Builder.prototype.line = function (text, o) {
    o = o || {};
    this.lines.push({ text: text, bold: !!o.bold, size: o.size === 1 ? 1 : 0 });
    return this;
  };
  Builder.prototype.feed = function (n) {
    for (var i = 0; i < (n || 1); i++) this.line('');
    return this;
  };
  Builder.prototype.sep = function (ch) { return this.line((ch || '-').repeat(this.width)); };
  Builder.prototype.center = function (text, o) {
    o = o || {};
    var self = this, w = o.size === 1 ? Math.floor(this.width / 2) : this.width;
    wrapText(clean(text), w).forEach(function (l) {
      self.line(' '.repeat(Math.max(0, Math.floor((w - l.length) / 2))) + l, o);
    });
    return this;
  };
  Builder.prototype.left = function (text, o) {
    var self = this;
    wrapText(clean(text), this.width).forEach(function (l) { self.line(l, o); });
    return this;
  };
  Builder.prototype.kv = function (label, value, o) {
    o = o || {};
    var self = this, lw = o.labelWidth || 11, k = clean(label), v = clean(value);
    if (v === '') v = '-';
    var base = Math.max(lw, k.length);
    if (base + 2 > this.width - 8) {
      this.line(k + ':', o);
      wrapText(v, this.width - 2).forEach(function (l) { self.line('  ' + l, o); });
      return this;
    }
    var prefix = k + ' '.repeat(base - k.length) + ': ';
    wrapText(v, this.width - prefix.length).forEach(function (l, i) {
      self.line((i === 0 ? prefix : ' '.repeat(prefix.length)) + l, o);
    });
    return this;
  };
  Builder.prototype.lr = function (label, value, o) {
    var self = this, k = clean(label), v = clean(value);
    if (v === '') v = '-';
    if (k.length + 1 + v.length <= this.width) {
      return this.line(k + ' '.repeat(this.width - k.length - v.length) + v, o);
    }
    this.line(k, o);
    wrapText(v, this.width).forEach(function (l) { self.line(' '.repeat(self.width - l.length) + l, o); });
    return this;
  };
  Builder.prototype.money = function (label, value, o) { return this.lr(label, formatRupiah(value), o); };
  Builder.prototype.note = function (text) {
    var v = clean(text);
    if (!v) return this;
    this.sep('-'); this.left('CATATAN:'); this.left(v);
    return this;
  };
  Builder.prototype.toText = function () {
    return this.lines.map(function (l) { return l.text.replace(/\s+$/, ''); }).join('\n');
  };

  /* ---------- Canvas (preview + gambar untuk dibagikan) ---------- */
  Builder.prototype.toCanvas = function (o) {
    o = o || {};
    var S = 2, cw = 12 * S, pad = 24, W = this.width * cw;
    var probe = document.createElement('canvas').getContext('2d');
    probe.font = '100px monospace';
    var mw = probe.measureText('M').width || 60;
    var fpx = cw / (mw / 100), lh = Math.round(fpx * 1.3);

    var logo = o.logo && o.logo.naturalWidth ? o.logo : null, logoW = 0, logoH = 0, gap = 0;
    if (logo) {
      logoW = Math.round(W * Math.min(100, Math.max(20, o.logoPct || 100)) / 100);
      logoH = Math.round(logo.naturalHeight * logoW / logo.naturalWidth);
      gap = 20;
    }
    var textH = 0;
    this.lines.forEach(function (l) { textH += lh * (l.size ? 2 : 1); });

    var c = document.createElement('canvas');
    c.width = W + pad * 2;
    c.height = pad * 2 + logoH + gap + textH;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
    var y = pad;
    if (logo) {
      x.filter = 'grayscale(1) contrast(1.4)';
      x.drawImage(logo, pad + Math.round((W - logoW) / 2), y, logoW, logoH);
      x.filter = 'none';
      y += logoH + gap;
    }
    this.lines.forEach(function (l) {
      var k = l.size ? 2 : 1;
      x.font = (l.bold ? 'bold ' : '') + (fpx * k) + 'px monospace';
      for (var i = 0; i < l.text.length; i++) {
        var ch = l.text.charAt(i);
        if (ch !== ' ') x.fillText(ch, pad + i * cw * k, y + fpx * k * 0.92);
      }
      y += lh * k;
    });
    return c;
  };

  /* ---------- ESC/POS ---------- */
  function rasterBytes(img, maxW) {
    var w = Math.max(8, Math.floor(Math.min(maxW, 384) / 8) * 8);
    var h = Math.max(1, Math.round(img.naturalHeight * w / img.naturalWidth));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, bpr = w / 8, out = [0x1B, 0x61, 1];
    for (var y0 = 0; y0 < h; y0 += 128) {
      var rows = Math.min(128, h - y0);
      out.push(0x1D, 0x76, 0x30, 0, bpr & 255, bpr >> 8, rows & 255, rows >> 8);
      for (var y = y0; y < y0 + rows; y++) {
        for (var bx = 0; bx < bpr; bx++) {
          var b = 0;
          for (var bit = 0; bit < 8; bit++) {
            var i = (y * w + bx * 8 + bit) * 4;
            var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            if (lum < 150 && d[i + 3] > 0) b |= 0x80 >> bit;
          }
          out.push(b);
        }
      }
    }
    out.push(0x1B, 0x61, 0);
    return out;
  }

  Builder.prototype.toEscPos = function (o) {
    o = o || {};
    var out = [0x1B, 0x40];
    if (o.logo && o.logo.naturalWidth) {
      out = out.concat(rasterBytes(o.logo, 384 * (o.logoPct || 100) / 100));
      out.push(0x0A);
    }
    var bold = false, size = 0;
    this.lines.forEach(function (l) {
      if (l.bold !== bold) { out.push(0x1B, 0x45, l.bold ? 1 : 0); bold = l.bold; }
      if (l.size !== size) { out.push(0x1D, 0x21, l.size ? 0x11 : 0x00); size = l.size; }
      var t = l.text.replace(/\s+$/, '');
      for (var i = 0; i < t.length; i++) out.push(t.charCodeAt(i) & 0x7F);
      out.push(0x0A);
    });
    out.push(0x1B, 0x45, 0, 0x1D, 0x21, 0, 0x0A, 0x0A, 0x0A);
    return Uint8Array.from(out);
  };

  g.ReceiptEngine = {
    WIDTH: WIDTH, Builder: Builder, clean: clean, toInt: toInt, formatRupiah: formatRupiah,
    formatToken: formatToken, wrapText: wrapText, escapeHtml: escapeHtml
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.ReceiptEngine;
})(typeof window !== 'undefined' ? window : globalThis);
