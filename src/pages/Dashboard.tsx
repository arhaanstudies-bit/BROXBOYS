import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Radio, TrendingUp, UserCheck, Activity, Send, CheckCircle, AlertCircle, UserX } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { BotUser, Broadcast } from '@/types'

interface Stats {
  totalUsers: number
  activeUsers: number
  blockedUsers: number
  totalBroadcasts: number
  sentBroadcasts: number
}

interface ChartPoint {
  date: string
  users: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [recentBroadcasts, setRecentBroadcasts] = useState<Broadcast[]>([])
  const [recentUsers, setRecentUsers] = useState<BotUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [usersRes, activeRes, blockedRes, broadcastsRes, sentBRes] = await Promise.all([
        supabase.from('bot_users').select('*', { count: 'exact', head: true }),
        supabase.from('bot_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('bot_users').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
        supabase.from('broadcasts').select('*', { count: 'exact', head: true }),
        supabase.from('broadcasts').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      ])

      setStats({
        totalUsers: usersRes.count ?? 0,
        activeUsers: activeRes.count ?? 0,
        blockedUsers: blockedRes.count ?? 0,
        totalBroadcasts: broadcastsRes.count ?? 0,
        sentBroadcasts: sentBRes.count ?? 0,
      })

      const now = new Date()
      const days: ChartPoint[] = []
      for (let i = 13; i >= 0; i--) {
        const day = new Date(now)
        day.setDate(now.getDate() - i)
        const dayStr = day.toISOString().slice(0, 10)
        days.push({ date: dayStr.slice(5), users: 0 })
      }

      const fourteenAgo = new Date(now)
      fourteenAgo.setDate(now.getDate() - 13)
      const { data: newUsersRes } = await supabase
        .from('bot_users')
        .select('joined_at')
        .gte('joined_at', fourteenAgo.toISOString())

      if (newUsersRes) {
        for (const u of newUsersRes) {
          const d = u.joined_at.slice(5, 10)
          const pt = days.find((p) => p.date === d)
          if (pt) pt.users++
        }
      }
      setChartData(days)

      const [recentB, recentU] = await Promise.all([
        supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('bot_users').select('*').order('joined_at', { ascending: false }).limit(5),
      ])
      setRecentBroadcasts(recentB.data ?? [])
      setRecentUsers(recentU.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'primary', change: `+${chartData.slice(-7).reduce((a, b) => a + b.users, 0)} this week` },
    { label: 'Active Users', value: stats.activeUsers, icon: UserCheck, color: 'success' },
    { label: 'Blocked Users', value: stats.blockedUsers, icon: UserX, color: 'error' },
    { label: 'Broadcasts Sent', value: stats.sentBroadcasts, icon: Radio, color: 'warning', change: `${stats.totalBroadcasts} total` },
  ]

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card p-5 hover:border-dark-600 transition-colors duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${card.color}-500/10`}>
                  <Icon className={`w-5 h-5 text-${card.color}-500`} />
                </div>
                {card.change && (
                  <span className="text-xs text-dark-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {card.change}
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">{card.value.toLocaleString()}</p>
              <p className="text-sm text-dark-400 mt-1">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">New Users (14 days)</h3>
          <Activity className="w-5 h-5 text-dark-400" />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} fill="url(#userGrad)" name="New Users" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Broadcasts</h3>
          {recentBroadcasts.length === 0 ? (
            <p className="text-sm text-dark-400 text-center py-8">No broadcasts yet</p>
          ) : (
            <div className="space-y-3">
              {recentBroadcasts.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-900/50 hover:bg-dark-900 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    b.status === 'sent' ? 'bg-success-500/10' : b.status === 'failed' ? 'bg-error-500/10' : 'bg-dark-700'
                  }`}>
                    {b.status === 'sent' ? <CheckCircle className="w-4 h-4 text-success-500" /> : b.status === 'failed' ? <AlertCircle className="w-4 h-4 text-error-500" /> : <Send className="w-4 h-4 text-dark-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-100 truncate">{b.text}</p>
                    <p className="text-xs text-dark-400 mt-0.5">
                      {b.status} · {b.sent_count}/{b.target_count} delivered
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Users</h3>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-dark-400 text-center py-8">No users yet</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-900/50 hover:bg-dark-900 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {(u.first_name || u.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-100 truncate">
                      {u.first_name} {u.last_name}
                      {u.username && <span className="text-dark-400"> @{u.username}</span>}
                    </p>
                    <p className="text-xs text-dark-400 mt-0.5">
                      Joined {new Date(u.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  {u.is_blocked && <span className="badge bg-error-500/10 text-error-500">Blocked</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
