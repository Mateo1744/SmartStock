import type { Session } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'cliente';

export type AuthUser = {
  id: string;
  correo: string;
  rol: UserRole;
};

type AuthResult = { ok: boolean; message: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  updateCurrentUserEmail: (email: string) => void;
  signOut: () => Promise<void>;
};

type ProfileRow = {
  rol: UserRole;
  estado: 'pendiente' | 'activo' | 'inactivo';
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'El correo o la contraseña son incorrectos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (normalized.includes('user already registered')) {
    return 'Ya existe una cuenta registrada con ese correo.';
  }
  if (normalized.includes('rate limit') || normalized.includes('over_email_send_rate_limit')) {
    return 'Supabase alcanzó temporalmente el límite de correos de confirmación. Espera unos minutos antes de intentar nuevamente.';
  }
  if (normalized.includes('signup is disabled') || normalized.includes('signups not allowed')) {
    return 'El registro de usuarios está desactivado en Supabase Auth.';
  }
  if (normalized.includes('database error saving new user')) {
    return 'Supabase no pudo crear el perfil automático del usuario (Database error saving new user). Revisa el trigger crear_perfil_usuario.';
  }
  if (normalized.includes('network request failed') || normalized.includes('failed to fetch')) {
    return 'No fue posible conectarse con Supabase. Revisa la conexión a internet e inténtalo nuevamente.';
  }
  if (normalized.includes('invalid email')) {
    return 'Supabase rechazó el formato del correo electrónico.';
  }
  if (normalized.includes('password')) {
    return 'La contraseña no cumple los requisitos de seguridad.';
  }

  return `Supabase respondió: ${message}`;
}

async function getAuthorizedUser(session: Session): Promise<{
  user: AuthUser | null;
  message?: string;
}> {
  const { data: profile, error } = await supabase
    .from('perfiles')
    .select('rol, estado')
    .eq('id', session.user.id)
    .maybeSingle<ProfileRow>();

  if (error) throw error;

  if (!profile) {
    return { user: null, message: 'No se encontró el perfil asociado a esta cuenta.' };
  }
  if (profile.estado === 'pendiente') {
    return {
      user: null,
      message: 'Tu cuenta está pendiente de aprobación por un administrador.',
    };
  }
  if (profile.estado !== 'activo') {
    return { user: null, message: 'Tu cuenta está inactiva. Contacta al administrador.' };
  }

  return {
    user: {
      id: session.user.id,
      correo: normalizeEmail(session.user.email ?? ''),
      rol: profile.rol,
    },
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          if (active) setUser(null);
          return;
        }

        const result = await getAuthorizedUser(data.session);
        if (!active) return;

        setUser(result.user);
        if (!result.user) await supabase.auth.signOut();
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error || !data.session) {
      return {
        ok: false,
        message: authErrorMessage(error?.message ?? 'No se creó una sesión.'),
      };
    }

    try {
      const result = await getAuthorizedUser(data.session);
      if (!result.user) {
        await supabase.auth.signOut();
        return { ok: false, message: result.message ?? 'La cuenta no está habilitada.' };
      }

      setUser(result.user);
      return { ok: true, message: 'Inicio de sesión exitoso.' };
    } catch {
      await supabase.auth.signOut();
      return { ok: false, message: 'No fue posible validar el estado de la cuenta.' };
    }
  }

  async function register(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
    });

    if (error) return { ok: false, message: authErrorMessage(error.message) };
    if (data.session) await supabase.auth.signOut();

    return {
      ok: true,
      message: data.session
        ? 'Registro exitoso. Tu cuenta debe ser aprobada por un administrador.'
        : 'Registro exitoso. Confirma tu correo y espera la aprobación del administrador.',
    };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }

  function updateCurrentUserEmail(email: string) {
    setUser((current) =>
      current ? { ...current, correo: normalizeEmail(email) } : current
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, register, updateCurrentUserEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
