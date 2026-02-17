import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminUsers } from '@/hooks/useAdminStats';
import { Search, Users, Eye, Phone, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function UsersManagement() {
  const { data: users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const filteredUsers = users?.filter(user =>
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.phone?.includes(search)
  );

  const totalUsers = users?.length || 0;
  const adminCount = users?.filter(u => u.roles?.includes('admin')).length || 0;
  const partnerCount = users?.filter(u => u.roles?.includes('sellercloud')).length || 0;

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Foydalanuvchilar ({totalUsers})
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">{totalUsers} jami</Badge>
          <Badge className="bg-red-500 text-white text-xs">{adminCount} admin</Badge>
          <Badge className="bg-amber-500 text-white text-xs">{partnerCount} hamkor</Badge>
          <Badge variant="outline" className="text-xs">{totalUsers - adminCount - partnerCount} oddiy</Badge>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ism yoki telefon..."
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
              <TableHead>Manzil</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Ro'yxatdan o'tgan</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers?.map((user) => {
              const hasSubscription = user.roles?.includes('sellercloud');
              const isAdmin = user.roles?.includes('admin');
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name || 'Noma\'lum'}</TableCell>
                  <TableCell>
                    {user.phone ? (
                      <a href={`tel:${user.phone}`} className="text-primary hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {user.phone}
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {user.city || user.region || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {isAdmin && <Badge className="bg-red-500 text-white text-xs">Admin</Badge>}
                      {hasSubscription && <Badge className="bg-amber-500 text-white text-xs">Hamkor</Badge>}
                      {!isAdmin && !hasSubscription && <Badge variant="secondary" className="text-xs">Foydalanuvchi</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(user.created_at), 'dd.MM.yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedUser(user)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredUsers?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Foydalanuvchilar topilmadi</p>
        )}

        {/* User Detail Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedUser?.full_name || 'Foydalanuvchi'}</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Telefon</p>
                    {selectedUser.phone ? (
                      <a href={`tel:${selectedUser.phone}`} className="font-medium text-primary hover:underline">{selectedUser.phone}</a>
                    ) : (
                      <p className="font-medium text-muted-foreground">—</p>
                    )}
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />Manzil</p>
                    <p className="font-medium">{[selectedUser.city, selectedUser.region, selectedUser.address].filter(Boolean).join(', ') || '—'}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Ro'yxatdan o'tgan</p>
                    <p className="font-medium">{format(new Date(selectedUser.created_at), 'dd.MM.yyyy HH:mm')}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-xs">Holat</p>
                    <div className="flex gap-1 mt-1">
                      {selectedUser.roles?.includes('admin') && <Badge className="bg-red-500 text-white text-xs">Admin</Badge>}
                      {selectedUser.roles?.includes('sellercloud') && <Badge className="bg-amber-500 text-white text-xs">Hamkor</Badge>}
                      {!selectedUser.roles?.includes('admin') && !selectedUser.roles?.includes('sellercloud') && (
                        <Badge variant="secondary" className="text-xs">Foydalanuvchi</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
