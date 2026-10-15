import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Broadcasts from './pages/Broadcasts'
import Commands from './pages/Commands'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/broadcasts" element={<Broadcasts />} />
        <Route path="/commands" element={<Commands />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
