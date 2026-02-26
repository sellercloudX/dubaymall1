import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const phoneSchema = z.string().regex(/^\+998\d{9}$/, 'Telefon raqami noto\'g\'ri');

export function PhoneCompletionDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('+998 ');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: needsPhone } = useQuery({
    queryKey: ['phone-check', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      return !data?.phone || data.phone.trim() === '';
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d+]/g, '');
    if (!value.startsWith('+998')) {
      value = '+998' + value.replace(/^\+?998?/, '');
    }
    // Format: +998 XX XXX XX XX
    if (value.length > 4) {
      const parts = [value.slice(0, 4)];
      if (value.length > 4) parts.push(value.slice(4, 6));
      if (value.length > 6) parts.push(value.slice(6, 9));
      if (value.length > 9) parts.push(value.slice(9, 11));
      if (value.length > 11) parts.push(value.slice(11, 13));
      value = parts.join(' ');
    }
    setPhone(value);
    if (error) setError('');
  };

  const handleSave = async () => {
    const cleanPhone = phone.replace(/\s/g, '');
    const result = phoneSchema.safeParse(cleanPhone);
    if (!result.success) {
      setError('Telefon raqami noto\'g\'ri. Masalan: +998 90 123 45 67');
      return;
    }

    setSaving(true);
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ phone: cleanPhone })
      .eq('user_id', user!.id);

    if (dbError) {
      toast.error('Xatolik: ' + dbError.message);
    } else {
      toast.success('Telefon raqami saqlandi!');
      queryClient.setQueryData(['phone-check', user!.id], false);
    }
    setSaving(false);
  };

  if (!needsPhone) return null;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Telefon raqamingizni kiriting
          </DialogTitle>
          <DialogDescription>
            Biz siz bilan bog'lanishimiz uchun telefon raqamingiz kerak. Iltimos, to'g'ri raqam kiriting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="completion-phone">Telefon raqami *</Label>
            <Input
              id="completion-phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+998 90 123 45 67"
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
