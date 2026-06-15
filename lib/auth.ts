import { supabase } from './supabase';

let initialized = false;

export async function ensureAuth(): Promise<string> {
  if (!initialized) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw new Error(`signInAnonymously failed: ${error.message}`);
    }
    initialized = true;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('auth failed: no user after sign in');
  return user.id;
}
