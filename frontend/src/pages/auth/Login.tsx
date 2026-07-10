import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

import api from '../../api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white border border-slate-300 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-2 pt-10 px-8 pb-6 border-b border-slate-100">
            <h1 className="text-2xl font-black text-slate-900 tracking-widest uppercase font-heading">MPDS</h1>
          </div>

          <div className="p-8 space-y-4 bg-white/50 backdrop-blur-sm">
            {/* LOGIN FORM */}
            <form onSubmit={handleLogin} className="space-y-5">
              {loginError && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold text-center uppercase tracking-wider">
                  {loginError}
                </div>
              )}
              <Input
                label="Police Station Name"
                type="text"
                placeholder="e.g. Central Police Station"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="bg-white border-slate-300 text-slate-900 focus:ring-slate-900 rounded-xl"
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="bg-white border-slate-300 text-slate-900 focus:ring-slate-900 rounded-xl"
                required
              />
              <div className="pt-2">
                <Button type="submit" className="w-full py-3 uppercase text-[13px] tracking-widest font-bold" isLoading={loginLoading}>
                  Authorize Login
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
