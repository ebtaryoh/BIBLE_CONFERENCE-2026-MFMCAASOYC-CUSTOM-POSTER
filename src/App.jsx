import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Upload, Download, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { Rnd } from 'react-rnd';
import config from './poster-config.json';

function App() {
  const [userPhoto, setUserPhoto] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const posterRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // State for image position/size using Rnd
  const [photoState, setPhotoState] = useState({
    x: 0,
    y: 0,
    width: 400,
    height: 400
  });

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserPhoto(e.target.result);
        // Reset to default center position when a new photo is uploaded
        // Assuming a standard square image to start
        setPhotoState({
          x: 100, // Arbitrary starting points, users will drag to center
          y: 100,
          width: 500,
          height: 'auto'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async () => {
    if (!posterRef.current) return;
    
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: 2, 
        logging: false,
        backgroundColor: null,
      });
      
      const link = document.createElement('a');
      link.download = 'my-custom-poster.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.9);
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
        <h1>Custom Poster Generator</h1>
        <p className="subtitle">Upload your photo, adjust it to fit, and generate your personalized poster instantly.</p>
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
          <p style={{ color: 'var(--accent)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0' }}>
            <Move size={16} /> Drag the image to position it. Drag the corners to resize.
          </p>
        )}

        <div 
          className="poster-preview-container" 
          ref={posterRef} 
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          
          {/* Base Layer: White Background Block where the hole is */}
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
          />

          {/* User Photo Overlay (draggable/resizable) */}
          {userPhoto ? (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
               <Rnd
                 size={{ width: photoState.width, height: photoState.height }}
                 position={{ x: photoState.x, y: photoState.y }}
                 onDragStop={(e, d) => {
                   setPhotoState(prev => ({ ...prev, x: d.x, y: d.y }));
                 }}
                 onResizeStop={(e, direction, ref, delta, position) => {
                   setPhotoState({
                     width: ref.style.width,
                     height: ref.style.height,
                     ...position,
                   });
                 }}
                 lockAspectRatio={true}
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 <img 
                   src={userPhoto} 
                   alt="User" 
                   draggable="false" // prevents native drag interfering with Rnd
                   style={{
                     width: '100%',
                     height: '100%',
                     objectFit: 'cover' // prevents distortion
                   }} 
                 />
               </Rnd>
            </div>
          ) : (
            // Clickable Placeholder (Black text, White background is handled by base layer)
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                 position: 'absolute',
                 top: `${config.y}%`,
                 left: `${config.x}%`,
                 width: `${config.width}%`,
                 height: `${config.height}%`,
                 zIndex: 1,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 flexDirection: 'column',
                 gap: '10px',
                 cursor: 'pointer'
              }}
            >
               <Upload size={40} color="#000000" />
               <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#000000', textAlign: 'center', padding: '0 20px' }}>
                 Click here to upload your photo
               </span>
            </div>
          )}

          {/* Transparent Poster Overlay on top (hides excess photo parts) */}
          <img 
            src="/poster-transparent.png" 
            alt="Poster Frame" 
            className="poster-image"
            style={{ position: 'relative', zIndex: 10, pointerEvents: 'none' }}
          />

        </div>
      </div>
    </div>
  );
}

export default App;
