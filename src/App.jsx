import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Move } from 'lucide-react';
import Cropper from 'react-easy-crop';
import config from './poster-config.json';

// ─── Toast Component ──────────────────────────────────────────────────────────
// icon + title + subtitle, slides up from bottom, auto-dismisses after `duration` ms
function Toast({ toast, onDismiss }) {
  const [hiding, setHiding] = useState(false);

  // Kick off fade-out `300ms` before the toast fully disappears
  useEffect(() => {
    if (!toast) return;
    const fadeTimer = setTimeout(() => setHiding(true), toast.duration - 300);
    const removeTimer = setTimeout(() => onDismiss(), toast.duration);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [toast, onDismiss]);

  if (!toast) return null;

  const handleClick = () => {
    setHiding(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`toast toast-${toast.type}${hiding ? ' hiding' : ''}`}
      onClick={handleClick}
      role="status"
      aria-live="polite"
      title="Tap to dismiss"
    >
      <span className="toast-icon">{toast.icon}</span>
      <div className="toast-body">
        <span className="toast-title">{toast.title}</span>
        {toast.subtitle && <span className="toast-text">{toast.subtitle}</span>}
      </div>
    </div>
  );
}

// ─── Device Detection ────────────────────────────────────────────────────────
/** Returns true on iPhone / iPad / iPod (including iOS 13+ iPad masquerading as Mac) */
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ─── Image Loading Helper ────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// ─── Canvas → Blob ───────────────────────────────────────────────────────────
function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      type,
      quality,
    ),
  );
}

// ─── Core Poster Compositing ─────────────────────────────────────────────────
/**
 * Manually composites the final poster on a canvas:
 *   1. White background
 *   2. User photo, clipped & placed into the config slot using the
 *      croppedArea percentages captured from react-easy-crop
 *   3. Transparent poster PNG on top
 *
 * This completely replaces html2canvas which cannot capture react-easy-crop's
 * CSS-transformed image reliably on iOS/Android.
 */
async function buildPosterCanvas({ userPhoto, croppedArea }) {
  // Load both images in parallel
  const [overlayImg, userImg] = await Promise.all([
    loadImage('/poster-transparent.png'),
    loadImage(userPhoto),
  ]);

  // Output canvas dimensions — always use the overlay's natural size × outputScale
  const outputScale = Math.max(1500 / overlayImg.naturalWidth, 2);
  const outW = Math.round(overlayImg.naturalWidth * outputScale);
  const outH = Math.round(overlayImg.naturalHeight * outputScale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  // 1. White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outW, outH);

  // 2. User photo — cropped and placed into the config slot
  if (croppedArea) {
    // Destination slot on the output canvas (from poster-config.json percentages)
    const slotX = (config.x / 100) * outW;
    const slotY = (config.y / 100) * outH;
    const slotW = (config.width / 100) * outW;
    const slotH = (config.height / 100) * outH;

    // Source region in the original image (croppedArea is in % of natural size)
    const srcX = (croppedArea.x / 100) * userImg.naturalWidth;
    const srcY = (croppedArea.y / 100) * userImg.naturalHeight;
    const srcW = (croppedArea.width / 100) * userImg.naturalWidth;
    const srcH = (croppedArea.height / 100) * userImg.naturalHeight;

    ctx.save();
    // Clip drawing to the slot area so photo doesn't bleed outside
    ctx.beginPath();
    ctx.rect(slotX, slotY, slotW, slotH);
    ctx.clip();
    ctx.drawImage(userImg, srcX, srcY, srcW, srcH, slotX, slotY, slotW, slotH);
    ctx.restore();
  }

  // 3. Transparent poster overlay (frame on top of photo)
  ctx.drawImage(overlayImg, 0, 0, outW, outH);

  return canvas;
}

// ─── Cross-Platform Save Strategy ────────────────────────────────────────────
/**
 * Saves a Blob to the user's device using the best available method:
 *
 *   Strategy A — Web Share API (iOS Safari, iOS Chrome, modern Android)
 *     The ONLY reliable way to save a file to the iOS Camera Roll.
 *     On Android it also works and triggers the native share sheet.
 *
 *   Strategy B — anchor[download] + blob: URL (Android Chrome, Desktop)
 *     Does NOT work on iOS (Safari ignores the download attribute on anchors).
 *
 *   Strategy C — Open blob in new tab (ultimate iOS fallback)
 *     User long-presses the image → "Save to Photos".
 *     We show a toast message with instructions.
 *
 * @returns {{ method: 'share'|'share-cancelled'|'anchor'|'new-tab' }}
 */
async function saveBlobToDevice(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });

  // ── A: Web Share API — iOS ONLY ────────────────────────────────────────────
  // Android users want a direct download, not a share sheet.
  // <a download> works perfectly on Android, so we skip Share API there.
  const canShare =
    isIOS() &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  if (canShare) {
    try {
      await navigator.share({
        files: [file],
        title: 'MFMCAASOYC BIBLE CONFERENCE 2026 Poster',
        text: '🙌 Join me at the BIBLE CONFERENCE 2026!',
      });
      return { method: 'share' };
    } catch (err) {
      if (err.name === 'AbortError') return { method: 'share-cancelled' };
      // Unexpected error → fall through to next strategy
      console.warn('[Download] Share API error, trying anchor download:', err);
    }
  }

  // ── B: anchor[download] + blob: URL (Android + Desktop) ───────────────────
  // Reliable direct download on Android Chrome/Firefox and all desktops.
  // Skipped on iOS because Safari ignores the download attribute entirely.
  if (!isIOS()) {
    const blobUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { method: 'anchor' };
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15_000);
    }
  }

  // ── C: Open blob in new tab (iOS fallback when Share API unavailable) ──────
  const blobUrl = URL.createObjectURL(blob);
  const tab = window.open(blobUrl, '_blank');
  if (!tab) {
    // Pop-up blocked — last resort: navigate current window
    window.location.href = blobUrl;
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 90_000);
  return { method: 'new-tab' };
}

// ─── App Component ────────────────────────────────────────────────────────────
function App() {
  const [userPhoto, setUserPhoto] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState(null); // { type, icon, title, subtitle, duration }

  // Show a toast and auto-clear it when the timer fires
  const showToast = useCallback((opts) => {
    setToast({ duration: 5000, ...opts });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  const posterRef = useRef(null);
  const fileInputRef = useRef(null);

  // react-easy-crop controlled state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // croppedArea (%) is written by onCropComplete every time the user adjusts
  const croppedAreaRef = useRef(null);
  const onCropComplete = useCallback((_area, _areaPixels) => {
    croppedAreaRef.current = _area; // _area is percentage-based { x, y, width, height }
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUserPhoto(ev.target.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      croppedAreaRef.current = null;
      setStatusMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!userPhoto) return;

    setIsGenerating(true);
    setStatusMsg(null);

    try {
      // One frame delay so "Generating…" label renders before heavy work starts
      await new Promise((r) => setTimeout(r, 80));

      // Build the composited poster canvas
      const canvas = await buildPosterCanvas({
        userPhoto,
        croppedArea: croppedAreaRef.current,
      });

      // Convert to JPEG blob
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);

      // Save using the best strategy for this device
      const result = await saveBlobToDevice(blob, 'BIBLE-CONFERENCE-2026-Poster.jpg');

      if (result.method === 'new-tab') {
        showToast({
          type: 'info',
          icon: '📱',
          title: 'Tap & hold to save',
          subtitle: 'Your poster opened in a new tab — long-press the image → "Save to Photos".',
          duration: 8000,
        });
      } else if (result.method === 'share') {
        showToast({
          type: 'success',
          icon: '🎉',
          title: 'Poster saved!',
          subtitle: 'Check your Photos app — it should be there now.',
        });
      } else if (result.method === 'anchor') {
        showToast({
          type: 'success',
          icon: '✅',
          title: 'Download started!',
          subtitle: 'Check your Downloads folder for your poster.',
        });
      }
      // share-cancelled: user dismissed iOS sheet — no message needed
    } catch (err) {
      console.error('[Poster] Download failed:', err);
      alert(
        'Oops — could not generate your poster.\n\n' +
        'Please try again. If the issue continues, try a different browser.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <header>
        <p className="subtitle">Upload your photo, adjust it to fit perfectly, and download instantly.</p>
      </header>

      <div className="glass-card">
        {/* Controls row */}
        <div className="controls">
          <div className="file-input-wrapper">
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} />
              Upload Photo
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleDownload}
            disabled={!userPhoto || isGenerating}
            style={{
              opacity: !userPhoto || isGenerating ? 0.5 : 1,
              cursor: !userPhoto || isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={20} />
            {isGenerating ? 'Generating…' : 'Download Poster'}
          </button>
        </div>

        {/* Toast notification — rendered fixed at bottom of screen */}
        <Toast toast={toast} onDismiss={dismissToast} />

        {/* Crop hint */}
        {userPhoto && (
          <p
            style={{
              color: 'var(--accent)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0',
              textAlign: 'center',
            }}
          >
            <Move size={16} /> Pinch to zoom or scroll to scale. Drag to position.
          </p>
        )}

        {/* Poster preview */}
        <div
          className="poster-preview-container"
          ref={posterRef}
          style={{ position: 'relative', overflow: 'hidden', width: '100%' }}
        >
          {/* Photo slot — white background + cropper */}
          <div
            style={{
              position: 'absolute',
              top: `${config.y}%`,
              left: `${config.x}%`,
              width: `${config.width}%`,
              height: `${config.height}%`,
              backgroundColor: '#FFFFFF',
              zIndex: 0,
            }}
          >
            {userPhoto ? (
              <Cropper
                image={userPhoto}
                crop={crop}
                zoom={zoom}
                aspect={config.width / config.height}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={false}
                style={{
                  containerStyle: { width: '100%', height: '100%' },
                  cropAreaStyle: { border: 'none', boxShadow: 'none' },
                  mediaStyle: { objectFit: 'cover' },
                }}
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <Upload size={40} color="#000000" />
                <span
                  style={{
                    fontWeight: 'bold',
                    fontSize: 'clamp(0.8rem, 3vw, 1.2rem)',
                    color: '#000000',
                    textAlign: 'center',
                    padding: '0 10px',
                  }}
                >
                  Click here to upload your photo
                </span>
              </div>
            )}
          </div>

          {/* Poster overlay — always on top of the photo */}
          <img
            src="/poster-transparent.png"
            alt="Poster Frame"
            className="poster-image"
            style={{
              position: 'relative',
              zIndex: 10,
              pointerEvents: 'none',
              display: 'block',
              width: '100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
