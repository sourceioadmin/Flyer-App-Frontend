import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import InstallPrompt from './components/InstallPrompt';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/company" element={<CompanyDashboard />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        <InstallPrompt />
      </Router>
    </AuthProvider>
  );
}

export default App;
