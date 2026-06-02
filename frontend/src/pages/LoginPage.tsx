import type { FormEvent } from 'react'

import { apiClient } from '../api/client'

export function LoginPage() {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.info('API client ready for login calls:', apiClient.defaults.baseURL)
  }

  return (
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="eyebrow">Frontend scaffold</span>
        <h2>Invoice financing, ready for the first auth flow.</h2>
        <p>
          The UI is intentionally light for now: a login entry point, a dashboard
          placeholder, and routing that can grow alongside the backend.
        </p>

        <div className="hero-stats">
          <div>
            <strong>JWT</strong>
            <span>Auth-ready client setup</span>
          </div>
          <div>
            <strong>Vite</strong>
            <span>Fast iteration for product work</span>
          </div>
          <div>
            <strong>Axios</strong>
            <span>Shared API entry point</span>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <span className="eyebrow">Login</span>
        <h2>Welcome back</h2>
        <p>Use this placeholder form while the auth integration is being wired.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" name="email" placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="Enter password" />
          </label>
          <button type="submit">Continue</button>
        </form>

        <div className="api-hint">API base URL: {apiClient.defaults.baseURL}</div>
      </div>
    </section>
  )
}
