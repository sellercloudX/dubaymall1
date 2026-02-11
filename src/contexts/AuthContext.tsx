import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshAttempts = useRef(0);
  const maxRefreshAttempts = 3;

  useEffect(() => {
    let mounted = true;

    // Handle auth state changes
    const handleAuthChange = async (event: AuthChangeEvent, currentSession: Session | null) => {
      if (!mounted) return;

      console.log('[Auth] Event:', event);

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          refreshAttempts.current = 0; // Reset on successful auth
          break;

        case 'SIGNED_OUT':
          setSession(null);
          setUser(null);
          refreshAttempts.current = 0;
          break;

        case 'USER_UPDATED':
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          break;

        case 'INITIAL_SESSION':
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          break;

        default:
          // Handle any other events
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
      }

      setLoading(false);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Use setTimeout to prevent deadlock
        setTimeout(() => {
          handleAuthChange(event, session);
        }, 0);
      }
    );

    // THEN check for existing session with retry logic
    const initializeSession = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Session error:', error.message);
          
          // If session retrieval failed, try to refresh
          if (refreshAttempts.current < maxRefreshAttempts) {
            refreshAttempts.current++;
            console.log('[Auth] Attempting refresh:', refreshAttempts.current);
            
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            
            if (!refreshError && refreshedSession && mounted) {
              setSession(refreshedSession);
              setUser(refreshedSession.user);
              refreshAttempts.current = 0;
            } else if (mounted) {
              // Only clear if we've exhausted attempts
              if (refreshAttempts.current >= maxRefreshAttempts) {
                setSession(null);
                setUser(null);
              }
            }
          }
        } else if (mounted) {
          setSession(existingSession);
          setUser(existingSession?.user ?? null);
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    // Periodic session check removed — onAuthStateChange handles all session lifecycle events.
    // The previous interval used a stale closure reference to `session`, causing false "session lost"
    // detections that triggered unnecessary refreshSession() calls and sometimes logged the user out.

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
