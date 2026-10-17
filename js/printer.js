/* Printer thermal via Web Bluetooth (BLE) */
(function (g) {
  'use strict';
  var SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ae30-0000-1000-8000-00805f9b34fb'
  ];
  var device = null, chr = null, listeners = [];

  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function onDisc() { chr = null; emit(); }

  async function open() {
    var server = await device.gatt.connect();
    var services = await server.getPrimaryServices();
    chr = null;
    for (var i = 0; i < services.length && !chr; i++) {
      var cs = await services[i].getCharacteristics();
      for (var j = 0; j < cs.length; j++) {
        if (cs[j].properties.write || cs[j].properties.writeWithoutResponse) { chr = cs[j]; break; }
      }
    }
    if (!chr) { try { device.gatt.disconnect(); } catch (e) {} throw new Error('Printer ini tidak menyediakan jalur cetak BLE yang dikenali.'); }
    device.removeEventListener('gattserverdisconnected', onDisc);
    device.addEventListener('gattserverdisconnected', onDisc);
    emit();
  }

  async function pick() {
    if (!navigator.bluetooth) throw new Error('Browser ini belum mendukung Web Bluetooth. Gunakan Chrome di Android.');
    try {
      device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
    } catch (e) {
      if (e && e.name === 'NotFoundError') throw new Error('Pemilihan printer dibatalkan.');
      throw e;
    }
    await open();
    return device.name || 'Printer';
  }

  async function ensure() {
    if (chr && device && device.gatt.connected) return;
    if (device) { try { await open(); return; } catch (e) { /* pilih ulang */ } }
    await pick();
  }

  async function sendChunk(part, noResp) {
    if (noResp) await chr.writeValueWithoutResponse(part); else await chr.writeValue(part);
  }

  async function write(bytes) {
    await ensure();
    var noResp = !!chr.properties.writeWithoutResponse, size = 100;
    for (var i = 0; i < bytes.length; i += size) {
      var part = bytes.slice(i, i + size);
      try {
        await sendChunk(part, noResp);
      } catch (e) {
        size = 20; // fallback untuk MTU kecil
        for (var k = 0; k < part.length; k += 20) { await sendChunk(part.slice(k, k + 20), noResp); await sleep(25); }
      }
      await sleep(25);
    }
  }

  g.Printer = {
    supported: function () { return !!navigator.bluetooth; },
    connected: function () { return !!(chr && device && device.gatt.connected); },
    name: function () { return device ? (device.name || 'Printer') : ''; },
    pick: pick,
    print: write,
    disconnect: function () { if (device && device.gatt.connected) device.gatt.disconnect(); chr = null; device = null; emit(); },
    onChange: function (f) { listeners.push(f); }
  };
})(window);
