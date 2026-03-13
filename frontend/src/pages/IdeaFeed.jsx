import { useState, useEffect } from 'react';
import { getAllIdeas, rateIdea, approveIdea } from '../api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

export default function IdeaFeed() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      const res = await getAllIdeas();
      setIdeas(res.data);
    } catch (err) {
      toast.error('Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (ideaId, rating) => {
    try {
      await rateIdea({ idea_id: ideaId, rating });
      toast.success(`Rated ${rating} stars!`);
      loadIdeas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rate');
    }
  };

  const handleApproval = async (ideaId, decision) => {
    try {
      await approveIdea({ idea_id: ideaId, decision });
      toast.success(`Idea ${decision}!`);
      loadIdeas();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const myRating = (idea) => {
    const r = idea.ratings?.find((r) => r.admin_id === user?.id);
    return r?.rating || 0;
  };

  const hasReviewed = (idea) => {
    return idea.approvals?.some((a) => a.admin_id === user?.id);
  };

  const hasApproved = (idea) => {
    return idea.approvals?.some((a) => a.admin_id === user?.id && a.decision === 'approved');
  };

  const filtered = ideas.filter((idea) => {
    if (filter === 'all') return true;
    return idea.approval_status === filter;
  });

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading ideas...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Idea Feed</h1>
        <p className="page-subtitle">Browse all submitted AI ideas</p>
      </div>

      <div className="tabs">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${ideas.filter((i) => i.approval_status === f).length})`}
            {f === 'all' && ` (${ideas.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No ideas found</h3>
          <p>Be the first to submit an innovative AI idea!</p>
        </div>
      ) : (
        <div className="ideas-grid">
          {filtered.map((idea) => (
            <div key={idea.id} className="idea-card">
              <div className="idea-card-header">
                <h3 className="idea-title">{idea.title}</h3>
                <span className={`badge badge-${idea.approval_status}`}>
                  {idea.approval_status}
                </span>
              </div>

              <div className="idea-meta">
                <span>👤 {idea.user_name}</span>
                <span>📧 {idea.user_email}</span>
                <span>🏷️ {idea.user_role}</span>
                <span>📅 {new Date(idea.created_at).toLocaleDateString()}</span>
              </div>

              <p className="idea-description">{idea.description}</p>

              {idea.multimedia_files?.length > 0 && (
                <div className="idea-files">
                  {idea.multimedia_files.map((file, i) => (
                    <a
                      key={i}
                      href={`/uploads/${file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-badge"
                    >
                      📎 {file.split('.').pop().toUpperCase()}
                    </a>
                  ))}
                </div>
              )}

              <div className="idea-footer">
                {/* Validation progress */}
                <div style={{ width: '100%', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Validation</span>
                    <span>{idea.approval_count}/{idea.required_approvals} approvals &middot; {idea.rating_count}/{idea.required_approvals} ratings</span>
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, ((idea.approval_count + idea.rating_count) / (idea.required_approvals * 2)) * 100)}%`,
                      height: '100%',
                      background: idea.is_fully_validated ? 'var(--success)' : 'var(--primary)',
                      borderRadius: '4px',
                    }} />
                  </div>
                </div>

                {idea.average_rating != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StarRating rating={Math.round(idea.average_rating)} readonly />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {idea.average_rating} ({idea.rating_count} ratings)
                    </span>
                  </div>
                )}

                {idea.approvals?.length > 0 && (
                  <div className="approval-list">
                    {idea.approvals.map((a, i) => (
                      <span key={i} className="approval-item">
                        <span className="approval-icon">
                          {a.decision === 'approved' ? '✅' : '❌'}
                        </span>
                        {a.admin_name}
                      </span>
                    ))}
                  </div>
                )}

                {idea.is_fully_validated && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                    ✅ Fully Validated
                  </span>
                )}
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div className="admin-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                  {idea.approval_status === 'pending' && !hasReviewed(idea) && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => handleApproval(idea.id, 'approved')}>✅ Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleApproval(idea.id, 'rejected')}>❌ Reject</button>
                    </>
                  )}
                  {idea.approval_status === 'pending' && hasReviewed(idea) && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✓ You have reviewed ({idea.approval_count}/{idea.required_approvals})</span>
                  )}
                  {idea.approval_status === 'approved' && hasApproved(idea) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your Rating:</span>
                      <StarRating rating={myRating(idea)} onRate={(rating) => handleRate(idea.id, rating)} />
                    </div>
                  )}
                  {idea.approval_status === 'approved' && !hasApproved(idea) && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Only approving admins can rate</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
