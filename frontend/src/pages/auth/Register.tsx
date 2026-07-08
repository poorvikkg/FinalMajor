import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldPlus } from 'lucide-react';
import api from '../../api';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Role is locked to viewer for public signup
      await api.post('/auth/register', { name, email, password, role: 'viewer' });
      setSuccess('Account created successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white border border-slate-300 p-8 rounded shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded">
              <ShieldPlus className="h-8 w-8 text-black" />
            </div>
            <h1 className="text-xl font-black text-black tracking-widest uppercase">Register Credentials</h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Initialize User Clearance</p>
          </div>

          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded font-semibold text-center uppercase tracking-wider">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded font-semibold text-center uppercase tracking-wider">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Officer Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white border-slate-300 text-slate-900 focus:ring-black"
              required
            />

            <Input
              label="Username / Email Address"
              type="text"
              placeholder="e.g. officer123 or officer@sentinel.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white border-slate-300 text-slate-900 focus:ring-black"
              required
            />
            
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white border-slate-300 text-slate-900 focus:ring-black"
              required
            />

            <Button type="submit" className="w-full py-2.5 uppercase text-xs tracking-widest font-bold" isLoading={isLoading}>
              Submit Credentials
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Register;
