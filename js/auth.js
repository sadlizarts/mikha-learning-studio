// Login screen (DESIGN §5.1). Accounts are created by Dad in Supabase; public sign-up is off.
import { $, setMascot, toast } from './ui.js';
import { signIn, sendPasswordReset } from './store.js';
import { show, navigate } from './router.js';

export function renderLogin(onSignedIn) {
  show('login');
  setMascot($('#m-login'), 'happy');
  const form = $('#loginform'), err = $('#loginerr'), btn = $('#loginbtn');
  err.textContent = '';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#email').value, pw = $('#pw').value;
    if (!email || !pw) { err.textContent = 'Type your email and password.'; return; }
    btn.disabled = true; btn.textContent = 'Opening…'; err.textContent = '';
    try {
      const session = await signIn(email, pw);
      $('#pw').value = '';
      await onSignedIn(session);
      navigate('#/home', { replace: true });
    } catch (ex) {
      err.textContent = ex.message;
      setMascot($('#m-login'), 'sad', 'sad');
    } finally {
      btn.disabled = false; btn.textContent = 'Enter the Studio';
    }
  };
  $('#forgotbtn').onclick = async () => {
    const email = $('#email').value.trim();
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) { err.textContent = 'Type your email first, then tap Forgot password.'; $('#email').focus(); return; }
    const fb = $('#forgotbtn'); fb.disabled = true; err.textContent = '';
    try { await sendPasswordReset(email); toast('Check your email for a reset link. Open it on this device.', 5000); }
    catch (ex) { err.textContent = ex.message; }
    finally { fb.disabled = false; }
  };
  setTimeout(() => $('#email').focus(), 50);
}
