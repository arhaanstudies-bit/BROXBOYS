import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { BotCommand } from '@/types'
import { Plus, Trash2, Terminal, Edit3, X, Check } from 'lucide-react'

export default function Commands() {
  const [commands, setCommands] = useState<BotCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BotCommand | null>(null)
  const [form, setForm] = useState({ command: '', description: '', response: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('bot_commands').select('*').order('created_at', { ascending: true })
    setCommands(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ command: '', description: '', response: '' })
    setShowModal(true)
  }

  function openEdit(cmd: BotCommand) {
    setEditing(cmd)
    setForm({ command: cmd.command, description: cmd.description, response: cmd.response })
    setShowModal(true)
  }

  async function save() {
    const cmd = form.command.replace(/^\//, '').trim()
    if (!cmd || !form.description.trim() || !form.response.trim()) return

    if (editing) {
      await supabase.from('bot_commands').update({
        command: cmd,
        description: form.description.trim(),
        response: form.response.trim(),
      }).eq('id', editing.id)
    } else {
      await supabase.from('bot_commands').insert({
        command: cmd,
        description: form.description.trim(),
        response: form.response.trim(),
      })
    }
    setShowModal(false)
    load()
  }

  async function toggleEnabled(cmd: BotCommand) {
    await supabase.from('bot_commands').update({ is_enabled: !cmd.is_enabled }).eq('id', cmd.id)
    load()
  }

  async function deleteCommand(cmd: BotCommand) {
    if (!confirm(`Delete command /${cmd.command}?`)) return
    await supabase.from('bot_commands').delete().eq('id', cmd.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dark-400">Manage custom bot commands and their responses</p>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Command
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : commands.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-64 text-dark-400">
          <Terminal className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No commands configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {commands.map((cmd) => (
            <div key={cmd.id} className={`card p-5 transition-all duration-200 ${cmd.is_enabled ? 'border-dark-700' : 'border-dark-700/50 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-dark-900 font-mono text-sm text-primary-400 font-medium">
                    /{cmd.command}
                  </div>
                  {cmd.is_enabled ? (
                    <span className="badge bg-success-500/10 text-success-500">Enabled</span>
                  ) : (
                    <span className="badge bg-dark-700 text-dark-400">Disabled</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(cmd)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-primary-400 transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCommand(cmd)} className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-error-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-dark-400 mb-2">{cmd.description}</p>
              <div className="p-3 rounded-lg bg-dark-900/50 text-sm text-dark-200 whitespace-pre-wrap border border-dark-700/30">
                {cmd.response}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="card p-6 max-w-lg w-full mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">{editing ? 'Edit Command' : 'New Command'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-dark-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Command</label>
                <div className="flex items-center gap-2">
                  <span className="text-dark-400 font-mono">/</span>
                  <input
                    type="text"
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder="mycommand"
                    className="input font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What this command does"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Response</label>
                <textarea
                  value={form.response}
                  onChange={(e) => setForm({ ...form, response: e.target.value })}
                  placeholder="Bot's response when this command is used"
                  rows={4}
                  className="input resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">
                <Check className="w-4 h-4" />
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
