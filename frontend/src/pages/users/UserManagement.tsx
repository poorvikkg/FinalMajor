import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { UserPlus, Trash2 } from 'lucide-react';
import api from '../../api';

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  isActive: boolean;
  createdAt: string;
}

export const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'operator' | 'viewer'>('viewer');

  // Query users
  const { data: users, isLoading } = useQuery<UserItem[]>({
    queryKey: ['usersList'],
    queryFn: async () => {
      try {
        const response = await api.get('/users?limit=50');
        return response.data.data;
      } catch {
        return [] as UserItem[];
      }
    }
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setIsAddOpen(false);
      setName('');
      setEmail('');
      setPassword('');
    }
  });

  // Remove/Deactivate mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
    }
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, email, password, role });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">System Console Accounts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Create console users, override role access clearance, or disable accounts.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
          <UserPlus className="h-4.5 w-4.5" /> Register Operator Account
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-dark-900 text-xs font-semibold text-slate-500 uppercase border-b border-slate-150 dark:border-dark-800">
                  <th className="px-6 py-4.5">Account User</th>
                  <th className="px-6 py-4.5">System Access Role</th>
                  <th className="px-6 py-4.5">Account Status</th>
                  <th className="px-6 py-4.5">Registered</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-slate-450">Loading users...</td>
                  </tr>
                ) : users && users.length > 0 ? (
                  users.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-900/10">
                      <td className="px-6 py-4.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-450">{item.email}</p>
                      </td>
                      <td className="px-6 py-4.5">
                        <Badge variant={item.role === 'admin' ? 'danger' : item.role === 'operator' ? 'primary' : 'neutral'}>
                          {item.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4.5">
                        <Badge variant={item.isActive ? 'success' : 'neutral'}>
                          {item.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4.5 text-slate-450 text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                          disabled={item.role === 'admin'} // Protect primary admin account
                          onClick={() => deleteMutation.mutate(item._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-slate-450">No users listed.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Operator Account">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input label="Full Name" placeholder="John Connor" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email Address" type="email" placeholder="john@sentinel.ai" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Temporary Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
              Clearance Access Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-350 dark:border-dark-750 bg-white dark:bg-dark-800 text-slate-900 dark:text-slate-105"
            >
              <option value="viewer">Viewer (Read Only Console)</option>
              <option value="operator">Operator (Monitor + Uploads)</option>
              <option value="admin">Administrator (Full Access Override)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Register Account</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default UserManagement;
