import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import IdeaFeed from './pages/IdeaFeed';
import SubmitIdea from './pages/SubmitIdea';
import MyIdeas from './pages/MyIdeas';
import Rankings from './pages/Rankings';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminPanel from './pages/SuperAdminPanel';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, isSuperAdmin, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/ideas" element={<ProtectedRoute><IdeaFeed /></ProtectedRoute>} />
          <Route path="/submit" element={<ProtectedRoute><SubmitIdea /></ProtectedRoute>} />
          <Route path="/my-ideas" element={<ProtectedRoute><MyIdeas /></ProtectedRoute>} />
          <Route path="/rankings" element={<ProtectedRoute><Rankings /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPanel /></SuperAdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
