import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminUsers } from '@/hooks/useAdminStats';
import { Search, Users, Eye, Phone, MapPin, Calendar, UserPlus, AlertCircle, Mail } from 'lucide-react';
import { format } from 'date-fns';

export function UsersManagement() {
  const { data: users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'active' | 'admin'>('all');

  const filteredUsers = users?.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.includes(search) ||
      (user as any).email?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    
    switch (filter) {
      case 'new': return !user.roles?.includes('sellercloud') && !user.roles?.includes('admin');
      case 'active': return user.roles?.includes('sellercloud');
      case 'admin': return user.roles?.includes('admin');
      default: return true;
    }
  });

  const totalUsers = users?.length || 0;
  const adminCount = users?.filter(u => u.roles?.includes('admin')).length || 0;
  const partnerCount = users?.filter(u => u.roles?.includes('sellercloud')).length || 0;
  const newUsersCount = totalUsers - adminCount - partnerCount;

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
          <Badge 
            variant={filter === 'all' ? 'default' : 'secondary'} 
            className="text-xs cursor-pointer"
            onClick={() => setFilter('all')}
          >
            {totalUsers} jami
          </Badge>
          <Badge 
            className={`text-xs cursor-pointer ${filter === 'new' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}
            onClick={() => setFilter('new')}
          >
            <UserPlus className="h-3 w-3 mr-1" />
            {newUsersCount} yangi
          </Badge>
          <Badge 
            className={`text-xs cursor-pointer ${filter === 'active' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'}`}
            onClick={() => setFilter('active')}
          >
            {partnerCount} hamkor
          </Badge>
          <Badge 
            className={`text-xs cursor-pointer ${filter === 'admin' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}
            onClick={() => setFilter('admin')}
          >
            {adminCount} admin
          </Badge>
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
        {/* Highlight new unactivated users */}
        {newUsersCount > 0 && filter === 'all' && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-blue-700 dark:text-blue-300">{newUsersCount} ta yangi foydalanuvchi</span>
              <span className="text-blue-600 dark:text-blue-400"> — hali obuna bo'lmagan. Ular bilan bog'laning!</span>
            </div>
          </div>
        )}
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
              const isNew = !hasSubscription && !isAdmin;
              return (
                <TableRow key={user.id} className={isNew ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}>
                  <TableCell className="font-medium">
                    {user.full_name || 'Noma\'lum'}
                    {isNew && <Badge variant="outline" className="ml-2 text-[10px] border-blue-400 text-blue-600">YANGI</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {user.phone ? (
                        <a href={`tel:${user.phone}`} className="text-primary hover:underline flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </a>
                      ) : null}
                      {(user as any).email ? (
                        <a href={`mailto:${(user as any).email}`} className="text-muted-foreground hover:underline flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3" />
                          {(user as any).email}
                        </a>
                      ) : null}
                      {!user.phone && !(user as any).email && <span className="text-destructive text-xs">Ma'lumot yo'q</span>}
                    </div>
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
                      {hasSubscription && <Badge className="bg-emerald-500 text-white text-xs">Hamkor</Badge>}
                      {isNew && <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">Yangi</Badge>}
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
                {/* Show warning if new user without subscription */}
                {!selectedUser.roles?.includes('sellercloud') && !selectedUser.roles?.includes('admin') && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
                    <p className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <UserPlus className="h-4 w-4" /> Yangi foydalanuvchi — hali obuna bo'lmagan
                    </p>
                    <p className="text-blue-600 dark:text-blue-400 mt-1">Bu foydalanuvchi bilan bog'lanib, obunani aktivlashtirish mumkin.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Telefon</p>
                    {selectedUser.phone ? (
                      <a href={`tel:${selectedUser.phone}`} className="font-medium text-primary hover:underline">{selectedUser.phone}</a>
                    ) : (
                      <p className="font-medium text-muted-foreground">—</p>
                    )}
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                    <p className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</p>
                    {(selectedUser as any).email ? (
                      <a href={`mailto:${(selectedUser as any).email}`} className="font-medium text-primary hover:underline">{(selectedUser as any).email}</a>
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
                      {selectedUser.roles?.includes('sellercloud') && <Badge className="bg-emerald-500 text-white text-xs">Hamkor</Badge>}
                      {!selectedUser.roles?.includes('admin') && !selectedUser.roles?.includes('sellercloud') && (
                        <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">Yangi</Badge>
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
