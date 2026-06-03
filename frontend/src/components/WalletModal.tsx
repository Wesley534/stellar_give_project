import { useState } from 'react'
import { useWallet } from '../context/WalletContext'

interface WalletModalProps {
  onClose: () => void
}

export function WalletModal({ onClose }: WalletModalProps) {
  const { isConnected, walletAddress, network, balance, connect, disconnect } = useWallet()
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    await connect()
    setConnecting(false)
  }

  const handleDisconnect = () => {
    disconnect()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔗</span> Freighter Wallet
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {isConnected ? 'Wallet connected to Stellar Testnet' : 'Connect your Freighter wallet to continue'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {isConnected && walletAddress ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)', display: 'inline-block' }} />
              <span style={{ color: 'var(--accent-green)', fontSize: '0.82rem', fontWeight: 700 }}>Connected</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>• {network}</span>
            </div>

            <div className="wallet-modal-address">{walletAddress}</div>

            <div className="wallet-modal-stats">
              <div className="wallet-stat">
                <div className="ws-label">Balance</div>
                <div className="ws-value">{balance.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>XLM</span></div>
              </div>
              <div className="wallet-stat">
                <div className="ws-label">Network</div>
                <div className="ws-value" style={{ fontSize: '0.9rem' }}>Testnet</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { navigator.clipboard.writeText(walletAddress) }}>
                📋 Copy Address
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              textAlign: 'center', padding: '2rem 1rem',
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🚀</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Freighter is the Stellar browser extension wallet. Connect to sign transactions on the Stellar Testnet.
              </p>
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin-slow 1s linear infinite' }}>⚡</span>
                  Connecting…
                </>
              ) : (
                '⚡ Connect Freighter Wallet'
              )}
            </button>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1rem' }}>
              Don't have Freighter? <a href="https://freighter.app" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-teal)' }}>Install it here →</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
