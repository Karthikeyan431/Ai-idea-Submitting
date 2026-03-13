import { useState, useEffect } from 'react';
import { getAdminDashboard, approveIdea, rateIdea, addEmailRecipient, getEmailRecipients, removeEmailRecipient } from '../api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [showRecipients, setShowRecipients] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' });
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

  const loadRecipients = async () => {
    try {
      const res = await getEmailRecipients();
      setRecipients(res.data);
    } catch (err) {
      toast.error('Failed to load email recipients');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showRecipients) loadRecipients();
  }, [showRecipients]);

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

  const handleAddRecipient = async (e) => {
    e.preventDefault();
    try {
      await addEmailRecipient(newRecipient);
      toast.success('Recipient added!');
      setNewRecipient({ name: '', email: '' });
      loadRecipients();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add recipient');
    }
  };

  const handleRemoveRecipient = async (id) => {
    try {
      await removeEmailRecipient(id);
      toast.success('Recipient removed');
      loadRecipients();
    } catch (err) {
      toast.error('Failed to remove recipient');
    }
  };

  const hasReviewed = (idea) => {
    return idea.approvals?.some((a) => a.admin_id === user?.id);
  };

  const hasApproved = (idea) => {
    return idea.approvals?.some((a) => a.admin_id === user?.id && a.decision === 'approved');
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Review, approve, and rate submitted ideas (requires {ideas[0]?.required_approvals || 3} admin approvals)</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowRecipients(!showRecipients)}>
          📧 {showRecipients ? 'Hide' : 'Manage'} Email Recipients
        </button>
      </div>

      {/* Email Recipients Panel */}
      {showRecipients && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📧 Email Notification Recipients</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            When an idea is validated by {ideas[0]?.required_approvals || 3} admins and fully rated, details are automatically emailed to all admins + these recipients.
          </p>

          <form onSubmit={handleAddRecipient} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Name"
              value={newRecipient.name}
              onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
              required
              style={{ flex: '1', minWidth: '150px' }}
            />
            <input
              type="email"
              className="form-input"
              placeholder="Email address"
              value={newRecipient.email}
              onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
              required
              style={{ flex: '2', minWidth: '200px' }}
            />
            <button type="submit" className="btn btn-primary btn-sm">+ Add</button>
          </form>

          {recipients.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No external recipients added yet. All admins receive emails by default.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Added By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.added_by}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveRecipient(r.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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
        <div className="stat-card">
          <div className="stat-value">{ideas.filter((i) => i.is_fully_validated).length}</div>
          <div className="stat-label">Fully Validated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ideas.filter((i) => i.email_sent).length}</div>
          <div className="stat-label">Emails Sent</div>
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`badge badge-${idea.approval_status}`}>
                    {idea.approval_status}
                  </span>
                  {idea.email_sent && (
                    <span className="badge badge-approved" title="Email notification sent">📧 Sent</span>
                  )}
                </div>
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

              {/* Validation Progress Bar */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Validation Progress</span>
                  <span>{idea.approval_count}/{idea.required_approvals} approvals &middot; {idea.rating_count}/{idea.required_approvals} ratings</span>
                </div>
                <div style={{ background: 'var(--bg-input)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((idea.approval_count + idea.rating_count) / (idea.required_approvals * 2)) * 100)}%`,
                    height: '100%',
                    background: idea.is_fully_validated ? 'var(--success)' : 'var(--primary)',
                    borderRadius: '4px',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {/* Approval status from all admins */}
              {idea.approvals?.length > 0 && (
                <div className="approval-list" style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Validations ({idea.approval_count}/{idea.required_approvals}):</strong>
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
                    {idea.average_rating} avg ({idea.rating_count} / {idea.required_approvals} ratings)
                  </span>
                </div>
              )}

              {/* Individual ratings */}
              {idea.ratings?.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Individual Ratings:</strong>
                  {idea.ratings.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.admin_name}:</span>
                      <StarRating rating={r.rating} readonly size="0.9rem" />
                    </div>
                  ))}
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
                    ✓ You have reviewed this idea ({idea.approval_count}/{idea.required_approvals} approvals so far)
                  </span>
                )}

                {/* Rating (only for approved ideas, only for admins who approved) */}
                {idea.approval_status === 'approved' && hasApproved(idea) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your Rating:</span>
                    <StarRating
                      rating={myRating(idea)}
                      onRate={(rating) => handleRate(idea.id, rating)}
                    />
                  </div>
                )}

                {idea.approval_status === 'approved' && !hasApproved(idea) && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Only approving admins can rate this idea
                  </span>
                )}

                {/* Fully validated indicator */}
                {idea.is_fully_validated && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                    ✅ Fully Validated & {idea.email_sent ? '📧 Email Sent' : '⏳ Email Pending'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
