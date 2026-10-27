// Goodfastpay Platform - Authentication UI Handlers
// This script provides UI interactions for the auth modal and integrates with Supabase Auth.

// Open the authentication modal. mode = 'login' | 'register'
function openAuthModal(mode = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('active');
  toggleAuthTab(mode);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
}

function toggleAuthTab(mode) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const title = document.getElementById('auth-modal-title');
  const btnLogin = document.getElementById('btn-toggle-login');
  const btnRegister = document.getElementById('btn-toggle-register');

  if (mode === 'register') {
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (title) title.textContent = 'Create Account';
    if (btnLogin) btnLogin.classList.remove('active');
    if (btnRegister) btnRegister.classList.add('active');
  } else {
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (title) title.textContent = 'Sign In';
    if (btnLogin) btnLogin.classList.add('active');
    if (btnRegister) btnRegister.classList.remove('active');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  console.log('Login submit triggered', { email });
  if (!email || !password) {
    showToast('Please provide both email and password.', 'danger');
    return;
  }
  try {
    const client = await window.getSupabaseClient?.();
    if (!client) throw new Error('Supabase client not ready');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Sync local user store
    if (typeof syncLocalUserAccount === 'function') {
      const sbUser = data.user;
      syncLocalUserAccount(email, {
        id: sbUser.id,
        name: sbUser.user_metadata?.full_name || email.split('@')[0],
        phone: sbUser.user_metadata?.phone || ''
      });
    }
    window.localStorage.setItem('sessionUser', email);
    closeAuthModal();
    setTimeout(() => { window.location.href = 'portal.html'; }, 300);
  } catch (err) {
    console.error('Login error:', err);
    showToast(err.message || 'Login failed. Please try again.', 'danger');
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name')?.value?.trim();
  const email = document.getElementById('reg-email')?.value?.trim();
  const phone = document.getElementById('reg-phone')?.value?.trim();
  const password = document.getElementById('reg-password')?.value;
  if (!email || !password) {
    showToast('Email and password are required.', 'danger');
    return;
  }
  try {
    const client = await window.getSupabaseClient?.();
    if (!client) throw new Error('Supabase client not ready');
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || email.split('@')[0], phone }
      }
    });
    if (error) throw error;
    // Store locally and prompt for verification step (OTP modal will handle it)
    if (typeof syncLocalUserAccount === 'function') {
      syncLocalUserAccount(email, {
        id: data.user.id,
        name: name || email.split('@')[0],
        phone: phone || ''
      });
    }
    // Open OTP verification modal – we reuse the existing modal logic
    openOtpModal(email, 'register');
  } catch (err) {
    console.error('Register error:', err);
    showToast(err.message || 'Registration failed.', 'danger');
  }
}

function quickMobileDemoLogin() {
  // Demo credentials – replace with a real demo account if available.
  const demoEmail = 'demo@goodfastpay.com';
  const demoPassword = 'demopassword';
  // Populate fields and submit programmatically.
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  if (emailEl && passEl) {
    emailEl.value = demoEmail;
    passEl.value = demoPassword;
    // Trigger submit handler directly.
    handleLoginSubmit(new Event('submit'));
  }
}

// Expose functions globally for inline onclick attributes.
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthTab = toggleAuthTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.quickMobileDemoLogin = quickMobileDemoLogin;
// Supabase auth wrapper functions for UI code
async function supabaseAuthSignIn(email, password) {
  try {
    const client = await window.getSupabaseClient?.();
    if (client) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Signed in', data };
    } else {
      // Local fallback using mock DB
      const db = getDB();
      const user = db.users[email];
      if (user && user.passwordHash === password) {
        return { success: true, message: 'Signed in (local fallback)', data: { user } };
      }
      return { success: false, message: 'Invalid credentials (local fallback)' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function supabaseAuthSignOut() {
  try {
    const client = await window.getSupabaseClient?.();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) return { success: false, message: error.message };
    }
    if (typeof clearSession === 'function') clearSession();
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// expose globally
window.supabaseAuthSignIn = supabaseAuthSignIn;
window.supabaseAuthSignOut = supabaseAuthSignOut;
