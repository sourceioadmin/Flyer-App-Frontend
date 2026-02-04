import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { flyerAPI } from '../services/api';
import MonthNavigator from '../components/MonthNavigator';
import './CompanyDashboard.css';

// Share Modal Component
const ShareModal = ({ flyer, onClose, onShare }) => {
  const handleWhatsAppShare = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const shareMessage = `${flyer.title}\n\nShared from ${user?.companyName || 'Flyer App'}`;

      // Use API endpoint to download image (avoids CORS issues)
      console.log('Fetching image via API for WhatsApp share, flyer ID:', flyer.id);

      const response = await flyerAPI.downloadFlyer(flyer.id);
      const blob = response.data; // axios returns data in response.data for blob responses

      if (!blob || blob.size === 0) {
        throw new Error('Received empty image file');
      }

      console.log('Blob received:', blob.size, 'bytes, type:', blob.type);

      // Determine file extension and MIME type
      const extension = (flyer.imageUrl || flyer.imagePath || '').split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${flyer.title.replace(/[^a-z0-9\s]/gi, '_')}.${extension}`;
      const file = new File([blob], fileName, { type: mimeType });

      console.log('File created:', fileName, 'type:', mimeType);

      // Check if Web Share API is available
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      const hasWebShareAPI = navigator.share && navigator.canShare;
      const canShareFiles = hasWebShareAPI && navigator.canShare({ files: [file] });

      console.log('Web Share API check:', {
        isSecureContext,
        hasWebShareAPI,
        canShareFiles,
        userAgent: navigator.userAgent
      });

      // Use Web Share API with files (works for WhatsApp and other apps)
      if (canShareFiles) {
        try {
          console.log('Attempting to share with Web Share API (WhatsApp)...');
          await navigator.share({
            files: [file],
            title: flyer.title,
            text: shareMessage,
          });
          console.log('WhatsApp share successful!');
          onClose();
          return; // Success!
        } catch (shareErr) {
          console.error('Share error:', shareErr.name, shareErr.message);
          if (shareErr.name === 'AbortError') {
            // User cancelled - just close modal
            onClose();
            return;
          }
          // If share fails, fall through to URL method
          console.log('Web Share API failed, falling back to URL method...');
        }
      } else {
        console.log('Web Share API not available or cannot share files');
        if (!isSecureContext) {
          console.warn('Web Share API requires HTTPS (or localhost)');
        }
        if (!hasWebShareAPI) {
          console.warn('Web Share API not supported in this browser');
        }
        if (hasWebShareAPI && !canShareFiles) {
          console.warn('Web Share API cannot share files in this context');
        }
      }

      // Fallback: Use WhatsApp URL (text only, no image)
      // This is a limitation - WhatsApp URL doesn't support images
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Mobile: Try native WhatsApp app
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        window.location.href = whatsappUrl;

        // Fallback if WhatsApp app not available
        setTimeout(() => {
          const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
          window.open(whatsappWebUrl, '_blank');
        }, 1000);
      } else {
        // Desktop: Try WhatsApp Web
        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
        window.open(whatsappUrl, '_blank');
      }

      // Show alert that image needs to be attached manually
      alert(
        `WhatsApp opened with message.\n\n` +
        `Note: Please attach the image manually from your device.\n\n` +
        `For better experience, use the "More Options" button which supports image sharing.`
      );

      onClose();
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      let errorMessage = 'Unknown error';

      // Handle axios errors
      if (error.response) {
        // Server responded with error status
        errorMessage = `Server error: ${error.response.status} ${error.response.statusText || ''}`;
      } else if (error.request) {
        // Request made but no response received
        errorMessage = 'Network error: Unable to connect to server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Handle CORS or network errors specifically
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS') || error.name === 'TypeError' || errorMessage.includes('Network Error') || errorMessage.includes('Network error')) {
        errorMessage = 'Unable to access image. This may be due to network or CORS restrictions.';
      }

      // Only show alert if it's a real error (not user cancellation)
      if (!errorMessage.includes('AbortError') && !errorMessage.includes('cancelled')) {
        alert(`Error: ${errorMessage}\n\nPlease try using the "More Options" button instead, or use the Download button.`);
      }
      // Don't call onShare() here to avoid triggering the fetch error again
      onClose();
    }
  };

  const handleNativeShare = () => {
    onShare();
    onClose();
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Share Flyer</h3>
          <button className="share-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="share-modal-content">
          <button className="share-option whatsapp-priority" onClick={handleWhatsAppShare}>
            <div className="share-option-icon">📱</div>
            <div className="share-option-text">
              <div className="share-option-title">WhatsApp</div>
              <div className="share-option-subtitle">Share directly on WhatsApp</div>
            </div>
          </button>

          <button className="share-option native-share" onClick={handleNativeShare}>
            <div className="share-option-icon">📤</div>
            <div className="share-option-text">
              <div className="share-option-title">More Options</div>
              <div className="share-option-subtitle">Facebook, Instagram, LinkedIn, etc.</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const CompanyDashboard = () => {
  const [flyers, setFlyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharingId, setSharingId] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Month navigation state - default to current month
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const fetchFlyers = useCallback(async () => {
    if (!user?.companyId) return;

    setLoading(true);
    try {
      const response = await flyerAPI.getFlyersByCompany(user.companyId, currentYear, currentMonth);

      // ✅ Normalize API response: PascalCase → camelCase
      const normalized = response.data.map(item => ({
        id: item.Id,
        title: item.Title,
        imageUrl: item.ImageUrl, // ✅ prefer this for rendering/sharing
        imagePath: item.ImagePath,
        companyId: item.CompanyId,
        companyName: item.CompanyName,
        forDate: item.ForDate,
        createdAt: item.CreatedAt
      }));

      setFlyers(normalized);
    } catch (err) {
      console.error('Failed to load flyers:', err);
      setError('Failed to load flyers');
    } finally {
      setLoading(false);
    }
  }, [user?.companyId, currentYear, currentMonth]);

  useEffect(() => {
    if (user?.role !== 'Company' || !user?.companyId) {
      navigate('/login');
      return;
    }
    fetchFlyers();
  }, [user, navigate, fetchFlyers]);

  const handleMonthChange = (year, month) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleDownload = async (flyerId, title) => {
    const downloadUrl = flyerAPI.downloadFlyer(flyerId);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${title}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (flyer) => {
    setSelectedFlyer(flyer);
    setShareModalOpen(true);
  };

  const handleNativeShare = async (flyer) => {
    setSharingId(flyer.id);
    setError('');

    try {
      // Use API endpoint to download image (avoids CORS issues)
      console.log('Fetching image via API for native share, flyer ID:', flyer.id);
      const response = await flyerAPI.downloadFlyer(flyer.id);
      const blob = response.data; // axios returns data in response.data for blob responses

      if (!blob || blob.size === 0) {
        throw new Error('Received empty image file');
      }

      console.log('Blob created:', blob.size, 'bytes, type:', blob.type);
      const extension =
        (flyer.imageUrl || flyer.imagePath || '').split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${flyer.title.replace(/[^a-z0-9\s]/gi, '_')}.${extension}`;
      const file = new File([blob], fileName, { type: mimeType });
      const shareMessage = `${flyer.title}\n\nShared from ${user?.companyName}`;

      console.log('Checking Web Share API support...');
      console.log('navigator.canShare:', navigator.canShare);
      console.log('Can share files?', navigator.canShare ? navigator.canShare({ files: [file] }) : false);

      // Try Web Share API (shows ALL apps: WhatsApp, Facebook, Instagram, LinkedIn, etc.)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          console.log('Attempting to share with Web Share API...');
          await navigator.share({
            files: [file],
            title: flyer.title,
            text: shareMessage,
          });
          console.log('Share successful!');
          return; // Success!
        } catch (shareErr) {
          console.error('Share error:', shareErr.name, shareErr.message);
          if (shareErr.name === 'AbortError') {
            setSharingId(null);
            return; // User cancelled
          }
          // If share fails, fall through to download
          console.log('Share failed, falling back to download...');
        }
      } else {
        console.log('Web Share API not available or cannot share files');
      }

      // Fallback: Download the image
      console.log('Using download fallback...');
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      alert(
        `✓ Image downloaded: "${fileName}"\n\n` +
        `Web Share API not available on this device/browser.\n\n` +
        `TO SHARE:\n` +
        `1. Open your preferred social media app\n` +
        `2. Create a new post\n` +
        `3. Attach the downloaded image\n` +
        `4. Share!`
      );

    } catch (err) {
      console.error('Native share failed:', err);
      let errorMessage = 'Unknown error';

      // Handle axios errors
      if (err.response) {
        // Server responded with error status
        errorMessage = `Server error: ${err.response.status} ${err.response.statusText || ''}`;
      } else if (err.request) {
        // Request made but no response received
        errorMessage = 'Network error: Unable to connect to server. Please check your connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Handle CORS or network errors specifically
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS') || err.name === 'TypeError' || errorMessage.includes('Network Error') || errorMessage.includes('Network error')) {
        errorMessage = 'Unable to access image. This may be due to network or CORS restrictions.';
      }

      // Only set error and show alert if it's a real error (not user cancellation)
      if (!errorMessage.includes('AbortError') && !errorMessage.includes('cancelled')) {
        setError(`Failed to share: ${errorMessage}. Please try the Download button instead.`);
        alert(`Error: ${errorMessage}\n\nPlease try using the Download button instead.`);
      }
    } finally {
      setSharingId(null);
    }
  };

  const handleImageClick = (flyer) => {
    setEnlargedImage({
      url: flyer.imageUrl || flyerAPI.getFlyerImageUrl(flyer.imagePath),
      title: flyer.title
    });
  };

  const closeEnlargedImage = () => {
    setEnlargedImage(null);
  };

  // Close modal with Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && enlargedImage) {
        closeEnlargedImage();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enlargedImage]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="company-container">
      {/* Image Modal */}
      {enlargedImage && (
        <div className="image-modal" onClick={closeEnlargedImage}>
          <button className="modal-close" onClick={closeEnlargedImage}>×</button>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={enlargedImage.url} alt={enlargedImage.title} />
            <p className="modal-title">{enlargedImage.title}</p>
          </div>
        </div>
      )}

      <div className="company-header">
        <div>
          <h1>{user?.companyName}</h1>
          <p>Your Flyers</p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <MonthNavigator
        currentYear={currentYear}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
      />

      <div className="company-content">
        {loading && <p className="loading">Loading flyers...</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && flyers.length === 0 && (
          <div className="no-flyers">
            <p>No flyers available yet.</p>
          </div>
        )}

        <div className="flyers-grid">
          {flyers.map((flyer) => (
            <div key={flyer.id} className="flyer-card">
              <img
                src={flyer.imageUrl || flyerAPI.getFlyerImageUrl(flyer.imagePath)}
                alt={flyer.title}
                className="flyer-image"
                onClick={() => handleImageClick(flyer)}
                onError={(e) => {
                  console.error('Failed to load image:', { imageUrl: flyer.imageUrl, imagePath: flyer.imagePath }, e);
                  e.target.src = '/vite.svg'; // Fallback to a placeholder
                }}
                style={{ cursor: 'pointer' }}
                title="Click to view full size"
              />
              <div className="flyer-info">
                <h3>{flyer.title}</h3>
                <p className="flyer-date">
                  {new Date(flyer.createdAt).toLocaleDateString()}
                </p>
                <div className="flyer-actions">
                  <button
                    onClick={() => handleShare(flyer)}
                    className="btn-share"
                    disabled={sharingId === flyer.id}
                    title="Share on WhatsApp"
                  >
                    {sharingId === flyer.id ? 'Preparing...' : 'Share on whatsapp'}
                  </button>
                  <button
                    onClick={() => handleDownload(flyer.id, flyer.title)}
                    className="btn-download"
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share Modal */}
      {shareModalOpen && selectedFlyer && (
        <ShareModal
          flyer={selectedFlyer}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedFlyer(null);
            setError(''); // Clear any error state when closing modal
          }}
          onShare={() => handleNativeShare(selectedFlyer)}
        />
      )}
    </div>
  );
};

export default CompanyDashboard;
