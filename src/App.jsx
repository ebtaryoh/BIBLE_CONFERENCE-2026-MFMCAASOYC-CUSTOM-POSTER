import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Upload, Download } from 'lucide-react';
import config from './poster-config.json';

function App() {
  const [userPhoto, setUserPhoto] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const posterRef = useRef(null);
  const fileInputRef = useRef(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setUserPhoto(e.target.result);
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
        <p className="subtitle">Upload your photo and generate your personalized poster instantly.</p>
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

        <div className="poster-preview-container" ref={posterRef} onClick={() => !userPhoto && fileInputRef.current?.click()} style={{ cursor: userPhoto ? 'default' : 'pointer', position: 'relative' }}>
          
          {/* User Photo sits at the bottom layer */}
          {userPhoto ? (
             <img 
               src={userPhoto} 
               alt="User" 
               style={{
                 position: 'absolute',
                 // Use a generous square bounding box centered in the top half to ensure it covers the circular hole
                 top: '5%',
                 left: '5%',
                 width: '90%',
                 height: '80%',
                 objectFit: 'cover',
                 zIndex: 1
               }} 
             />
          ) : (
            <div 
              style={{
                 position: 'absolute',
                 top: '5%',
                 left: '5%',
                 width: '90%',
                 height: '80%',
                 zIndex: 1,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 flexDirection: 'column',
                 gap: '10px',
                 color: '#333'
              }}
            >
               <Upload size={40} color="#666" />
               <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#555', textAlign: 'center', padding: '0 20px' }}>
                 Click here to upload your photo
               </span>
            </div>
          )}

          {/* Transparent Poster Overlay on top */}
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
