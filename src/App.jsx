import { useState, useEffect, useCallback, useRef } from 'react'
import './app.css'
import Starfield from './Starfield.jsx'
import WishCard from './WishCard.jsx'
import { useWallet } from './useWallet.js'
import { buildWishTransaction, fetchWishes, WELL_ADDRESS, MAX_WISH_LENGTH } from './stellar.js'

const PRESETS = ['0.1', '0.5', '1', '5']

export default function App() {
  const wallet = useWallet()

  const [wishText, setWishText] = useState('')
  const [amount, setAmount] = useState('0.5')
  const [status, setStatus] = useState(null) // { type: 'error'|'success'|'pending', msg }
  const [submitting, setSubmitting] = useState(false)

  const [wishes, setWishes] = useState([])
  const [loadingWishes, setLoadingWishes] = useState(true)
  const [filter, setFilter] = useState('top') // 'top' | 'recent'
  const [totalXLM, setTotalXLM] = useState(0)
  const [coinPos, setCoinPos] = useState(null)
  const btnRef = useRef(null)

  // Load wishes from Stellar Horizon
  const loadWishes = useCallback(async () => {
    setLoadingWishes(true)
    const data = await fetchWishes()
    setWishes(data)
    const total = data.reduce((s, w) => s + w.amount, 0)
    setTotalXLM(total)
    setLoadingWishes(false)
  }, [])

  useEffect(() => {
    loadWishes()
    // Refresh every 30 seconds
    const interval = setInterval(loadWishes, 30000)
    return () => clearInterval(interval)
  }, [loadWishes])

  const sortedWishes = [...wishes].sort((a, b) =>
    filter === 'top' ? b.amount - a.amount : b.createdAt - a.createdAt
  )

  const handleConnect = async () => {
    if (!wallet.isInstalled()) {
      setStatus({ type: 'error', msg: 'Freighter not installed. See the link below to install it.' })
      return
    }
    await wallet.connect()
  }

  const triggerCoinToss = () => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setCoinPos({ x: rect.left + rect.width / 2, y: rect.top })
    setTimeout(() => setCoinPos(null), 1500)
  }

  const handleWish = async () => {
    if (!wallet.publicKey) return
    if (!wishText.trim()) {
      setStatus({ type: 'error', msg: 'A wish must be spoken before it can be granted.' })
      return
    }
    const xlmAmount = parseFloat(amount)
    if (isNaN(xlmAmount) || xlmAmount < 0.1) {
      setStatus({ type: 'error', msg: 'Minimum offering is 0.1 XLM.' })
      return
    }
    if (wallet.balance && xlmAmount > parseFloat(wallet.balance) - 1) {
      setStatus({ type: 'error', msg: 'Insufficient XLM balance (keep at least 1 XLM as reserve).' })
      return
    }

    setSubmitting(true)
    setStatus({ type: 'pending', msg: 'Building your wish upon the stars… Approve in Freighter.' })

    try {
      const xdr = await buildWishTransaction({
        senderPublicKey: wallet.publicKey,
        amountXLM: xlmAmount.toFixed(7),
        wishText: wishText.trim(),
      })

      await wallet.signAndSubmitTransaction(xdr)
      triggerCoinToss()
      setStatus({ type: 'success', msg: `Your wish has been cast into the well. ✦ It will live on the Stellar blockchain forever.` })
      setWishText('')
      setAmount('0.5')
      wallet.refreshBalance()
      // Reload wishes after 4 seconds (ledger close time)
      setTimeout(loadWishes, 5000)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message || 'Transaction failed. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const charLen = wishText.length
  const charClass = charLen > 90 ? 'over' : charLen > 75 ? 'warn' : ''

  return (
    <div className="app">
      <Starfield />
      <div className="nebula" />

      {/* Coin toss animation */}
      {coinPos && (
        <div
          className="coin-toss"
          style={{ left: coinPos.x, top: coinPos.y }}
        >
          🪙
        </div>
      )}

      <div className="page">

        {/* ── HERO ─────────────────────────────────────────── */}
        <header className="hero">
          <div className="well-rings">
            <div className="ring" />
            <div className="ring" />
            <div className="ring" />
            <div className="well-core">✦</div>
          </div>

          <h1 className="hero-title">
            XLM <span>Wishing Well</span>
          </h1>
          <p className="hero-subtitle">
            Cast your wish onto the Stellar blockchain. It will remain there,<br />
            immutable, for as long as the stars shine.
          </p>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-num">{wishes.length}</span>
              <span className="stat-label">Wishes cast</span>
            </div>
            <div className="stat">
              <span className="stat-num">{totalXLM.toFixed(1)}</span>
              <span className="stat-label">XLM in the well</span>
            </div>
            <div className="stat">
              <span className="stat-num">∞</span>
              <span className="stat-label">Years preserved</span>
            </div>
          </div>
        </header>

        {/* ── WALLET BAR ───────────────────────────────────── */}
        <div className="wallet-bar">
          <div className="wallet-info">
            <div className={`wallet-dot ${wallet.publicKey ? '' : 'disconnected'}`} />
            {wallet.publicKey ? (
              <div>
                <div className="wallet-address">
                  {wallet.publicKey.slice(0, 8)}…{wallet.publicKey.slice(-6)}
                </div>
                {wallet.balance && (
                  <div className="wallet-balance">{wallet.balance} XLM</div>
                )}
              </div>
            ) : (
              <span className="wallet-address" style={{ color: 'var(--text-dim)' }}>
                Wallet not connected
              </span>
            )}
          </div>

          {wallet.publicKey ? (
            <button className="btn btn-disconnect" onClick={wallet.disconnect}>
              Disconnect
            </button>
          ) : (
            <button
              className="btn btn-connect"
              onClick={handleConnect}
              disabled={wallet.connecting}
            >
              {wallet.connecting ? 'Connecting…' : 'Connect Freighter'}
            </button>
          )}
        </div>

        {/* ── INSTALL PROMPT (if not installed) ────────────── */}
        {!wallet.isInstalled() && (
          <div className="install-prompt">
            <p>Freighter wallet is required to cast wishes onto the blockchain.</p>
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install Freighter →
            </a>
          </div>
        )}

        {/* ── WISH FORM ────────────────────────────────────── */}
        <section className="wish-section">
          <div className="section-heading">Make your wish</div>

          <div className="wish-input-wrapper">
            <textarea
              className="wish-input"
              placeholder="I wish upon the stars that…"
              value={wishText}
              maxLength={MAX_WISH_LENGTH}
              onChange={e => setWishText(e.target.value)}
              disabled={!wallet.publicKey || submitting}
              rows={3}
            />
            <span className={`char-count ${charClass}`}>
              {charLen}/{MAX_WISH_LENGTH}
            </span>
          </div>

          <div className="form-controls">
            <div className="amount-group">
              <span className="amount-label">Offer</span>
              <input
                className="amount-input"
                type="number"
                min="0.1"
                step="0.1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={!wallet.publicKey || submitting}
              />
              <span className="amount-suffix">XLM</span>
            </div>

            <button
              ref={btnRef}
              className="btn btn-primary"
              onClick={handleWish}
              disabled={!wallet.publicKey || submitting || !wishText.trim()}
            >
              {submitting ? 'Casting…' : '✦ Cast Wish'}
            </button>
          </div>

          <div className="preset-amounts">
            {PRESETS.map(p => (
              <button
                key={p}
                className={`preset-btn ${amount === p ? 'active' : ''}`}
                onClick={() => setAmount(p)}
                disabled={!wallet.publicKey || submitting}
              >
                {p} XLM
              </button>
            ))}
          </div>

          {status && (
            <div className={`status-msg ${status.type}`}>
              {status.msg}
            </div>
          )}
          {wallet.error && !status && (
            <div className="status-msg error">{wallet.error}</div>
          )}
        </section>

        {/* ── WISHES WALL ──────────────────────────────────── */}
        <section className="wishes-section">
          <div className="wishes-header">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              The Well's Wishes
            </div>
            <div className="filter-tabs">
              <button
                className={`filter-tab ${filter === 'top' ? 'active' : ''}`}
                onClick={() => setFilter('top')}
              >
                ✦ Top
              </button>
              <button
                className={`filter-tab ${filter === 'recent' ? 'active' : ''}`}
                onClick={() => setFilter('recent')}
              >
                Recent
              </button>
            </div>
          </div>

          <div className="wishes-grid" style={{ marginTop: '20px' }}>
            {loadingWishes ? (
              <div className="loading-state" style={{ gridColumn: '1/-1' }}>
                <div className="loading-spinner" />
                <p>Reading the stars…</p>
              </div>
            ) : sortedWishes.length === 0 ? (
              <div className="empty-state">
                <p>The well awaits its first wish.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                  Be the first to cast your wish onto the Stellar blockchain.
                </p>
              </div>
            ) : (
              sortedWishes.map((w, i) => (
                <WishCard key={w.id} wish={w} rank={i + 1} />
              ))
            )}
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer className="footer">
          <p>
            All wishes are permanently stored on the{' '}
            <a href="https://stellar.org" target="_blank" rel="noopener noreferrer">
              Stellar blockchain
            </a>
            . Offerings go to{' '}
            <a
              href={`https://stellar.expert/explorer/public/account/${WELL_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              the well
            </a>
            .
          </p>
          <div className="network-badge">
            <div className="network-dot" />
            Stellar Public Network
          </div>
        </footer>

      </div>
    </div>
  )
}
