import { createClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv, hasServiceRole } from '../env';

/**
 * Privileged Supabase client — **bypasses RLS entirely**.
 *
 * Only for operations the server has already authorised by hand, where the
 * user's own JWT deliberately cannot reach the data. Current uses:
 *   - returning a teacher's payout IBAN to a student who has an accepted
 *     lesson with them (RLS hides that column from everyone but the owner)
 *   - reading counterpart contact details for a confirmed lesson
 *
 * Rules:
 *   - never import this from a client component (`env.js` throws if you do)
 *   - always scope the query yourself; there is no RLS safety net here
 *   - returns null when the key is absent, so callers must handle it
 */
let adminClient = null;

export function getAdminSupabase() {
  if (!hasServiceRole() || !publicEnv.supabaseUrl) return null;
  if (!adminClient) {
    adminClient = createClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export { hasServiceRole };
