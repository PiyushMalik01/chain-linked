/**
 * Supabase Real-Time Subscription Utility
 * @description Provides a helper to subscribe to multiple Postgres table changes
 * via a single Supabase Realtime channel.
 * @module lib/supabase/realtime
 */

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Valid table names from the public schema */
type TableName = keyof Database['public']['Tables']

/**
 * Configuration for a single table subscription within a channel
 */
interface SubscriptionConfig {
  /** Table to listen to */
  table: TableName
  /** Postgres change event type (default: '*') */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  /** Optional Postgres filter expression, e.g. `user_id=eq.abc123` */
  filter?: string
}

/**
 * Subscribe to one or more Supabase tables on a single Realtime channel.
 * Returns the channel so the caller can clean up via `supabase.removeChannel(channel)`.
 *
 * @param supabase - Browser Supabase client
 * @param channelName - Unique channel name (should include userId or context to avoid collisions)
 * @param configs - Array of table subscription configurations
 * @param onData - Callback invoked on any matching Postgres change
 * @returns The subscribed RealtimeChannel
 *
 * @example
 * ```ts
 * const channel = subscribeToTables(
 *   supabase,
 *   `drafts-${userId}`,
 *   [
 *     { table: 'generated_posts', filter: `user_id=eq.${userId}` },
 *     { table: 'scheduled_posts', filter: `user_id=eq.${userId}` },
 *   ],
 *   () => fetchDrafts()
 * )
 * // cleanup:
 * supabase.removeChannel(channel)
 * ```
 */
export function subscribeToTables(
  supabase: SupabaseClient<Database>,
  channelName: string,
  configs: SubscriptionConfig[],
  onData: () => void
): RealtimeChannel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase's `.on()` overloads
  // change the return type after the first call, making loops impossible without a cast.
  let channel: any = supabase.channel(channelName)

  for (const config of configs) {
    channel = channel.on(
      'postgres_changes',
      {
        event: config.event || '*',
        schema: 'public',
        table: config.table as string,
        ...(config.filter ? { filter: config.filter } : {}),
      },
      onData
    )
  }

  channel.subscribe()
  return channel as RealtimeChannel
}
