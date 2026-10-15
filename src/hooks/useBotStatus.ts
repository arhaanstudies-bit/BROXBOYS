import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { BotStatus } from '@/types'

const HEALTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-health`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function callHealth(action: 'check' | 'setup'): Promise<{ ok: boolean; data?: Record<string, unknown> }> {
  try {
    const url = action === 'setup' ? `${HEALTH_URL}?action=setup` : HEALTH_URL
    const res = await fetch(url, {
      method: action === 'setup' ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    return { ok: true, data }
  } catch {
    return { ok: false }
  }
}

export function useBotStatus() {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoActivatedRef = useRef(false)

  const refresh = useCallback(async () => {
    // Call the health edge function to check + auto-repair webhook
    await callHealth('check')

    // Read the updated status from the database
    const { data } = await supabase
      .from('bot_status')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (data) setStatus(data as BotStatus)
    setChecking(false)
  }, [])

  const setupWebhook = useCallback(async () => {
    setSettingUp(true)
    await callHealth('setup')
    setSettingUp(false)
    await refresh()
  }, [refresh])

  useEffect(() => {
    // First load: check status, then auto-activate if offline
    (async () => {
      await refresh()
      // If bot is offline and we haven't auto-activated yet, do it now
      if (!autoActivatedRef.current) {
        autoActivatedRef.current = true
        const { data } = await supabase
          .from('bot_status')
          .select('status')
          .eq('id', 1)
          .maybeSingle()
        if (data && data.status !== 'online') {
          await setupWebhook()
        }
      }
    })()

    // Poll every 30 seconds to keep status fresh and auto-repair webhook
    timerRef.current = setInterval(refresh, 30_000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [refresh, setupWebhook])

  return { status, checking, settingUp, setupWebhook, refresh }
}
