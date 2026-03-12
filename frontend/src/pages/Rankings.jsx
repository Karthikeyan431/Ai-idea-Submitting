import { useState, useEffect } from 'react';
import { getRankings, rateIdea } from '../api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

export default function Rankings() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();

  const loadRankings = () => {
    getRankings()
      .then((res) => setRankings(res.data))
      .catch(() => toast.error('Failed to load rankings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRankings();
  }, []);

  const handleRate = async (ideaId, rating) => {
    try {
      await rateIdea({ idea_id: ideaId, rating });
      toast.success(`Rated ${rating} stars!`);
      loadRankings();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rate idea');
    }
  };

  const myRating = (idea) => {
    const r = idea.ratings?.find((r) => r.admin_id === user?.id);
    return r?.rating || 0;
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading rankings...</div>;
  }

  const posClass = (rank) => {
    if (rank === 1) return 'ranking-position gold';
    if (rank === 2) return 'ranking-position silver';
    if (rank === 3) return 'ranking-position bronze';
    return 'ranking-position';
  };

  const medal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🏆 Idea Rankings</h1>
        <p className="page-subtitle">Top rated approved ideas by admin evaluation</p>
      </div>

      {rankings.length === 0 ? (
        <div className="empty-state">
          <h3>No ranked ideas yet</h3>
          <p>Ideas will appear here once approved and rated by admins.</p>
        </div>
      ) : (
        rankings.map((idea) => (
          <div key={idea.id} className="ranking-item">
            <div className={posClass(idea.rank)}>
              {medal(idea.rank)}
            </div>
            <div className="ranking-info">
              <div className="ranking-title">{idea.title}</div>
              <div className="ranking-author">by {idea.user_name}</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {idea.description.length > 150
                  ? idea.description.substring(0, 150) + '...'
                  : idea.description}
              </p>
            </div>
            <div className="ranking-score">
              <div className="ranking-avg">
                <StarRating rating={Math.round(idea.average_rating)} readonly size="1rem" />
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>
                  {idea.average_rating}
                </span>
              </div>
              <div className="ranking-count">{idea.total_ratings} ratings</div>
              {isAdmin && (
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your Rating:</div>
                  <StarRating
                    rating={myRating(idea)}
                    onRate={(rating) => handleRate(idea.id, rating)}
                    size="1.1rem"
                  />
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
