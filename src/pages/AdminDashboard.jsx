import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { flyerAPI, companyAPI } from '../services/api';
import MonthNavigator from '../components/MonthNavigator';
import CompanySelector from '../components/CompanySelector';
import { FLYER_TITLES } from '../constants/flyerTitles';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [allFlyers, setAllFlyers] = useState([]);
  const [title, setTitle] = useState('');
  const [titleMode, setTitleMode] = useState('predefined'); // 'predefined' or 'custom'
  const [companyId, setCompanyId] = useState('');
  const [forDate, setForDate] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [editingFlyer, setEditingFlyer] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editForDate, setEditForDate] = useState('');
  const [editFile, setEditFile] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Month navigation state - default to current month
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const fetchFlyers = useCallback(async () => {
    try {
      const params = {
        year: currentYear,
        month: currentMonth
      };
      if (selectedCompanyFilter) {
        params.companyId = selectedCompanyFilter;
      }
      const response = await flyerAPI.getAll(params);
      console.log('Flyers data:', response.data);

      // ✅ Normalize API response: PascalCase → camelCase
      const normalized = response.data.map(item => ({
        id: item.Id,
        title: item.Title,
        imagePath: item.ImagePath,
        companyId: item.CompanyId,
        companyName: item.CompanyName,
        forDate: item.ForDate,
        createdAt: item.CreatedAt
      }));

      setAllFlyers(normalized);
    } catch (err) {
      console.error('Failed to load flyers', err);
      setError('Failed to load flyers');
    }
  }, [selectedCompanyFilter, currentYear, currentMonth]);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await companyAPI.getAll();

      // ✅ Correct mapping: PascalCase → camelCase
      const normalized = response.data.map(item => ({
        id: item.Id,
        name: item.Name,
        contactEmail: item.ContactEmail,
        createdAt: item.CreatedAt
      }));

      setCompanies(normalized);

      if (normalized.length > 0) {
        setCompanyId(normalized[0].id);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError('Failed to load companies');
    }
  }, []);


  useEffect(() => {
    if (user?.role !== 'Admin') {
      navigate('/login');
      return;
    }
    fetchCompanies();
  }, [user, navigate, fetchCompanies]);

  useEffect(() => {
    if (companies.length > 0) {
      fetchFlyers();
    }
  }, [companies, fetchFlyers]);

  const handleMonthChange = (year, month) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleCompanyFilterChange = (companyId) => {
    setSelectedCompanyFilter(companyId);
  };


  const handleDeleteFlyer = async (flyerId) => {
    if (!window.confirm('Are you sure you want to delete this flyer?')) {
      return;
    }

    try {
      await flyerAPI.deleteFlyer(flyerId);
      setMessage('Flyer deleted successfully!');
      fetchFlyers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete flyer');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Only PNG and JPG files are allowed');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const finalTitle = titleMode === 'custom' ? title : (FLYER_TITLES.find(t => t === title) || title);

    if (!finalTitle || !companyId || !file || !forDate) {
      setError('Please fill all fields and select a file');
      return;
    }

    if (isNaN(parseInt(companyId))) {
      setError('Please select a valid company');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', finalTitle);
      formData.append('companyId', parseInt(companyId, 10));
      formData.append('forDate', forDate);
      formData.append('file', file);

      await flyerAPI.uploadFlyer(formData);

      setMessage('Flyer uploaded successfully!');
      setTitle('');
      setForDate('');
      setFile(null);
      setTitleMode('predefined');
      document.getElementById('file-input').value = '';
      fetchFlyers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload flyer');
    } finally {
      setUploading(false);
    }
  };

  const handleEditFlyer = (flyer) => {
    setEditingFlyer(flyer);
    setEditTitle(flyer.title);
    setEditForDate(new Date(flyer.forDate).toISOString().split('T')[0]);
    setEditFile(null);
  };

  const handleUpdateFlyer = async (e) => {
    e.preventDefault();
    if (!editTitle || !editForDate) {
      setError('Please fill all required fields');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('forDate', editForDate);
      if (editFile) {
        formData.append('file', editFile);
      }

      await flyerAPI.updateFlyer(editingFlyer.id, formData);
      setMessage('Flyer updated successfully!');
      setEditingFlyer(null);
      fetchFlyers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update flyer');
    }
  };

  const handleImageClick = (flyer) => {
    setEnlargedImage({
      url: flyerAPI.getFlyerImageUrl(flyer.imagePath),
      title: flyer.title,
      companyName: flyer.companyName
    });
  };

  const closeEnlargedImage = () => {
    setEnlargedImage(null);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (enlargedImage) closeEnlargedImage();
        if (editingFlyer) setEditingFlyer(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enlargedImage, editingFlyer]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-container">
      {/* Image Modal */}
      {enlargedImage && (
        <div key="image-modal" className="image-modal" onClick={closeEnlargedImage}>
          <button className="modal-close" onClick={closeEnlargedImage}>×</button>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={enlargedImage.url} alt={enlargedImage.title} />
            <p className="modal-title">{enlargedImage.title}</p>
            {enlargedImage.companyName && (
              <p className="modal-company">{enlargedImage.companyName}</p>
            )}
          </div>
        </div>
      )}

      {/* Edit Flyer Modal */}
      {editingFlyer && (
        <div key="edit-modal" className="image-modal" onClick={() => setEditingFlyer(null)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingFlyer(null)}>×</button>
            <h2>Edit Flyer</h2>
            <form onSubmit={handleUpdateFlyer}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>For Date</label>
                <input
                  type="date"
                  value={editForDate}
                  onChange={(e) => setEditForDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Replace Image (optional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setEditFile(e.target.files[0])}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-save">Update</button>
                <button type="button" onClick={() => setEditingFlyer(null)} className="btn-cancel">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <div className="admin-content">
        <div className="upload-card">
          <h2>Upload Flyer</h2>

          <form onSubmit={handleSubmit} onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}>
            <div className="form-group">
              <label htmlFor="title-mode">Title Selection</label>
              <div className="radio-group">
                <label key="predefined-option">
                  <input
                    type="radio"
                    value="predefined"
                    checked={titleMode === 'predefined'}
                    onChange={() => setTitleMode('predefined')}
                  />
                  Choose from list
                </label>
                <label key="custom-option">
                  <input
                    type="radio"
                    value="custom"
                    checked={titleMode === 'custom'}
                    onChange={() => setTitleMode('custom')}
                  />
                  Custom title
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title">Flyer Title</label>
              {titleMode === 'predefined' ? (
                <select
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                >
                  <option key="select-title" value="">Select a title</option>
                  {FLYER_TITLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Enter custom title"
                  required
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="for-date">For Date</label>
              <input
                type="date"
                id="for-date"
                value={forDate}
                onChange={(e) => setForDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                required
              />
              <small className="help-text">This determines which month the flyer appears in</small>
            </div>

            <div className="form-group">
              <label htmlFor="company">Select Company</label>
              <select
                id="company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
              >
                <option value="">Select a company</option>
                {companies.map((company, index) => (
                  <option key={`company-${company.id}-${index}`} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="file-input">Upload Image (PNG/JPG)</label>
              <input
                type="file"
                id="file-input"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                required
              />
              {file && <p className="file-name">Selected: {file.name}</p>}
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={uploading} className="upload-btn">
              {uploading ? 'Uploading...' : 'Upload Flyer'}
            </button>
          </form>
        </div>

        <div className="flyers-list-card">
          <h2>All Uploaded Flyers</h2>

          <div className="filter-controls">
            <CompanySelector
              companies={companies}
              selectedCompanyId={selectedCompanyFilter}
              onCompanyChange={handleCompanyFilterChange}
              label="Filter by Company"
            />
            <div className="stats-info">
              <p><strong>Total Companies:</strong> {companies.length}</p>
              <p><strong>Total Flyers:</strong> {allFlyers.length}</p>
            </div>
          </div>

          <MonthNavigator
            currentYear={currentYear}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
          />

          <div className="flyers-table">
            {allFlyers.map((flyer) => (
              <div key={flyer.id} className="flyer-row">
                <img
                  src={flyerAPI.getFlyerImageUrl(flyer.imagePath)}
                  alt={flyer.title}
                  className="flyer-thumbnail"
                  onClick={() => handleImageClick(flyer)}
                  onError={(e) => {
                    console.error('Failed to load image:', flyer.imagePath, e);
                    e.target.src = '/vite.svg'; // Fallback to a placeholder
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full size"
                />
                <div className="flyer-details">
                  <h3>{flyer.title}</h3>
                  <p className="company-badge">{flyer.companyName}</p>
                  <p className="flyer-date">
                    For: {(() => {
                      try {
                        const date = new Date(flyer.forDate);
                        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        });
                      } catch {
                        return 'Invalid Date';
                      }
                    })()}
                  </p>
                </div>
                <div className="flyer-actions">
                  <button
                    onClick={() => handleEditFlyer(flyer)}
                    className="edit-btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteFlyer(flyer.id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {allFlyers.length === 0 && (
              <p className="no-flyers">No flyers for this month yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
