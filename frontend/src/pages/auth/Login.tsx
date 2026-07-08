import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

import api from '../../api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const response = await api.post('/auth/login', { email: loginEmail, password: loginPassword });
      const { user, token } = response.data.data;
      setAuth(user, token);
      navigate('/');
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setRegLoading(true);
    try {
      await api.post('/auth/register', { name: regName, email: regEmail, password: regPassword, role: 'viewer' });
      setRegSuccess('Account created. You can now sign in.');
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setTimeout(() => {
        setTab('login');
        setRegSuccess(null);
      }, 1800);
    } catch (err: any) {
      setRegError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white border border-slate-300 rounded shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-2 pt-8 px-8">
            <h1 className="text-xl font-black text-black tracking-widest uppercase">Sentinel Console</h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Access Authorization</p>
          </div>

          {/* Tab buttons */}
          <div className="flex border-b border-slate-200 mt-6">
            <button
              onClick={() => { setTab('login'); setLoginError(null); }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                tab === 'login'
                  ? 'border-b-2 border-black text-black bg-white'
                  : 'text-slate-400 hover:text-slate-600 bg-slate-50'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setRegError(null); setRegSuccess(null); }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                tab === 'register'
                  ? 'border-b-2 border-black text-black bg-white'
                  : 'text-slate-400 hover:text-slate-600 bg-slate-50'
              }`}
            >
              Register
            </button>
          </div>

          <div className="p-8 space-y-4">
            {/* LOGIN FORM */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded font-semibold text-center uppercase tracking-wider">
                    {loginError}
                  </div>
                )}
                <Input
                  label="Username / Email Address"
                  type="text"
                  placeholder="e.g. admin@123"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 focus:ring-black"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 focus:ring-black"
                  required
                />
                <Button type="submit" className="w-full py-2.5 uppercase text-xs tracking-widest font-bold" isLoading={loginLoading}>
                  Authorize Sign In
                </Button>
              </form>
            )}

            {/* REGISTER FORM */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded font-semibold text-center uppercase tracking-wider">
                    {regError}
                  </div>
                )}
                {regSuccess && (
                  <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded font-semibold text-center uppercase tracking-wider">
                    {regSuccess}
                  </div>
                )}
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="Officer Name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 focus:ring-black"
                  required
                />
                <Input
                  label="Username / Email Address"
                  type="text"
                  placeholder="e.g. officer123 or officer@sentinel.ai"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 focus:ring-black"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 focus:ring-black"
                  required
                />
                <Button type="submit" className="w-full py-2.5 uppercase text-xs tracking-widest font-bold" isLoading={regLoading}>
                  Submit Credentials
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
