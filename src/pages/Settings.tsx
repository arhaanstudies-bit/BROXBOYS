import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { BotSetting } from '@/types'
import { Save, Loader2, Bot, MessageCircle, Wrench, Zap, Webhook, Check, ExternalLink, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useBotStatus } from '@/hooks/useBotStatus'

const SETTING_META: Record<string, { label: string; type: 'text' | 'textarea' | 'boolean'; icon: typeof Bot }> = {
  bot_token: { label: 'Bot Token', type: 'text', icon: Bot },
  welcome_message: { label: 'Welcome Message', type: 'textarea', icon: MessageCircle },
  bot_name: { label: 'Bot Name', type: 'text', icon: Bot },
  maintenance_mode: { label: 'Maintenance Mode', type: 'boolean', icon: Wrench },
  auto_reply_enabled: { label: 'Auto Reply', type: 'boolean', icon: Zap },
}

function settingValue(v: unknown, type: string): string | boolean {
  if (type === 'boolean') return v === true
  return typeof v === 'string' ? v : String(v ?? '')
}

export default function Settings() {
  const [settings, setSettings] = useState<BotSetting[]>([])
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const { status: botStatus, setupWebhook, settingUp, refresh } = useBotStatus()

  const load = useCallback(async () => {
    const { data } = await supabase.from('bot_settings').select('*').order('key', { ascending: true })
    setSettings(data ?? [])
    const v: Record<string, string | boolean> = {}
    for (const s of data ?? []) {
      const meta = SETTING_META[s.key]
      if (meta) v[s.key] = settingValue(s.value, meta.type)
    }
    setValues(v)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveSetting(key: string) {
    setSaving(key)
    const val = values[key]
    const jsonValue = typeof val === 'boolean' ? val : val

    await supabase.from('bot_settings').update({
      value: JSON.stringify(jsonValue),
      updated_at: new Date().toISOString(),
    }).eq('key', key)

    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`
  const isOnline = botStatus?.status === 'online'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Bot activation status */}
      <div className={`card p-6 ${isOnline ? 'border-success-500/30' : 'border-error-500/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-success-500/10' : 'bg-error-500/10'}`}>
              {isOnline ? <Wifi className="w-5 h-5 text-success-500" /> : <WifiOff className="w-5 h-5 text-error-500" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isOnline ? 'Bot Active 24/7' : 'Bot Inactive'}
              </h3>
              <p className="text-sm text-dark-400 mt-0.5">
                {isOnline
                  ? `@${botStatus?.bot_username ?? 'bot'} is online and receiving messages`
                  : botStatus?.last_error ?? 'Set your bot token above, then activate to run 24/7'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} className="btn-secondary text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              Check
            </button>
            <button onClick={setupWebhook} disabled={settingUp} className="btn-primary text-xs">
              {settingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {settingUp ? 'Activating...' : isOnline ? 'Re-activate' : 'Activate 24/7'}
            </button>
          </div>
        </div>
      </div>

      {/* Webhook info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-accent-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Webhook URL</h3>
            <p className="text-sm text-dark-400">Auto-registered when you activate the bot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={webhookUrl}
            className="input font-mono text-xs"
            onClick={(e) => e.currentTarget.select()}
          />
          <button
            onClick={() => { navigator.clipboard.writeText(webhookUrl) }}
            className="btn-secondary whitespace-nowrap"
          >
            Copy
          </button>
        </div>
        <a
          href="https://core.telegram.org/bots/api#setwebhook"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 mt-3 transition-colors"
        >
          How to set up webhook <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Settings */}
      <div className="card divide-y divide-dark-700/50">
        {settings.map((s) => {
          const meta = SETTING_META[s.key]
          if (!meta) return null
          const Icon = meta.icon
          const val = values[s.key]

          return (
            <div key={s.id} className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-dark-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white">{meta.label}</h4>
                    {s.description && <p className="text-xs text-dark-400">{s.description}</p>}
                  </div>

                  {meta.type === 'boolean' ? (
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => setValues({ ...values, [s.key]: !val })}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${val ? 'bg-primary-600' : 'bg-dark-700'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${val ? 'translate-x-6' : ''}`} />
                      </button>
                      <button onClick={() => saveSetting(s.key)} className="btn-secondary text-xs px-3 py-1.5">
                        {saving === s.key ? <Loader2 className="w-3 h-3 animate-spin" /> : saved === s.key ? <Check className="w-3 h-3 text-success-500" /> : 'Save'}
                      </button>
                    </div>
                  ) : meta.type === 'textarea' ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={val as string}
                        onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                        rows={3}
                        className="input resize-none text-sm"
                      />
                      <button onClick={() => saveSetting(s.key)} className="btn-secondary text-xs px-3 py-1.5">
                        {saving === s.key ? <Loader2 className="w-3 h-3 animate-spin" /> : saved === s.key ? <Check className="w-3 h-3 text-success-500" /> : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        value={val as string}
                        onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                        className="input text-sm font-mono"
                      />
                      <button onClick={() => saveSetting(s.key)} className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">
                        {saving === s.key ? <Loader2 className="w-3 h-3 animate-spin" /> : saved === s.key ? <Check className="w-3 h-3 text-success-500" /> : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
