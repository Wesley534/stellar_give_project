import { AuthProvider } from './context/AuthContext'
import { WalletProvider } from './context/WalletContext'
import { AppRouter } from './routes/AppRouter'
import './index.css'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <AppRouter />
      </WalletProvider>
    </AuthProvider>
  )
}

export default App
