// Login screen (DESIGN §5.1). Accounts are created by Dad in Supabase; public sign-up is off.
import { $, setMascot } from './ui.js';
import { signIn } from './store.js';
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
  setTimeout(() => $('#email').focus(), 50);
}
