import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    role: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register(form);
      loginUser(res.data.access_token, res.data.user);
      toast.success('Registration successful!');
      navigate('/ideas');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">Join the AI Idea Platform</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" value={form.name} onChange={update('name')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={update('email')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={form.password} onChange={update('password')} required minLength={6} />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <input type="text" className="form-input" value={form.department} onChange={update('department')} required placeholder="e.g., IT, CS, ECE" />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <input type="text" className="form-input" value={form.role} onChange={update('role')} required placeholder="e.g., Student, Developer, Researcher" />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={update('description')} placeholder="Tell us about yourself..." />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}
