import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Upload, Download, Move } from 'lucide-react';
import Cropper from 'react-easy-crop';
import config from './poster-config.json';

function App() {
  const [userPhoto, setUserPhoto] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const posterRef = useRef(null);
  const fileInputRef = useRef(null);

  // State for react-easy-crop
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserPhoto(e.target.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async () => {
    if (!posterRef.current) return;

    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Calculate a scale factor to ensure the final image is always high resolution (e.g., ~1500px wide)
      // This fixes the issue where mobile devices (small screen width) exported low-quality images.
      const currentWidth = posterRef.current.offsetWidth;
      const targetWidth = 1500;
      // If the screen is smaller than 1500px, scale it up. If it's already large, keep a minimum scale of 2.
      const dynamicScale = Math.max(targetWidth / currentWidth, 2);

      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: dynamicScale,
        logging: false,
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 1.0);

      // Mobile / iOS Safari Fix using Web Share API
      // If navigator.share and file sharing is supported, use it.
      if (navigator.share && navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'my-custom-poster.jpg', { type: 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'My Custom Poster',
              text: 'Join me at the BIBLE CONFERENCE 2026!'
            });
            return; // Exit if shared successfully
          }
        } catch (err) {
          console.error('Share failed or was cancelled:', err);
          // Don't throw here, just fall through to the default download method
        }
      }

      // Fallback to normal download (works well on desktop and Android)
      const link = document.createElement('a');
      link.download = 'my-custom-poster.jpg';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate poster:', err);
      alert('Failed to generate poster. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        {/* <h1>MFMCAASOYC BIBLE CONFERENCE 2026 Poster Generator</h1> */}
        <p className="subtitle">Upload your photo, adjust it to fit perfectly, and download instantly.</p>
      </header>

      <div className="glass-card">
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
            style={{ opacity: (!userPhoto || isGenerating) ? 0.5 : 1, cursor: (!userPhoto || isGenerating) ? 'not-allowed' : 'pointer' }}
          >
            <Download size={20} />
            {isGenerating ? 'Generating...' : 'Download Poster'}
          </button>
        </div>

        {userPhoto && (
          <p style={{ color: 'var(--accent)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0', textAlign: 'center' }}>
            <Move size={16} /> Pinch your image to zoom or scroll to scale. Drag to position.
          </p>
        )}

        {/* 
          Container for the entire poster preview. 
          It scales automatically on mobile due to max-width and 100% width.
        */}
        <div
          className="poster-preview-container"
          ref={posterRef}
          style={{ position: 'relative', overflow: 'hidden', width: '100%' }}
        >

          {/* Base Layer: White Background Block & User Photo Cropper */}
          <div
            style={{
              position: 'absolute',
              top: `${config.y}%`,
              left: `${config.x}%`,
              width: `${config.width}%`,
              height: `${config.height}%`,
              backgroundColor: '#FFFFFF', // Ensures white space remains white
              zIndex: 0
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
                showGrid={false}
                style={{
                  containerStyle: { width: '100%', height: '100%' },
                  // Hide the dark overlay since we want the image to shine through
                  cropAreaStyle: { border: 'none', boxShadow: 'none' },
                  mediaStyle: { objectFit: 'cover' }
                }}
              />
            ) : (
              // Clickable Placeholder (Black text, White background is handled by base layer)
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
                  cursor: 'pointer'
                }}
              >
                <Upload size={40} color="#000000" />
                <span style={{ fontWeight: 'bold', fontSize: 'clamp(0.8rem, 3vw, 1.2rem)', color: '#000000', textAlign: 'center', padding: '0 10px' }}>
                  Click here to upload your photo
                </span>
              </div>
            )}
          </div>

          {/* Transparent Poster Overlay on top (hides excess photo parts and provides the exact frame) */}
          <img
            src="/poster-transparent.png"
            alt="Poster Frame"
            className="poster-image"
            style={{ position: 'relative', zIndex: 10, pointerEvents: 'none', display: 'block', width: '100%' }}
          />

        </div>
      </div>
    </div>
  );
}

export default App;
