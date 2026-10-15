import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { BotUser } from '@/types'
import { Search, Ban, CheckCircle, Trash2, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export default function Users() {
  const [users, setUsers] = useState<BotUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('bot_users').select('*', { count: 'exact' })

    if (search.trim()) {
      query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    }

    const { data, count } = await query
      .order('joined_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    setUsers(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])

  async function toggleBlock(user: BotUser) {
    await supabase.from('bot_users').update({ is_blocked: !user.is_blocked }).eq('id', user.id)
    load()
  }

  async function toggleActive(user: BotUser) {
    await supabase.from('bot_users').update({ is_active: !user.is_active }).eq('id', user.id)
    load()
  }

  async function deleteUser(user: BotUser) {
    if (!confirm(`Remove user ${user.first_name ?? user.username ?? user.id}? This also deletes their messages.`)) return
    await supabase.from('bot_users').delete().eq('id', user.id)
    load()
  }

  function exportCSV() {
    const headers = ['ID', 'Username', 'First Name', 'Last Name', 'Language', 'Blocked', 'Active', 'Joined', 'Last Activity']
    const rows = users.map((u) => [u.id, u.username, u.first_name, u.last_name, u.language_code, u.is_blocked, u.is_active, u.joined_at, u.last_activity])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bot_users.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search by name or username..."
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-dark-400">{total} users</span>
          <button onClick={exportCSV} className="btn-secondary">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-dark-400">
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">Username</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">Language</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-dark-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(u.first_name || u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-dark-100">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-dark-400">ID: {u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-300">
                      {u.username ? `@${u.username}` : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-300">
                      {u.language_code ? <span className="uppercase">{u.language_code}</span> : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {u.is_blocked && <span className="badge bg-error-500/10 text-error-500">Blocked</span>}
                        {!u.is_active && <span className="badge bg-dark-700 text-dark-400">Inactive</span>}
                        {u.is_active && !u.is_blocked && <span className="badge bg-success-500/10 text-success-500">Active</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-400">
                      {new Date(u.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleBlock(u)}
                          title={u.is_blocked ? 'Unblock' : 'Block'}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_blocked ? 'text-success-500 hover:bg-success-500/10' : 'text-dark-400 hover:bg-dark-700 hover:text-error-500'}`}
                        >
                          {u.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-warning-500 transition-colors"
                        >
                          <CheckCircle className={`w-4 h-4 ${u.is_active ? 'text-success-500' : ''}`} />
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-error-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
            <p className="text-sm text-dark-400">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="btn-ghost p-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="btn-ghost p-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
