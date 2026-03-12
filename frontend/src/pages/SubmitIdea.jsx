import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitIdea, checkDuplicate } from '../api';
import toast from 'react-hot-toast';

export default function SubmitIdea() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const handleCheckDuplicate = async () => {
    if (!title || !description || description.length < 10) {
      toast.error('Please enter a title and description (min 10 chars)');
      return;
    }
    setChecking(true);
    try {
      const res = await checkDuplicate({ title, description });
      setDuplicateWarning(res.data);
      if (!res.data.is_duplicate) {
        toast.success('No similar ideas found!');
      }
    } catch (err) {
      toast.error('Failed to check for duplicates');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      for (const file of files) {
        formData.append('files', file);
      }
      await submitIdea(formData);
      toast.success('Idea submitted successfully!');
      navigate('/my-ideas');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit idea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">Submit New Idea</h1>
        <p className="page-subtitle">Share your innovative AI application idea</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Idea Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., AI Powered Women Safety Smart Band"
              required
              minLength={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your AI idea in detail..."
              required
              minLength={10}
            />
          </div>

          <div className="form-group">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCheckDuplicate}
              disabled={checking}
            >
              {checking ? '🔍 Checking...' : '🔍 Check for Similar Ideas'}
            </button>
          </div>

          {duplicateWarning && duplicateWarning.is_duplicate && (
            <div className="duplicate-warning">
              <h4>⚠️ Similar Ideas Found</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {duplicateWarning.message}
              </p>
              <ul>
                {duplicateWarning.similar_ideas.map((idea) => (
                  <li key={idea.id}>
                    "{idea.title}" — {idea.similarity}% similar
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                You can still submit your idea if you believe it's unique.
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Multimedia Files (optional)</label>
            <input
              type="file"
              className="form-input"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.mp4,.avi,.mov,.wmv,.webm,.mp3,.wav,.ogg,.aac,.pdf,.ppt,.pptx,.doc,.docx,.txt"
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Supported: Images, Videos, Audio, PDF, PPT, DOCX, TXT (max 50MB each)
            </p>
          </div>

          {files.length > 0 && (
            <div className="idea-files" style={{ marginBottom: '1rem' }}>
              {files.map((f, i) => (
                <span key={i} className="file-badge">📎 {f.name}</span>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Submitting...' : '🚀 Submit Idea'}
          </button>
        </form>
      </div>
    </div>
  );
}
