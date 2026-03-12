export default function StarRating({ rating, onRate, readonly = false, size = '1.25rem' }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`star ${star <= rating ? 'filled' : 'empty'}`}
          style={{ fontSize: size, cursor: readonly ? 'default' : 'pointer' }}
          onClick={() => !readonly && onRate && onRate(star)}
        >
          ★
        </span>
      ))}
    </div>
  );
}
