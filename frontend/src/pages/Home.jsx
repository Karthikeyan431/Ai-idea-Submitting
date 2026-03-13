import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <div className="home-hero">
        <h1>AI Idea Sharing & Evaluation Platform</h1>
        <p>
          Submit your innovative AI ideas, get them reviewed by expert admins,
          and see how your ideas rank among the best.
        </p>
        {!user ? (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/register" className="btn btn-primary">Get Started</Link>
            <Link to="/login" className="btn btn-secondary">Login</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/submit" className="btn btn-primary">Submit an Idea</Link>
            <Link to="/ideas" className="btn btn-secondary">Browse Ideas</Link>
          </div>
        )}
      </div>

      <div className="home-features">
        <div className="feature-card">
          <div className="feature-icon">💡</div>
          <h3>Submit Ideas</h3>
          <p>Share your innovative AI application ideas with multimedia support.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔍</div>
          <h3>AI Duplicate Detection</h3>
          <p>Our AI detects similar ideas to prevent duplicates and encourage originality.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">✅</div>
          <h3>3-Admin Validation</h3>
          <p>Ideas require approval from 3 independent admins before being validated.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⭐</div>
          <h3>Rating System</h3>
          <p>Validating admins rate each approved idea on a 1-5 star scale.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3>Rankings</h3>
          <p>Top rated ideas are displayed in a public leaderboard ranking.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📧</div>
          <h3>Auto Email Notifications</h3>
          <p>Fully validated and rated ideas are automatically emailed with detailed reports.</p>
        </div>
      </div>
    </div>
  );
}
