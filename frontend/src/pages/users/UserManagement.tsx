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
  role: 'admin' | 'station';
  isActive: boolean;
  createdAt: string;
}

export const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'station'>('station');

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
      setRole('station');
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Police Station Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Add new police stations and manage their system access.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
          <UserPlus className="h-4.5 w-4.5" /> Add Police Station
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-dark-900 text-xs font-semibold text-slate-500 uppercase border-b border-slate-150 dark:border-dark-800">
                  <th className="px-6 py-4.5">Account Name</th>
                  <th className="px-6 py-4.5">Role</th>
                  <th className="px-6 py-4.5">Account Status</th>
                  <th className="px-6 py-4.5">Registered</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-slate-450">Loading stations...</td>
                  </tr>
                ) : users && users.length > 0 ? (
                  users.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-900/10">
                      <td className="px-6 py-4.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-450">{item.email}</p>
                      </td>
                      <td className="px-6 py-4.5">
                        <Badge variant={item.role === 'admin' ? 'danger' : 'primary'}>
                          {item.role === 'station' ? 'POLICE STATION' : item.role.toUpperCase()}
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
                    <td colSpan={5} className="p-6 text-center text-xs text-slate-450">No stations listed.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Police Station">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input label="Police Station Name" placeholder="Central Station" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email/Username" type="email" placeholder="central@police.gov" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">
              Account Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'station')}
              className="w-full px-4 py-2.5 text-[13px] rounded-xl border bg-white text-slate-900 border-slate-200 hover:border-slate-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
            >
              <option value="station">Police Station</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Add Station</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default UserManagement;
