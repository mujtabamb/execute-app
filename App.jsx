import { useState, useEffect } from 'react'
import ExecutionMode from './components/ExecutionMode'
import WeeklyPlanner from './components/WeeklyPlanner'
import AnytimeList from './components/AnytimeList'
import Nav from './components/Nav'

export default function App() {
  const [tab, setTab]       = useState('execution')
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOnline()  { setOffline(false) }
    function handleOffline() { setOffline(true) }
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="app">
      {offline && (
        <div className="offline-banner">
          Offline — changes saved locally and will sync when reconnected
        </div>
      )}

      <main className="app__main">
        {tab === 'execution' && <ExecutionMode />}
        {tab === 'planner'   && <WeeklyPlanner />}
        {tab === 'anytime'   && <AnytimeList />}
      </main>

      <Nav active={tab} onChange={setTab} />
    </div>
  )
}
