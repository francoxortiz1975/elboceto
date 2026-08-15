import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithOtp = (email) => {
    if (!supabase) return Promise.resolve({ error: { message: 'Login no disponible: falta configurar Supabase en este entorno.' } });
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
  };

  const signOut = () => supabase ? supabase.auth.signOut() : Promise.resolve({ error: null });

  const value = {
    session,
    user: session?.user || null,
    loading,
    signInWithOtp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
