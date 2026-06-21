import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';

const inputClass =
  'w-full rounded-2xl border border-white/20 bg-white/20 px-5 py-4 text-center text-lg font-bold text-white placeholder-white/55 shadow-[0_8px_18px_rgba(0,0,0,0.22)] outline-none backdrop-blur transition focus:border-white/60 focus:bg-white/25';

type Account = {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  organizationName: string;
  designation: string;
};

const getAccounts = (): Account[] => {
  const raw = localStorage.getItem('registeredUsers');
  return raw ? JSON.parse(raw) : [];
};

type EntraClaims = {
  name?: string;
  preferred_username?: string;
  email?: string;
  oid?: string;
};

const decodeJwtPayload = (token: string): EntraClaims => {
  const payload = token.split('.')[1];
  if (!payload) return {};

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  const decodedPayload = window.atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));

  return JSON.parse(decodedPayload) as EntraClaims;
};

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [message, setMessage] = useState('');
  const [login, setLogin] = useState({ username: '', password: '' });
  const [form, setForm] = useState<Account>({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    organizationName: '',
    designation: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const idToken = params.get('id_token');
    const error = params.get('error_description') || params.get('error');

    if (error) {
      const isIdTokenDisabled = error.includes('AADSTS700054');
      showToast({
        type: 'error',
        title: isIdTokenDisabled ? 'Enable ID tokens in Azure' : 'Microsoft login failed',
        message: isIdTokenDisabled
          ? 'In App Registration > Authentication, enable ID tokens for implicit and hybrid flows.'
          : error,
      });
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (!idToken) return;

    try {
      const claims = decodeJwtPayload(idToken);
      const email = claims.preferred_username || claims.email || '';

      localStorage.setItem('token', idToken);
      localStorage.setItem(
        'user',
        JSON.stringify({
          name: claims.name || email || 'Microsoft Entra User',
          username: email || claims.oid || 'entra-user',
          email,
          organization: 'Microsoft Entra ID',
          designation: 'DevOps Engineer',
        })
      );
      window.history.replaceState(null, '', window.location.pathname);
      showToast({
        type: 'success',
        title: 'Microsoft login successful',
        message: claims.name || email || 'Signed in with Microsoft Entra ID.',
      });
      navigate('/dashboard');
    } catch {
      showToast({
        type: 'error',
        title: 'Microsoft login failed',
        message: 'Unable to read Microsoft identity token.',
      });
    }
  }, [navigate]);

  const createAccount = () => {
    setMessage('');

    if (!form.fullName || !form.email || !form.phone || !form.username || !form.password || !form.organizationName) {
      setMessage('Please fill all required account details.');
      showToast({
        type: 'error',
        title: 'Required details missing',
        message: 'Please fill all required account details.',
      });
      return;
    }

    if (form.password !== confirmPassword) {
      setMessage('Password and confirm password must match.');
      showToast({
        type: 'error',
        title: 'Password mismatch',
        message: 'Password and confirm password must match.',
      });
      return;
    }

    if (!acceptTerms) {
      setMessage('Accept terms and conditions.');
      showToast({
        type: 'warning',
        title: 'Accept terms and conditions',
        message: 'You must accept terms and conditions before creating a user.',
      });
      return;
    }

    const accounts = getAccounts();
    if (accounts.some((account) => account.username === form.username || account.email === form.email)) {
      setMessage('An account with this username or email already exists.');
      showToast({
        type: 'warning',
        title: 'Account exists',
        message: 'Use another username or email.',
      });
      return;
    }

    localStorage.setItem('registeredUsers', JSON.stringify([...accounts, form]));
    setLogin({ username: form.username, password: '' });
    setConfirmPassword('');
    setAcceptTerms(false);
    setMode('login');
    setMessage('Account created. Please login with your username and password.');
    showToast({
      type: 'success',
      title: 'Account created',
      message: 'Please login with your username and password.',
    });
  };

  const loginUser = () => {
    setMessage('');
    const account = getAccounts().find(
      (item) =>
        (item.username === login.username || item.email === login.username) &&
        item.password === login.password
    );

    if (!account) {
      setMessage('Invalid username or password. Create a user first if you do not have an account.');
      showToast({
        type: 'error',
        title: 'Login failed',
        message: 'Invalid username or password.',
      });
      return;
    }

    localStorage.setItem('token', `demo-token-${account.username}`);
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: account.fullName,
        username: account.username,
        email: account.email,
        phone: account.phone,
        organization: account.organizationName,
        designation: account.designation || 'DevOps Engineer',
      })
    );
    showToast({
      type: 'success',
      title: 'Login successful',
      message: `Welcome ${account.fullName}.`,
    });
    navigate('/dashboard');
  };

  const loginWithEntra = () => {
    const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || 'common';
    const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth`;

    if (!clientId) {
      showToast({
        type: 'error',
        title: 'Microsoft Entra ID not configured',
        message: 'Add VITE_ENTRA_CLIENT_ID in frontend/web-app/.env.local.',
      });
      return;
    }

    const nonce = crypto.randomUUID();
    sessionStorage.setItem('entra_nonce', nonce);
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'fragment');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('nonce', nonce);

    window.location.href = authUrl.toString();
  };

  return (
    <div className="auth-blue-bg min-h-screen px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col items-center">
        <h1 className="mt-10 text-center text-4xl font-extrabold uppercase tracking-[0.15em] text-white md:text-5xl leading-tight">
          Kubernetes <br className="hidden md:block" /> Incident Management
        </h1>

        <div className="mt-16 w-full max-w-md">
          {message && (
            <div className="mb-5 rounded-2xl border border-white/30 bg-white/20 p-4 text-center text-sm font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)] backdrop-blur">
              {message}
            </div>
          )}

          {mode === 'login' ? (
            <div className="space-y-7">
              <input
                className={inputClass}
                placeholder="email / username"
                value={login.username}
                onChange={(e) => setLogin({ ...login, username: e.target.value })}
              />
              <input
                type="password"
                className={inputClass}
                placeholder="password"
                value={login.password}
                onChange={(e) => setLogin({ ...login, password: e.target.value })}
              />
              <div className="flex justify-center">
                <button
                  className="rounded-2xl bg-blue-600 px-8 py-3 text-base font-extrabold uppercase text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition hover:bg-blue-500"
                  onClick={loginUser}
                >
                  Login
                </button>
              </div>

              <p className="text-center text-base font-bold text-white">
                Don't have account?{' '}
                <button
                  className="font-extrabold text-yellow-300 hover:text-yellow-200"
                  onClick={() => {
                    setMode('create');
                    setMessage('');
                    showToast({
                      type: 'info',
                      title: 'Create user',
                      message: 'Fill the registration form to create a user.',
                    });
                  }}
                >
                  Register
                </button>
              </p>

              <div className="flex items-center gap-5">
                <div className="h-px flex-1 bg-white/60" />
                <p className="text-sm font-extrabold uppercase text-white">Or login with</p>
                <div className="h-px flex-1 bg-white/60" />
              </div>

              <button
                className="mx-auto flex h-11 min-w-64 items-center justify-center gap-3 rounded-2xl bg-white px-5 text-sm font-extrabold text-gray-700 shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition hover:bg-gray-100"
                onClick={loginWithEntra}
              >
                <span className="grid h-5 w-5 grid-cols-2 gap-0.5">
                  <span className="bg-[#f25022]" />
                  <span className="bg-[#7fba00]" />
                  <span className="bg-[#00a4ef]" />
                  <span className="bg-[#ffb900]" />
                </span>
                Microsoft Entra ID
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/20 bg-white/15 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-extrabold text-white">Create User</h2>
                <button
                  className="text-sm font-extrabold text-yellow-300 hover:text-yellow-200"
                  onClick={() => {
                    setMode('login');
                    setMessage('');
                    showToast({
                      type: 'info',
                      title: 'Back to login',
                      message: 'Login form is ready.',
                    });
                  }}
                >
                  Back to Login
                </button>
              </div>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Basic Information</h4>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-white">
                    Full Name
                    <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-white">
                    Email Address
                    <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-white">
                    Phone Number
                    <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-white">
                    Username
                    <input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-white">
                    Password
                    <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-white">
                    Confirm Password
                    <input type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </label>
                </div>
              </section>

              <section className="mt-6">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Company Information</h4>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-white">
                    Organization Name
                    <input className={inputClass} value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-white">
                    Designation
                    <input className={inputClass} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                  </label>
                </div>
              </section>

              <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-white">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                Accept Terms and Conditions
              </label>

              <button className="mt-5 rounded-2xl bg-blue-600 px-7 py-3 text-sm font-extrabold uppercase text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition hover:bg-blue-500" onClick={createAccount}>
                Create User
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
