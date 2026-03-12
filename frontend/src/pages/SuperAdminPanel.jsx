import { useState, useEffect } from 'react';
import { getAdmins, getAllUsers, createAdmin, createUser, removeAdmin, getAnalytics } from '../api';
import toast from 'react-hot-toast';

export default function SuperAdminPanel() {
  const [tab, setTab] = useState('analytics');
  const [analytics, setAnalytics] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('admin');
  const [newAccount, setNewAccount] = useState({ name: '', email: '', password: '', department: '', role: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsRes, adminsRes, usersRes] = await Promise.all([
        getAnalytics(),
        getAdmins(),
        getAllUsers(),
      ]);
      setAnalytics(analyticsRes.data);
      setAdmins(adminsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      if (createType === 'admin') {
        await createAdmin(newAccount);
        toast.success('Admin created successfully!');
      } else {
        await createUser(newAccount);
        toast.success('User created successfully!');
      }
      setShowCreateModal(false);
      setNewAccount({ name: '', email: '', password: '', department: '', role: '', description: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create account');
    }
  };

  const handleRemoveAdmin = async (adminId, adminName) => {
    if (!window.confirm(`Are you sure you want to remove admin "${adminName}"?`)) return;
    try {
      await removeAdmin(adminId);
      toast.success('Admin removed');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove admin');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Super Admin Panel</h1>
        <p className="page-subtitle">System management and administration</p>
      </div>

      <div className="tabs">
        {['analytics', 'admins', 'users'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {tab === 'analytics' && analytics && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{analytics.total_users}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.total_admins}</div>
            <div className="stat-label">Total Admins</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.total_ideas}</div>
            <div className="stat-label">Total Ideas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.pending_ideas}</div>
            <div className="stat-label">Pending Ideas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.approved_ideas}</div>
            <div className="stat-label">Approved Ideas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.rejected_ideas}</div>
            <div className="stat-label">Rejected Ideas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.total_approvals}</div>
            <div className="stat-label">Total Reviews</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.total_ratings}</div>
            <div className="stat-label">Total Ratings</div>
          </div>
        </div>
      )}

      {/* Admins Tab */}
      {tab === 'admins' && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={() => { setCreateType('admin'); setShowCreateModal(true); }}>
              + Create Admin
            </button>
            <button className="btn btn-secondary" onClick={() => { setCreateType('user'); setShowCreateModal(true); }}>
              + Create User
            </button>
          </div>

          {admins.length === 0 ? (
            <div className="empty-state"><h3>No admins created yet</h3></div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td>{admin.name}</td>
                      <td>{admin.email}</td>
                      <td>{admin.department}</td>
                      <td>{new Date(admin.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.department}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`badge badge-${u.user_type === 'superadmin' ? 'approved' : u.user_type === 'admin' ? 'pending' : 'approved'}`}>
                      {u.user_type}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create New {createType === 'admin' ? 'Admin' : 'User'}</h3>
            <form onSubmit={handleCreateAccount}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-input"
                  value={newAccount.department}
                  onChange={(e) => setNewAccount({ ...newAccount, department: e.target.value })}
                  required
                  placeholder="e.g., IT, CS, ECE"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <input
                  type="text"
                  className="form-input"
                  value={newAccount.role}
                  onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                  required
                  placeholder="e.g., Student, Developer, Researcher"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={newAccount.description}
                  onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                  placeholder="Brief description..."
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create {createType === 'admin' ? 'Admin' : 'User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
