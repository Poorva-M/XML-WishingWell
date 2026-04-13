import { shortAddress, timeAgo } from './stellar.js'

export default function WishCard({ wish, rank }) {
  const isTop = rank <= 3

  return (
    <div className={`wish-card ${isTop ? 'top' : ''}`} style={{ animationDelay: `${rank * 0.05}s` }}>
      {rank <= 3 && (
        <span className="wish-rank">
          {rank === 1 ? '✦ #1' : rank === 2 ? '✦ #2' : '✦ #3'}
        </span>
      )}

      <div className="wish-coin">
        <span>✦</span>
        <span>{wish.amount.toFixed(1)} XLM</span>
      </div>

      <p className="wish-text">"{wish.wish}"</p>

      <div className="wish-footer">
        <span className="wish-address">{shortAddress(wish.sender)}</span>
        <span className="wish-time">{timeAgo(wish.createdAt)}</span>
      </div>
    </div>
  )
}
