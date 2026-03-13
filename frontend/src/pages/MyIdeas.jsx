import { useState, useEffect } from 'react';
import { getMyIdeas } from '../api';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

export default function MyIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyIdeas()
      .then((res) => setIdeas(res.data))
      .catch(() => toast.error('Failed to load your ideas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Ideas</h1>
        <p className="page-subtitle">Ideas you have submitted</p>
      </div>

      {ideas.length === 0 ? (
        <div className="empty-state">
          <h3>No ideas submitted yet</h3>
          <p>Start sharing your innovative AI ideas!</p>
        </div>
      ) : (
        <div className="ideas-grid">
          {ideas.map((idea) => (
            <div key={idea.id} className="idea-card">
              <div className="idea-card-header">
                <h3 className="idea-title">{idea.title}</h3>
                <span className={`badge badge-${idea.approval_status}`}>
                  {idea.approval_status}
                </span>
              </div>

              <p className="idea-description">{idea.description}</p>

              {idea.multimedia_files?.length > 0 && (
                <div className="idea-files">
                  {idea.multimedia_files.map((file, i) => (
                    <a key={i} href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer" className="file-badge">
                      📎 {file.split('.').pop().toUpperCase()}
                    </a>
                  ))}
                </div>
              )}

              {/* Validation progress */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Validation Progress</span>
                  <span>{idea.approval_count}/{idea.required_approvals} approvals &middot; {idea.rating_count}/{idea.required_approvals} ratings</span>
                </div>
                <div style={{ background: 'var(--bg-input)', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((idea.approval_count + idea.rating_count) / (idea.required_approvals * 2)) * 100)}%`,
                    height: '100%',
                    background: idea.is_fully_validated ? 'var(--success)' : 'var(--primary)',
                    borderRadius: '4px',
                  }} />
                </div>
              </div>

              {idea.average_rating != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <StarRating rating={Math.round(idea.average_rating)} readonly />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {idea.average_rating} avg ({idea.rating_count} ratings)
                  </span>
                </div>
              )}

              {idea.approvals?.length > 0 && (
                <div className="approval-list">
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Reviews:</strong>
                  {idea.approvals.map((a, i) => (
                    <span key={i} className="approval-item">
                      {a.decision === 'approved' ? '✅' : '❌'} {a.admin_name}
                    </span>
                  ))}
                </div>
              )}

              {idea.is_fully_validated && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                  ✅ Fully Validated & {idea.email_sent ? '📧 Notification Sent' : '⏳ Awaiting Email'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
