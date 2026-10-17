/* Penyimpanan lokal (localStorage) - tanpa server */
(function (g) {
  'use strict';
  var K_S = 'trfbt.settings.v1', K_H = 'trfbt.history.v1', K_T = 'trfbt.tpl.';
  var MAX_HISTORY = 50;
  var DEFAULTS = {
    logo: '', logo_width: 100, name: 'TRFBT CELL', store_big: false, address: '', footer: 'TERIMA KASIH',
    admin: 0, admin_type: 'fixed', admin_rules: [], show_admin_fee: true, cut_ref: false,
    show_sender: false, saved_senders: [], default_sender_idx: -1, printer_name: '',
    ocr_mode: 'local', ocr_url: 'https://trfbt.net/ocr_v4.php', device_id: ''
  };

  function read(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function sanitizeSettings(s) {
    s = (s && typeof s === 'object') ? s : {};
    var out = Object.assign({}, DEFAULTS, s);
    out.logo_width = Math.min(100, Math.max(20, parseInt(out.logo_width, 10) || 100));
    out.admin = parseInt(out.admin, 10) || 0;
    out.admin_type = out.admin_type === 'tiered' ? 'tiered' : 'fixed';
    out.admin_rules = Array.isArray(out.admin_rules) ? out.admin_rules.filter(function (r) { return r && typeof r.min === 'number' && typeof r.fee === 'number'; }) : [];
    out.saved_senders = Array.isArray(out.saved_senders) ? out.saved_senders : [];
    out.default_sender_idx = parseInt(out.default_sender_idx, 10);
    if (isNaN(out.default_sender_idx) || out.default_sender_idx >= out.saved_senders.length) out.default_sender_idx = -1;
    out.show_admin_fee = out.show_admin_fee !== false;
    out.show_sender = out.show_sender === true;
    out.cut_ref = out.cut_ref === true;
    out.store_big = out.store_big === true;
    out.ocr_mode = out.ocr_mode === 'server' ? 'server' : 'local';
    out.ocr_url = String(out.ocr_url || '').trim() || DEFAULTS.ocr_url;
    out.device_id = String(out.device_id || '').trim();
    return out;
  }

  function calcAdmin(s, amount) {
    amount = parseInt(amount, 10) || 0;
    if (s.admin_type === 'tiered') {
      var fee = 0;
      (s.admin_rules || []).forEach(function (r) {
        if (amount >= r.min && (r.max === null || r.max === undefined || amount <= r.max)) fee = r.fee;
      });
      return parseInt(fee, 10) || 0;
    }
    return parseInt(s.admin, 10) || 0;
  }

  g.Store = {
    getSettings: function () { return sanitizeSettings(read(K_S, {})); },
    saveSettings: function (s) { return write(K_S, sanitizeSettings(s)); },
    sanitizeSettings: sanitizeSettings,
    calcAdmin: calcAdmin,
    getHistory: function () { var h = read(K_H, []); return Array.isArray(h) ? h : []; },
    saveHistory: function (h) { return write(K_H, h.slice(0, MAX_HISTORY)); },
    upsert: function (item) {
      var h = this.getHistory(), i = h.findIndex(function (x) { return x.id === item.id; });
      if (i >= 0) h[i] = item; else h.unshift(item);
      return this.saveHistory(h);
    },
    remove: function (id) { return this.saveHistory(this.getHistory().filter(function (x) { return x.id !== id; })); },
    clearHistory: function () { return this.saveHistory([]); },
    getTemplate: function (type) { var n = parseInt(localStorage.getItem(K_T + type), 10); return n >= 1 && n <= 3 ? n : 1; },
    setTemplate: function (type, n) { try { localStorage.setItem(K_T + type, n); } catch (e) {} },
    exportAll: function () { return { app: 'trfbt-pwa', version: 1, settings: this.getSettings(), history: this.getHistory() }; },
    importAll: function (obj) {
      if (!obj || typeof obj !== 'object' || (!obj.settings && !obj.history)) throw new Error('Format file cadangan tidak dikenali');
      if (obj.settings) write(K_S, sanitizeSettings(obj.settings));
      if (Array.isArray(obj.history)) write(K_H, obj.history.filter(function (x) { return x && x.id && x.tipe; }).slice(0, MAX_HISTORY));
    }
  };
})(window);
