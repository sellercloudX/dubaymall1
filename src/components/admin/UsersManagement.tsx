import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminUsers } from '@/hooks/useAdminStats';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, UserPlus, Shield } from 'lucide-react';
import { format } from 'date-fns';

const roleColors: Record<string, string> = {
  admin: 'bg-red-500',
  seller: 'bg-blue-500',
  blogger: 'bg-purple-500',
  buyer: 'bg-green-500',
};

export function UsersManagement() {
  const { data: users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const filteredUsers = users?.filter(user => 
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.phone?.includes(search)
  );

  const addRole = async (userId: string, role: 'seller' | 'blogger' | 'admin') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
      toast.success(`${role} roli qo'shildi`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error("Rol qo'shishda xatolik");
    }
  };

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Foydalanuvchilar boshqaruvi
        </CardTitle>
        <div className="flex items-center gap-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Rollar</TableHead>
              <TableHead>Ro'yxatdan o'tgan</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name || 'Noma\'lum'}</TableCell>
                <TableCell>{user.phone || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles?.map((role: string) => (
                      <Badge key={role} className={roleColors[role] || 'bg-gray-500'}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{format(new Date(user.created_at), 'dd.MM.yyyy')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!user.roles?.includes('seller') && (
                      <Button size="sm" variant="outline" onClick={() => addRole(user.user_id, 'seller')}>
                        <UserPlus className="h-3 w-3 mr-1" />
                        Sotuvchi
                      </Button>
                    )}
                    {!user.roles?.includes('blogger') && (
                      <Button size="sm" variant="outline" onClick={() => addRole(user.user_id, 'blogger')}>
                        <UserPlus className="h-3 w-3 mr-1" />
                        Blogger
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredUsers?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Foydalanuvchilar topilmadi</p>
        )}
      </CardContent>
    </Card>
  );
}
