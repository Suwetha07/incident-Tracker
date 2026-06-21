import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/shared/Cards';

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);
  const [form, setForm] = useState({
    fullName: 'Suwetha',
    email: 'suwetha@example.com',
    phone: '+91 98765 43210',
    organizationName: 'Cloud Native Solutions',
    username: 'suwetha',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    captcha: false,
  });

  const submit = () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone,
        organization: form.organizationName,
        designation: 'DevOps Engineer',
      })
    );
    setEmailSent(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid gap-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4 md:grid-cols-4">
        {['Register Account', 'Email Verification', 'Login', 'Workspace and Cluster'].map(
          (step, index) => (
            <div key={step} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="text-sm font-medium text-gray-200">{step}</span>
            </div>
          )
        )}
      </div>

      <Card title="MVP Registration">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-semibold uppercase text-gray-400">Basic Information</h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-300">
                  Full Name
                  <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </label>
                <label className="text-sm text-gray-300">
                  Email Address
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label className="text-sm text-gray-300">
                  Phone Number
                  <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label className="text-sm text-gray-300">
                  Username
                  <input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </label>
                <label className="text-sm text-gray-300">
                  Password
                  <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
                <label className="text-sm text-gray-300">
                  Confirm Password
                  <input type="password" className={inputClass} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                </label>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold uppercase text-gray-400">Company Information</h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-300">
                  Organization Name
                  <input className={inputClass} value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
                </label>
                <label className="text-sm text-gray-300">
                  Team Name
                  <input className={inputClass} defaultValue="CloudOps Team" />
                </label>
                <label className="text-sm text-gray-300 md:col-span-2">
                  Industry Optional
                  <input className={inputClass} placeholder="SaaS, Banking, Healthcare, Retail" />
                </label>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold uppercase text-gray-400">Security</h4>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-3 text-sm text-gray-300">
                  <input type="checkbox" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
                  Accept Terms and Conditions
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-300">
                  <input type="checkbox" checked={form.captcha} onChange={(e) => setForm({ ...form, captcha: e.target.checked })} />
                  CAPTCHA verified
                </label>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <button className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800" onClick={() => navigate('/login')}>
                Go to Login
              </button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={submit}>
                Register Account
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-blue-800 bg-blue-950/30 p-5">
            <h4 className="font-semibold text-white">After email verification</h4>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <p>Create a workspace and add its Kubernetes cluster from Workspace Setup.</p>
              <p>Connect Prometheus, Grafana, and Loki endpoints for that cluster.</p>
              <p>Start Monitoring</p>
            </div>
            {emailSent && (
              <div className="mt-5 rounded-lg border border-green-700 bg-green-900/20 p-4 text-sm text-green-200">
                Verification email sent to {form.email}. Continue to login after verification.
              </div>
            )}
          </aside>
        </div>
      </Card>
    </div>
  );
};
