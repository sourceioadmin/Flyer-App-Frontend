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

      // Try to fetch image - first try download endpoint, then fall back to imageUrl
      console.log('Fetching image for WhatsApp share, flyer ID:', flyer.id);
      let blob;
      let blobFetchMethod = 'unknown';

      try {
        // Try API download endpoint first (this bypasses CORS issues)
        const response = await flyerAPI.downloadFlyer(flyer.id);
        blob = response.data;
        blobFetchMethod = 'download-endpoint';
        console.log('✓ Image fetched via download endpoint');
      } catch (downloadError) {
        // If download endpoint fails (404 or other), use imageUrl with multiple fallback methods
        console.log('Download endpoint failed:', downloadError.response?.status || downloadError.message);
        console.log('Trying imageUrl fallback methods...');

        const imageUrl = flyer.imageUrl || flyerAPI.getFlyerImageUrl(flyer.imagePath);
        if (!imageUrl) {
          throw new Error('No image URL available');
        }

        // Method 1: Try direct fetch with no-cors mode first (doesn't trigger CORS preflight)
        try {
          const absoluteUrl = imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, window.location.origin).href;
          console.log('Trying fetch with cors mode:', absoluteUrl);

          const fetchResponse = await fetch(absoluteUrl, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-cache'
          });

          if (!fetchResponse.ok) {
            throw new Error(`Fetch failed: ${fetchResponse.status}`);
          }

          blob = await fetchResponse.blob();
          blobFetchMethod = 'direct-fetch';
          console.log('✓ Image fetched via direct fetch');
        } catch (fetchError) {
          console.log('Direct fetch failed:', fetchError.message);
          console.log('Trying canvas method...');

          // Method 2: Try canvas method (only works if CORS headers are present)
          blob = await new Promise((resolve, reject) => {
            const img = new Image();

            // Remove crossOrigin to avoid CORS issues for same-origin images
            // Only set if the image is definitely cross-origin
            const isCrossOrigin = imageUrl.startsWith('http') &&
              !imageUrl.startsWith(window.location.origin);

            if (isCrossOrigin) {
              img.crossOrigin = 'anonymous';
            }

            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((resultBlob) => {
                  if (resultBlob) {
                    blobFetchMethod = 'canvas';
                    console.log('✓ Image converted via canvas');
                    resolve(resultBlob);
                  } else {
                    reject(new Error('Failed to convert image to blob'));
                  }
                }, 'image/jpeg', 0.95);
              } catch (canvasErr) {
                reject(new Error(`Canvas conversion failed: ${canvasErr.message}`));
              }
            };

            img.onerror = (err) => {
              reject(new Error(`Image failed to load: ${err}`));
            };

            img.src = imageUrl;
          });
        }
      }

      if (!blob || blob.size === 0) {
        throw new Error('Received empty image file');
      }

      console.log('Blob received:', blob.size, 'bytes, type:', blob.type, 'method:', blobFetchMethod);

      // Determine file extension and MIME type
      // Extract extension properly from URL, removing query parameters (like SAS tokens)
      const imageUrlPath = (flyer.imageUrl || flyer.imagePath || '').split('?')[0]; // Remove query params
      const extension = imageUrlPath.split('.').pop()?.toLowerCase() || 'jpg';
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

          // For WhatsApp specifically: Share with both files and text
          // On mobile: When user selects WhatsApp and then selects a contact,
          // both the image and message will be pre-filled and ready to send
          await navigator.share({
            files: [file],
            text: shareMessage,
            title: flyer.title,
          });

          console.log('WhatsApp share successful!');
          onClose();
          return; // Success!
        } catch (shareErr) {
          console.error('Share error:', shareErr.name, shareErr.message);

          // Handle user cancellation gracefully
          if (shareErr.name === 'AbortError' || shareErr.name === 'NotAllowedError') {
            console.log('User cancelled share or permission denied');
            onClose();
            return;
          }
          // If share fails, fall through to download method
          console.log('Web Share API failed, falling back to download...');
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

      // Fallback: Download image and copy message to clipboard, then open WhatsApp
      // This allows user to manually share image with pre-copied message
      console.log('Using download + clipboard fallback...');

      // Copy message to clipboard
      try {
        await navigator.clipboard.writeText(shareMessage);
        console.log('Message copied to clipboard');
      } catch (clipboardErr) {
        console.warn('Failed to copy to clipboard:', clipboardErr);
      }

      // Download the image
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      console.log('Image downloaded:', fileName);

      // Open WhatsApp with the message
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Show instructions to user
      alert(
        'WhatsApp Sharing Instructions:\n\n' +
        '1. Image has been downloaded to your device\n' +
        '2. Message has been copied to clipboard\n' +
        '3. WhatsApp will now open\n' +
        '4. Select a contact\n' +
        '5. Paste the message (Ctrl+V or Cmd+V)\n' +
        '6. Attach the downloaded image\n' +
        '7. Send!'
      );

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
        // Desktop: Try WhatsApp Web with message pre-filled
        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
        window.open(whatsappUrl, '_blank');
      }

      console.log('WhatsApp opened. Image downloaded and message ready.');
      onClose();
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        response: error.response?.status,
        stack: error.stack
      });

      let errorMessage = 'Unknown error';

      // Handle axios errors
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        if (status === 404) {
          errorMessage = 'Image not found on server. The file may have been moved or deleted.';
        } else if (status === 403) {
          errorMessage = 'Access denied to image. Please check permissions.';
        } else if (status >= 500) {
          errorMessage = `Server error (${status}). Please try again later.`;
        } else {
          errorMessage = `Server error: ${status} ${error.response.statusText || ''}`;
        }
      } else if (error.request) {
        // Request made but no response received
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Handle CORS or network errors specifically
      if (errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Canvas conversion failed') ||
        errorMessage.includes('Image failed to load') ||
        error.name === 'TypeError' ||
        errorMessage.includes('Network Error')) {
        errorMessage = 'Unable to access image. This may be due to:\n' +
          '• Network connectivity issues\n' +
          '• Image security restrictions (CORS)\n' +
          '• Expired image access token\n\n' +
          'Try using "More Options" or the Download button instead.';
      }

      // Only show alert if it's a real error (not user cancellation)
      if (!errorMessage.includes('AbortError') && !errorMessage.includes('cancelled')) {
        alert(`Error sharing to WhatsApp:\n\n${errorMessage}`);
      }

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
    try {
      // Find the flyer object to get the imageUrl
      const flyer = flyers.find(f => f.id === flyerId);

      if (!flyer) {
        throw new Error('Flyer not found');
      }

      const imageUrl = flyer.imageUrl || flyer.imagePath;

      if (!imageUrl) {
        throw new Error('No image URL available for this flyer');
      }

      console.log('Downloading flyer:', flyerId, 'URL:', imageUrl);

      // Determine file extension
      const extension = imageUrl.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
      const fileName = `${title.replace(/[^a-z0-9\s]/gi, '_')}.${extension}`;

      // For Azure Blob Storage URLs with SAS tokens, use direct link approach
      // This bypasses CORS issues that occur with fetch()
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = fileName;
      link.target = '_blank'; // Fallback: open in new tab if download attribute doesn't work
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('Download initiated for:', fileName);
    } catch (error) {
      console.error('Download failed:', error);
      let errorMessage = 'Failed to download image';

      if (error.message) {
        errorMessage = error.message;
      } else if (error.response) {
        errorMessage = `Server error: ${error.response.status}`;
      }

      setError(`${errorMessage}. Please try again.`);
    }
  };

  const handleShare = (flyer) => {
    setSelectedFlyer(flyer);
    setShareModalOpen(true);
  };

  const handleNativeShare = async (flyer) => {
    setSharingId(flyer.id);
    setError('');

    try {
      // Try to fetch image - first try download endpoint, then fall back to imageUrl
      console.log('Fetching image for native share, flyer ID:', flyer.id);
      let blob;

      try {
        // Try API download endpoint first (this bypasses CORS issues)
        const response = await flyerAPI.downloadFlyer(flyer.id);
        blob = response.data;
        console.log('✓ Image fetched via download endpoint');
      } catch (downloadError) {
        // If download endpoint fails (404 or other), use imageUrl with multiple fallback methods
        console.log('Download endpoint failed:', downloadError.response?.status || downloadError.message);
        console.log('Trying imageUrl fallback methods...');

        const imageUrl = flyer.imageUrl || flyerAPI.getFlyerImageUrl(flyer.imagePath);
        if (!imageUrl) {
          throw new Error('No image URL available');
        }

        // Method 1: Try direct fetch with cors mode first
        try {
          const absoluteUrl = imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, window.location.origin).href;
          console.log('Trying fetch with cors mode:', absoluteUrl);

          const fetchResponse = await fetch(absoluteUrl, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-cache'
          });

          if (!fetchResponse.ok) {
            throw new Error(`Fetch failed: ${fetchResponse.status}`);
          }

          blob = await fetchResponse.blob();
          console.log('✓ Image fetched via direct fetch');
        } catch (fetchError) {
          console.log('Direct fetch failed:', fetchError.message);
          console.log('Trying canvas method...');

          // Method 2: Try canvas method (only works if CORS headers are present)
          blob = await new Promise((resolve, reject) => {
            const img = new Image();

            // Remove crossOrigin to avoid CORS issues for same-origin images
            // Only set if the image is definitely cross-origin
            const isCrossOrigin = imageUrl.startsWith('http') &&
              !imageUrl.startsWith(window.location.origin);

            if (isCrossOrigin) {
              img.crossOrigin = 'anonymous';
            }

            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((resultBlob) => {
                  if (resultBlob) {
                    console.log('✓ Image converted via canvas');
                    resolve(resultBlob);
                  } else {
                    reject(new Error('Failed to convert image to blob'));
                  }
                }, 'image/jpeg', 0.95);
              } catch (canvasErr) {
                reject(new Error(`Canvas conversion failed: ${canvasErr.message}`));
              }
            };

            img.onerror = (err) => {
              reject(new Error(`Image failed to load: ${err}`));
            };

            img.src = imageUrl;
          });
        }
      }

      if (!blob || blob.size === 0) {
        throw new Error('Received empty image file');
      }

      console.log('Blob created:', blob.size, 'bytes, type:', blob.type);

      // Extract extension properly from URL, removing query parameters (like SAS tokens)
      const imageUrlPath = (flyer.imageUrl || flyer.imagePath || '').split('?')[0];
      const extension = imageUrlPath.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${flyer.title.replace(/[^a-z0-9\s]/gi, '_')}.${extension}`;
      const file = new File([blob], fileName, { type: mimeType });
      const shareMessage = `${flyer.title}\n\nShared from ${user?.companyName}`;

      console.log('Checking Web Share API support...');
      console.log('navigator.canShare:', navigator.canShare);
      console.log('Can share files?', navigator.canShare ? navigator.canShare({ files: [file] }) : false);

      // Try Web Share API (shows ALL apps: WhatsApp, Facebook, Instagram, LinkedIn, etc.)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Copy message to clipboard first so user can paste it as caption in WhatsApp
        try {
          await navigator.clipboard.writeText(shareMessage);
          console.log('Message copied to clipboard for caption');
        } catch (clipErr) {
          console.warn('Failed to copy to clipboard:', clipErr);
        }

        try {
          console.log('Attempting to share with Web Share API...');
          // Share file with text - WhatsApp will show image preview with message
          await navigator.share({
            files: [file],
            text: shareMessage,
            title: flyer.title,
          });
          console.log('Share successful!');
          return; // Success!
        } catch (shareErr) {
          console.error('Share error:', shareErr.name, shareErr.message);

          // Handle user cancellation gracefully
          if (shareErr.name === 'AbortError' || shareErr.name === 'NotAllowedError') {
            console.log('User cancelled share or permission denied');
            setSharingId(null);
            return; // User cancelled - don't show error
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
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        response: err.response?.status,
        stack: err.stack
      });

      let errorMessage = 'Unknown error';

      // Handle axios errors
      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        if (status === 404) {
          errorMessage = 'Image not found on server. The file may have been moved or deleted.';
        } else if (status === 403) {
          errorMessage = 'Access denied to image. Please check permissions.';
        } else if (status >= 500) {
          errorMessage = `Server error (${status}). Please try again later.`;
        } else {
          errorMessage = `Server error: ${status} ${err.response.statusText || ''}`;
        }
      } else if (err.request) {
        // Request made but no response received
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Handle CORS or network errors specifically
      if (errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Canvas conversion failed') ||
        errorMessage.includes('Image failed to load') ||
        err.name === 'TypeError' ||
        errorMessage.includes('Network Error')) {
        errorMessage = 'Unable to access image. This may be due to:\n' +
          '• Network connectivity issues\n' +
          '• Image security restrictions (CORS)\n' +
          '• Expired image access token\n\n' +
          'Try using the Download button instead.';
      }

      // Only set error and show alert if it's a real error (not user cancellation)
      if (!errorMessage.includes('AbortError') && !errorMessage.includes('cancelled')) {
        setError(`Failed to share: ${errorMessage}`);
        alert(`Error sharing:\n\n${errorMessage}`);
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
