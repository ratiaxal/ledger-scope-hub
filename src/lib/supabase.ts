import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

export const authService = {
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    const { data: { session } } = await supabase.auth.getSession();
    return { session, user: session?.user ?? null };
  },

  onAuthStateChange(callback: (session: Session | null, user: User | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      callback(session, session?.user ?? null);
    });
    return subscription;
  }
};
