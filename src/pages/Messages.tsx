import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types'
import { MessageSquare, ArrowUpRight, ArrowDownLeft, Search, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const pageSize = 50

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('messages').select('*, bot_user:bot_users(id, username, first_name)', { count: 'exact' })

    if (filter !== 'all') {
      query = query.eq('direction', filter)
    }
    if (search.trim()) {
      query = query.ilike('text', `%${search}%`)
    }

    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    setMessages(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [filter, search, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'incoming', 'outgoing'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setPage(0); setFilter(f) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                filter === f
                  ? 'bg-primary-600/15 text-primary-400 border border-primary-500/30'
                  : 'text-dark-400 hover:bg-dark-700 hover:text-dark-100 border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Messages list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-dark-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No messages found</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {messages.map((msg) => (
              <div key={msg.id} className="px-4 py-3 hover:bg-dark-900/30 transition-colors flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.direction === 'incoming' ? 'bg-success-500/10' : 'bg-primary-500/10'
                }`}>
                  {msg.direction === 'incoming' ? (
                    <ArrowDownLeft className="w-4 h-4 text-success-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-primary-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-dark-100">
                      {msg.bot_user?.first_name ?? msg.bot_user?.username ?? `User ${msg.bot_user_id ?? 'unknown'}`}
                    </span>
                    <span className={`badge text-[10px] ${
                      msg.direction === 'incoming' ? 'bg-success-500/10 text-success-500' : 'bg-primary-500/10 text-primary-400'
                    }`}>
                      {msg.direction}
                    </span>
                  </div>
                  <p className="text-sm text-dark-300 truncate">{msg.text ?? '(no text)'}</p>
                </div>
                <span className="text-xs text-dark-400 flex-shrink-0 whitespace-nowrap">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
            <p className="text-sm text-dark-400">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost p-2">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="btn-ghost p-2">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
