/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Role = 'INVESTOR' | 'BORROWER' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, role: Role) => Promise<void>
  register: (name: string, email: string, password: string, role: Role) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const MOCK_USERS: User[] = [
  { id: '1', name: 'Alice Kimani', email: 'investor@demo.com', role: 'INVESTOR' },
  { id: '2', name: 'Bob Odhiambo', email: 'borrower@demo.com', role: 'BORROWER' },
  { id: '3', name: 'Carol Admin', email: 'admin@demo.com', role: 'ADMIN' },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('stellar_user')
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (email: string, _password: string, role: Role) => {
    await new Promise(r => setTimeout(r, 800))
    let found = MOCK_USERS.find(u => u.email === email && u.role === role)
    if (!found) {
      found = { id: crypto.randomUUID(), name: email.split('@')[0], email, role }
    }
    setUser(found)
    localStorage.setItem('stellar_user', JSON.stringify(found))
  }

  const register = async (name: string, email: string, _password: string, role: Role) => {
    await new Promise(r => setTimeout(r, 900))
    const newUser: User = { id: crypto.randomUUID(), name, email, role }
    setUser(newUser)
    localStorage.setItem('stellar_user', JSON.stringify(newUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('stellar_user')
    localStorage.removeItem('stellar_wallet')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
