import { useState, useEffect } from 'react';
import { getAdminDashboard, approveIdea, rateIdea } from '../api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const { user } = useAuth();

  const loadData = async () => {
    try {
      const res = await getAdminDashboard();
      setIdeas(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproval = async (ideaId, decision) => {
    try {
      await approveIdea({ idea_id: ideaId, decision });
      toast.success(`Idea ${decision}!`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${decision} idea`);
    }
  };

  const handleRate = async (ideaId, rating) => {
    try {
      await rateIdea({ idea_id: ideaId, rating });
      toast.success(`Rated ${rating} stars!`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rate idea');
    }
  };

  const hasReviewed = (idea) => {
    return idea.approvals?.some((a) => a.admin_id === user?.id);
  };

  const myRating = (idea) => {
    const r = idea.ratings?.find((r) => r.admin_id === user?.id);
    return r?.rating || 0;
  };

  const filtered = ideas.filter((idea) => {
    if (tab === 'all') return true;
    return idea.approval_status === tab;
  });

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Review, approve, and rate submitted ideas</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{ideas.length}</div>
          <div className="stat-label">Total Ideas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ideas.filter((i) => i.approval_status === 'pending').length}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ideas.filter((i) => i.approval_status === 'approved').length}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ideas.filter((i) => i.approval_status === 'rejected').length}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['pending', 'approved', 'rejected', 'all'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Ideas */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No {tab} ideas</h3>
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
                    <a key={i} href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer" className="file-badge">
                      📎 {file.split('.').pop().toUpperCase()}
                    </a>
                  ))}
                </div>
              )}

              {/* Approval status from all admins */}
              {idea.approvals?.length > 0 && (
                <div className="approval-list" style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Approvals:</strong>
                  {idea.approvals.map((a, i) => (
                    <span key={i} className="approval-item">
                      {a.decision === 'approved' ? '✅' : '❌'} {a.admin_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Average rating */}
              {idea.average_rating != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <StarRating rating={Math.round(idea.average_rating)} readonly />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {idea.average_rating} avg ({idea.ratings?.length || 0} ratings)
                  </span>
                </div>
              )}

              {/* Admin actions */}
              <div className="admin-actions">
                {/* Approve/Reject buttons */}
                {idea.approval_status === 'pending' && !hasReviewed(idea) && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleApproval(idea.id, 'approved')}
                    >
                      ✅ Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleApproval(idea.id, 'rejected')}
                    >
                      ❌ Reject
                    </button>
                  </>
                )}

                {idea.approval_status === 'pending' && hasReviewed(idea) && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                    ✓ You have reviewed this idea
                  </span>
                )}

                {/* Rating (only for approved ideas) */}
                {idea.approval_status === 'approved' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your Rating:</span>
                    <StarRating
                      rating={myRating(idea)}
                      onRate={(rating) => handleRate(idea.id, rating)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
