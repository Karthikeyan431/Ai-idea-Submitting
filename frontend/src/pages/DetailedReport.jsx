import { useEffect, useMemo, useState } from 'react';
import { getDetailedReport, getEmailRecipients, sendDetailedReport, downloadDetailedReportPdf } from '../api';
import toast from 'react-hot-toast';

export default function DetailedReport() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    total_approved_projects: 0,
    total_validation_votes: 0,
    total_ratings: 0,
    overall_average_rating: 0,
    top_project: { title: '', average_rating: 0, rank: 0 },
  });
  const [generatedAt, setGeneratedAt] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportRes, recipientRes] = await Promise.all([
        getDetailedReport(),
        getEmailRecipients(),
      ]);
      setReportData(reportRes.data?.report || []);
      setSummary(reportRes.data?.summary || {
        total_approved_projects: 0,
        total_validation_votes: 0,
        total_ratings: 0,
        overall_average_rating: 0,
        top_project: { title: '', average_rating: 0, rank: 0 },
      });
      setGeneratedAt(reportRes.data?.generated_at || null);
      setRecipients(recipientRes.data || []);
    } catch (err) {
      toast.error('Failed to load detailed report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleRecipient = (recipientId) => {
    setSelectedRecipientIds((prev) => {
      if (prev.includes(recipientId)) {
        return prev.filter((id) => id !== recipientId);
      }
      return [...prev, recipientId];
    });
  };

  const topProject = useMemo(() => reportData[0] || null, [reportData]);

  const handleSendReport = async () => {
    try {
      setSending(true);
      const res = await sendDetailedReport({ recipient_ids: selectedRecipientIds });
      toast.success(res.data?.message || 'Report sent successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await downloadDetailedReportPdf();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `approved_projects_report_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Failed to download PDF report');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading detailed report...</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Detailed Project Report</h1>
          <p className="page-subtitle">
            Full report of approved projects with validators, individual ratings, average rating, and rank.
          </p>
          {generatedAt && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.4rem' }}>
              Generated: {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDownloadPdf}>
            Download PDF
          </button>
          <button className="btn btn-primary" onClick={loadData}>
            Refresh Report
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{summary.total_approved_projects}</div>
          <div className="stat-label">Approved Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.total_validation_votes}</div>
          <div className="stat-label">Validation Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.total_ratings}</div>
          <div className="stat-label">Total Ratings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.overall_average_rating}</div>
          <div className="stat-label">Overall Average</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">#{summary.top_project?.rank || (topProject ? topProject.rank : 0) || '-'}</div>
          <div className="stat-label">Top Rank</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{selectedRecipientIds.length}</div>
          <div className="stat-label">Selected Emails</div>
        </div>
      </div>

      {(summary.top_project?.title || topProject?.title) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Top Project Snapshot</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            #{summary.top_project?.rank || topProject?.rank} {summary.top_project?.title || topProject?.title} with average rating {summary.top_project?.average_rating || topProject?.average_rating}
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.6rem' }}>Report Delivery</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          This email report is always sent to all admins and super admins. You can also select additional recipients below.
        </p>

        {recipients.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No additional recipients available.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
            {recipients.map((recipient) => (
              <label key={recipient.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.7rem' }}>
                <input
                  type="checkbox"
                  checked={selectedRecipientIds.includes(recipient.id)}
                  onChange={() => toggleRecipient(recipient.id)}
                />
                <span style={{ fontSize: '0.86rem' }}>{recipient.name} ({recipient.email})</span>
              </label>
            ))}
          </div>
        )}

        <button className="btn btn-success" onClick={handleSendReport} disabled={sending}>
          {sending ? 'Sending Report...' : 'Send Detailed Report'}
        </button>
      </div>

      {reportData.length === 0 ? (
        <div className="empty-state">
          <h3>No approved projects found</h3>
          <p>Projects will appear here once they are approved by validators.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Ranked Summary</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Project</th>
                  <th>Submitted By</th>
                  <th>Validation Votes</th>
                  <th>Average</th>
                  <th>Total Ratings</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item) => (
                  <tr key={item.idea_id}>
                    <td>#{item.rank}</td>
                    <td>{item.title}</td>
                    <td>{item.user_name}</td>
                    <td>{item.validation_votes ?? item.approvals?.length ?? 0}</td>
                    <td>{item.average_rating}</td>
                    <td>{item.total_ratings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ideas-grid">
            {reportData.map((item) => (
              <div className="idea-card" key={item.idea_id} id={`idea-${item.idea_id}`} style={{ scrollMarginTop: '90px' }}>
                <div className="idea-card-header">
                  <h3 className="idea-title">#{item.rank} {item.title}</h3>
                  <span className="badge badge-approved">Avg {item.average_rating}</span>
                </div>
                <div className="idea-meta">
                  <span>Submitted by: {item.user_name}</span>
                  <span>Email: {item.user_email}</span>
                  <span>Role: {item.user_role}</span>
                  <span>Validation Votes: {item.validation_votes ?? item.approvals?.length ?? 0}</span>
                  <span>Approved Votes: {item.approved_votes ?? item.approvals?.filter((a) => a.decision === 'approved').length ?? 0}</span>
                  <span>Rejected Votes: {item.rejected_votes ?? item.approvals?.filter((a) => a.decision === 'rejected').length ?? 0}</span>
                  <span>Ratings: {item.total_ratings}</span>
                  <span>Average Rating: {item.average_rating}</span>
                </div>
                <p className="idea-description">{item.description}</p>

                <div className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Validation Team</strong>
                  {item.validators?.length > 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>{item.validators.join(', ')}</p>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>N/A</p>
                  )}
                </div>

                <div className="card" style={{ padding: '1rem', marginBottom: '0.75rem', overflowX: 'auto' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Approval Decisions</strong>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Validator</th>
                        <th>Decision</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.approvals?.length > 0 ? item.approvals.map((approval, idx) => (
                        <tr key={`${item.idea_id}-approval-${idx}`}>
                          <td>{approval.admin_name}</td>
                          <td>{approval.decision}</td>
                          <td>{approval.timestamp ? new Date(approval.timestamp).toLocaleString() : 'N/A'}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3}>No approval decisions</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Individual Ratings</strong>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Validator</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.ratings?.length > 0 ? item.ratings.map((rating, idx) => (
                        <tr key={`${item.idea_id}-rating-${idx}`}>
                          <td>{rating.admin_name}</td>
                          <td>{rating.rating}/5</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2}>No ratings</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
