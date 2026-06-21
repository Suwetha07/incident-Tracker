import React, { useState } from 'react';
import { Card } from '../components/shared/Cards';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const submit = () => {
    // Mock login
    localStorage.setItem('token', 'demo-token');
    localStorage.setItem('user', JSON.stringify({ username: 'suwetha', email }));
    navigate('/dashboard');
  };

  return (
    <div className="max-w-md">
      <Card title="Login">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300">Email</label>
            <input className="mt-1 w-full rounded bg-gray-800 px-3 py-2 text-white" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-300">Password</label>
            <input type="password" className="mt-1 w-full rounded bg-gray-800 px-3 py-2 text-white" value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>
          <div className="flex justify-between items-center">
            <button className="rounded bg-blue-600 px-4 py-2" onClick={submit}>Login</button>
            <a className="text-sm text-blue-400" href="/register">Register</a>
          </div>
        </div>
      </Card>
    </div>
  );
};
