export interface BotUser {
  id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  language_code: string | null
  is_blocked: boolean
  is_active: boolean
  joined_at: string
  last_activity: string
}

export interface Broadcast {
  id: string
  text: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  target_count: number
  sent_count: number
  failed_count: number
  created_at: string
  sent_at: string | null
  scheduled_for: string | null
}

export interface BotSetting {
  id: string
  key: string
  value: unknown
  description: string | null
  updated_at: string
}

export interface BotCommand {
  id: string
  command: string
  description: string
  response: string
  is_enabled: boolean
  created_at: string
}

export interface BotStatus {
  id: number
  status: 'online' | 'offline' | 'error' | 'starting'
  webhook_active: boolean
  last_heartbeat: string | null
  last_error: string | null
  telegram_api_ok: boolean
  bot_username: string | null
  updated_at: string
}
