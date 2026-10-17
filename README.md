# TRFBT PWA

Aplikasi PWA untuk membuat dan mencetak struk **transfer**, **token listrik (PLN)**, dan **tagihan**.
Semua data tersimpan lokal di perangkat (localStorage). Tanpa server, tanpa login.

## Struktur
```
index.html            shell aplikasi
manifest.webmanifest  manifest PWA
sw.js                 service worker (cache offline)
css/app.css
js/engine.js          mesin struk (preview canvas + ESC/POS)
js/receipts.js        template struk
js/store.js           penyimpanan lokal, backup/restore
js/printer.js         printer Bluetooth LE (Web Bluetooth)
js/ocr.js             mesin OCR (Tesseract.js di perangkat / server opsional)
js/ocr-parse.js       parser teks OCR -> field struk
js/app.js             UI & routing (hash: #/history, #/settings, ...)
icons/                ikon 192, 512, maskable
.nojekyll
```

## Deploy ke GitHub Pages
1. Buat repository (mis. `trfbt`), upload **isi** folder ini ke root branch `main`.
2. Settings > Pages > Source: *Deploy from a branch* > `main` / `(root)` > Save.
3. Buka `https://USERNAME.github.io/trfbt/` di Chrome Android.
4. Menu Chrome > *Instal aplikasi* (atau tombol "Pasang aplikasi" di beranda).

Semua path relatif, jadi otomatis kompatibel dengan subpath `/NAMA-REPO/`. Tidak ada yang perlu diubah.

## Update versi
Ubah `VERSION` di `sw.js` (mis. `v1.0.1`) setiap kali ada perubahan file, lalu commit.
Pengguna akan melihat notifikasi "Versi baru siap" dan tinggal ketuk untuk memuat ulang.

## Mencetak
- Memakai **Web Bluetooth**: hanya Chrome/Edge Android, dan hanya printer thermal **BLE**.
- Printer Bluetooth klasik (SPP) tidak bisa dipakai dari browser. Alternatifnya: tombol **Bagikan**
  mengirim gambar struk ke aplikasi lain (mis. RawBT) yang bisa mencetak ke printer klasik.
- Lebar kertas 58 mm (32 kolom).

## Catatan
## OCR
Dua mode (Setelan > Mesin OCR):

**1. Di perangkat (default, tanpa server)**
- Memakai Tesseract.js (`cdn.jsdelivr.net`, dipin ke versi 5.1.1). Pemakaian pertama mengunduh mesin + data bahasa
  (sekitar 15 MB, butuh internet), lalu di-cache service worker/IndexedDB sehingga bisa dipakai offline.
- `js/ocr-parse.js` mengubah teks hasil OCR menjadi field struk (penerima, bank, rekening, nominal, tanggal, referensi,
  token/no meter PLN, layanan/no pelanggan/periode tagihan) dan mendeteksi jenis struk otomatis.
- Parser berbasis aturan dan kata kunci. Ubah daftar bank/layanan di `ocr-parse.js` (`BANKS`, `SERVICES`) untuk
  menyesuaikan dengan struk yang paling sering Anda proses.

**2. Server sendiri (opsional)**
- Kontrak: `{device_id, image_base64, scan_type}` dan `{device_id, ocr_session, scan_type}` (sama seperti `ocr_v4.php`).
- Server harus mengizinkan CORS dari `https://USERNAME.github.io`:
  ```php
  header('Access-Control-Allow-Origin: https://USERNAME.github.io');
  header('Access-Control-Allow-Headers: Content-Type');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
  ```

**Berbagi gambar dari aplikasi bank** (Web Share Target) hanya aktif setelah PWA **diinstal**. Setelah update manifest,
hapus lalu instal ulang agar Android memperbarui daftar share.

## Catatan
## OCR (butuh server)
- Gambar diperkecil (maks 1600px) lalu dikirim ke `Setelan > Server OCR` (default `https://trfbt.net/ocr_v4.php`)
  dengan kontrak yang sama seperti APK: `{device_id, image_base64, scan_type}` dan `{device_id, ocr_session, scan_type}`.
- `scan_type`: `trf`, `pln`, `tagihan`, atau `auto` (dipakai saat gambar dibagikan dari aplikasi lain).
- **Server harus mengizinkan CORS** dari `https://USERNAME.github.io`. Di PHP, tambahkan di awal `ocr_v4.php`:
  ```php
  header('Access-Control-Allow-Origin: https://USERNAME.github.io');
  header('Access-Control-Allow-Headers: Content-Type');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
  ```
- `device_id` dibuat otomatis (`PWA-XXXXXXXXXXXXXXXX`) dan bisa diubah di Setelan. Jika server Anda memeriksa
  lisensi/kuota per device_id, sesuaikan sisi server.
- Berbagi gambar dari aplikasi bank ke TRFBT (Web Share Target) hanya aktif setelah aplikasi **diinstal**.
  Setelah update manifest, hapus lalu instal ulang agar Android memperbarui daftar share.

## Catatan
- Data hanya ada di perangkat. Gunakan *Setelan > Unduh cadangan* secara berkala.
- Setiap struk memuat baris "SALINAN - TRFBT" (ada di `js/receipts.js`, fungsi `footer`).
