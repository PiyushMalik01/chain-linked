/**
 * Supabase Auth Module for Chrome Extension
 * Handles Email/Password authentication with Supabase
 */

/**
 * Auth Manager for handling Email/Password auth with Supabase
 */
class SupabaseAuth {
  constructor() {
    this.currentUser = null;
    this.session = null;
    this.listeners = [];
  }

  /**
   * Sign up with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, user: object, session: object, error: string|null, message: string|null}>}
   */
  async signUp(email, password) {
    try {
      if (!self.isSupabaseConfigured || !self.isSupabaseConfigured()) {
        throw new Error('Supabase is not configured');
      }

      console.log('[SupabaseAuth] Attempting signup to:', self.supabase.url);
      const response = await self.fetchWithRetry(`${self.supabase.url}/auth/v1/signup`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'apikey': self.supabase.anonKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error_description || data.msg || data.message || 'Sign up failed';
        return { success: false, user: null, session: null, error: errorMsg };
      }

      // If email confirmation is required, user won't have a session yet
      if (!data.access_token) {
        return {
          success: true,
          user: data.user,
          session: null,
          error: null,
          message: 'Please check your email to confirm your account'
        };
      }

      // Save session
      await this.saveSession(data);
      self.supabase.setAuth(data.access_token, data.user?.id);

      this.session = data;
      this.currentUser = {
        id: data.user?.id,
        email: data.user?.email
      };

      // Create user record in users table
      await this.ensureUserRecord(data.user);

      this.notifyListeners('SIGNED_IN', this.currentUser);

      console.log('[SupabaseAuth] Sign up successful for:', this.currentUser.email);

      return { success: true, user: this.currentUser, session: data, error: null };

    } catch (error) {
      console.error('[SupabaseAuth] Sign up error:', error);
      return { success: false, user: null, session: null, error: error.message || 'Sign up failed' };
    }
  }

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, user: object, session: object, error: string|null}>}
   */
  async signIn(email, password) {
    try {
      if (!self.isSupabaseConfigured || !self.isSupabaseConfigured()) {
        throw new Error('Supabase is not configured');
      }

      console.log('[SupabaseAuth] Attempting signin to:', self.supabase.url);
      const response = await self.fetchWithRetry(`${self.supabase.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'apikey': self.supabase.anonKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error_description || data.msg || data.message || 'Sign in failed';
        return { success: false, user: null, session: null, error: errorMsg };
      }

      // Save session
      await this.saveSession(data);
      self.supabase.setAuth(data.access_token, data.user?.id);

      this.session = data;
      this.currentUser = {
        id: data.user?.id,
        email: data.user?.email
      };

      // Ensure user record exists
      await this.ensureUserRecord(data.user);

      this.notifyListeners('SIGNED_IN', this.currentUser);

      console.log('[SupabaseAuth] Sign in successful for:', this.currentUser.email);

      return { success: true, user: this.currentUser, session: data, error: null };

    } catch (error) {
      console.error('[SupabaseAuth] Sign in error:', error);
      return { success: false, user: null, session: null, error: error.message || 'Sign in failed' };
    }
  }

  /**
   * Ensure user record exists in our users table
   */
  async ensureUserRecord(authUser) {
    if (!authUser?.id) return;

    try {
      // Check if user exists
      const { data: existingUser } = await self.supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .single();

      if (!existingUser) {
        // Create user record
        await self.supabase
          .from('users')
          .insert({
            id: authUser.id,
            google_id: authUser.id, // Using same ID for compatibility
            email: authUser.email,
            name: authUser.email?.split('@')[0] || 'User'
          });
        console.log('[SupabaseAuth] Created user record');
      }
    } catch (error) {
      console.error('[SupabaseAuth] Failed to ensure user record:', error);
    }
  }

  /**
   * Sign in with Google by opening the platform login page.
   * The platform handles Google OAuth via Supabase, then redirects to
   * /auth/extension-callback which transfers the session to the extension
   * via the webapp-relay content script.
   * @returns {Promise<{success: boolean, pending: boolean, error: string|null}>}
   */
  async signInWithGoogle() {
    try {
      console.log('[SupabaseAuth] Opening platform login for Google sign-in...');

      // Detect dev mode: unpacked extensions have no update_url in manifest
      const manifest = chrome.runtime.getManifest();
      const isDev = !manifest.update_url;
      const baseUrl = isDev ? 'http://localhost:3000' : 'https://chainlinked.ai';
      const loginUrl = `${baseUrl}/login?redirect=/auth/extension-callback`;
      await chrome.tabs.create({ url: loginUrl });

      // Return pending - the session will be received via EXTENSION_AUTH_SESSION
      // message from the webapp-relay content script after the user authenticates
      return { success: true, pending: true, error: null };

    } catch (error) {
      console.error('[SupabaseAuth] Google sign-in error:', error);
      return { success: false, pending: false, error: error.message || 'Google sign-in failed' };
    }
  }

  /**
   * Get the current session
   */
  async getSession() {
    try {
      const result = await chrome.storage.local.get('supabase_session');
      const session = result.supabase_session;

      if (!session) {
        return { session: null, user: null };
      }

      // Check if session is expired
      if (session.expires_at && Date.now() / 1000 > session.expires_at) {
        // Try to refresh
        if (session.refresh_token) {
          return await this.refreshSession(session.refresh_token);
        }
        // Session expired and no refresh token
        await this.signOut();
        return { session: null, user: null };
      }

      this.session = session;
      this.currentUser = session.user ? {
        id: session.user.id,
        email: session.user.email
      } : null;

      // Set auth on supabase client
      if (session.access_token) {
        self.supabase.setAuth(session.access_token, session.user?.id);
      }

      return { session: this.session, user: this.currentUser };

    } catch (error) {
      console.error('[SupabaseAuth] Failed to get session:', error);
      return { session: null, user: null, error };
    }
  }

  /**
   * Refresh the session using refresh token
   */
  async refreshSession(refreshToken) {
    try {
      const response = await self.fetchWithRetry(`${self.supabase.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'apikey': self.supabase.anonKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh session');
      }

      const data = await response.json();

      await this.saveSession(data);
      self.supabase.setAuth(data.access_token, data.user?.id);

      this.session = data;
      this.currentUser = {
        id: data.user?.id,
        email: data.user?.email
      };

      return { session: data, user: this.currentUser, error: null };

    } catch (error) {
      console.error('[SupabaseAuth] Failed to refresh session:', error);
      await this.signOut();
      return { session: null, user: null, error };
    }
  }

  /**
   * Save session to storage
   */
  async saveSession(session) {
    await chrome.storage.local.set({ supabase_session: session });
  }

  /**
   * Sign out
   */
  async signOut() {
    // Only clear the extension's local session — do NOT call Supabase /auth/v1/logout
    // because that revokes the token server-side and logs out the web app too.
    self.supabase?.clearAuth();
    this.session = null;
    this.currentUser = null;

    await chrome.storage.local.remove(['supabase_session', 'supabase_user']);

    this.notifyListeners('SIGNED_OUT', null);

    return { error: null };
  }

  /**
   * Get current user
   */
  async getUser() {
    if (this.currentUser) {
      return { user: this.currentUser };
    }
    const { user } = await this.getSession();
    return { user };
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    const { session } = await this.getSession();
    return !!session;
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  notifyListeners(event, user) {
    this.listeners.forEach(callback => {
      try {
        callback(event, user);
      } catch (e) {
        console.error('[SupabaseAuth] Listener error:', e);
      }
    });
  }

  /**
   * Get the user ID for database operations
   */
  async getUserId() {
    const { user } = await this.getUser();
    return user?.id || null;
  }

  /**
   * Reset password request
   */
  async resetPassword(email) {
    try {
      const response = await self.fetchWithRetry(`${self.supabase.url}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'apikey': self.supabase.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error_description || data.message || 'Failed to send reset email');
      }

      return { error: null, message: 'Password reset email sent' };

    } catch (error) {
      console.error('[SupabaseAuth] Reset password error:', error);
      return { error };
    }
  }
}

// Create singleton instance
const supabaseAuth = new SupabaseAuth();

// Export for use in service worker
if (typeof self !== 'undefined') {
  self.supabaseAuth = supabaseAuth;
  self.SupabaseAuth = SupabaseAuth;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabaseAuth, SupabaseAuth };
}
