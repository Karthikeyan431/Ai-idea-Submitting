import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          🧠 AI Idea Platform
        </Link>

        <div className="navbar-links">
          <Link to="/" className={isActive('/')}>Home</Link>
          <Link to="/ideas" className={isActive('/ideas')}>Ideas</Link>
          <Link to="/rankings" className={isActive('/rankings')}>Rankings</Link>

          {user && (
            <>
              <Link to="/submit" className={isActive('/submit')}>Submit Idea</Link>
              <Link to="/my-ideas" className={isActive('/my-ideas')}>My Ideas</Link>
            </>
          )}

          {isAdmin && (
            <>
              <Link to="/admin" className={isActive('/admin')}>Admin</Link>
              <Link to="/reports" className={isActive('/reports')}>Reports</Link>
            </>
          )}

          {isSuperAdmin && (
            <Link to="/super-admin" className={isActive('/super-admin')}>Super Admin</Link>
          )}
        </div>

        <div className="nav-user">
          {user ? (
            <>
              <div className="nav-user-info">
                <div className="nav-user-name">{user.name}</div>
                <div className="nav-user-role">{user.user_type}</div>
              </div>
              <button className="btn-logout" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className={isActive('/login')}>Login</Link>
              <Link to="/register" className={isActive('/register')}>Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
