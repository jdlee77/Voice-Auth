// ===== Voice Auth QR reading: camera or photo, shared by the phone card and the far-end print page =====
// Needs jsQR and, on the page, #btnScan, #video, #btnPhoto and #photoIn (a hidden file input).
//   QrScan.attach({ onCode(code), onMsg(text, cls) }) -> { stop() }
// onCode gets only text that looks like an enrollment code; the camera stops once one is read.
const QrScan = (() => {
  const $ = (id) => document.getElementById(id);
  function decodeFrom(source, w, h) {
    const scale = Math.min(1, 1600 / Math.max(w, h)), cw = Math.round(w * scale), ch = Math.round(h * scale);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, cw, ch);
    const qr = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'attemptBoth' });
    return qr && EnrollmentCode.looks(qr.data) ? qr.data : null;
  }

  function attach({ onCode, onMsg }) {
    let stream = null;
    const stop = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } $('video').style.display = 'none'; };
    const got = (code) => { stop(); onCode(code); };
    $('btnScan').onclick = async () => {
      if (stream) { stop(); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = $('video'); v.srcObject = stream; v.style.display = 'block'; await v.play();
        onMsg('Point the camera at the QR code.', '');
        const loop = () => {
          if (!stream) return;
          if (v.videoWidth) { const code = decodeFrom(v, v.videoWidth, v.videoHeight); if (code) return got(code); }
          requestAnimationFrame(loop);
        };
        loop();
      } catch (e) { stop(); onMsg('Camera not available. Use a photo of the QR code, or paste the code instead.', 'bad'); }
    };
    $('btnPhoto').onclick = () => $('photoIn').click();
    $('photoIn').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => { const code = decodeFrom(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url);
        code ? got(code) : onMsg('No Voice Auth QR code found in that photo. Try again closer and in focus.', 'bad'); };
      img.onerror = () => { URL.revokeObjectURL(url); onMsg('Could not read that image.', 'bad'); };
      img.src = url; e.target.value = '';
    };
    return { stop };
  }
  return { attach };
})();
