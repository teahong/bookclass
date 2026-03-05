import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import ChallengePage from './components/ChallengePage'
import MainDashboard from './components/MainDashboard'
import RecommendedBooksPage from './components/RecommendedBooksPage'
import AdminPage from './components/AdminPage'
import StandaloneReportPage from './components/StandaloneReportPage'

type AppState = 'login' | 'challenge' | 'dashboard' | 'recommended' | 'admin' | 'report'

function App() {
  const [appState, setAppState] = useState<AppState>('login')
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    // 1. URL 파라미터 확인 (공유된 리포트 링크 접속 시)
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const user = params.get('user');

    if (mode === 'report' && user) {
      setAppState('report');
      // ReportPage에서 사용할 임시 state는 URL 파라미터에서 직접 읽거나, 
      // 여기서 prop으로 전달하기 위해 별도 state 보단 컴포넌트 마운트 시 URL 확인
    }
    // 2. 세션 유지 확인 (일반 접속)
    else {
      const savedUser = localStorage.getItem('bookFamilyUser')
      if (savedUser) {
        setCurrentUser(savedUser)
        setAppState('dashboard')
      }
    }
  }, [])

  const handleLogin = (userName: string) => {
    setCurrentUser(userName)
    localStorage.setItem('bookFamilyUser', userName)
    setAppState('dashboard')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('bookFamilyUser')
    setAppState('login')
  }

  return (
    <div className="App">
      {appState === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onShowChallenge={() => setAppState('challenge')}
          onShowAdmin={() => setAppState('admin')}
        />
      )}

      {appState === 'challenge' && (
        <ChallengePage
          onBack={() => setAppState('login')}
        />
      )}

      {appState === 'dashboard' && currentUser && (
        <MainDashboard
          userName={currentUser}
          onLogout={handleLogout}
          onShowRecommended={() => setAppState('recommended')}
        />
      )}

      {appState === 'recommended' && currentUser && (
        <RecommendedBooksPage
          userName={currentUser}
          onBack={() => setAppState('dashboard')}
        />
      )}

      {appState === 'admin' && (
        <AdminPage onBack={() => setAppState('login')} />
      )}

      {appState === 'report' && (
        <StandaloneReportPage
          userName={new URLSearchParams(window.location.search).get('user') || ''}
          onHome={() => {
            // URL 파라미터 제거하고 초기화
            window.history.pushState({}, '', window.location.pathname);
            const savedUser = localStorage.getItem('bookFamilyUser');
            if (savedUser) {
              setAppState('dashboard');
            } else {
              setAppState('login');
            }
          }}
        />
      )}
    </div>
  )
}

export default App
