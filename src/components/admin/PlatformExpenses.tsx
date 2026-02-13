import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Plus, DollarSign, Zap, Server, Megaphone, Headphones, MoreHorizontal, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const USD_RATE = 12800;

const EXPENSE_TYPES = [
  { value: 'ai_usage', label: 'AI rasxodi', icon: Zap, color: '#f97316' },
  { value: 'infrastructure', label: 'Infrastruktura', icon: Server, color: '#3b82f6' },
  { value: 'api_call', label: 'API chaqiruvlari', icon: RefreshCw, color: '#8b5cf6' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: '#ec4899' },
  { value: 'support', label: "Qo'llab-quvvatlash", icon: Headphones, color: '#10b981' },
  { value: 'other', label: 'Boshqa', icon: MoreHorizontal, color: '#6b7280' },
];

export function PlatformExpenses() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({
    expense_type: 'ai_usage',
    category: '',
    amount: '',
    currency: 'USD',
    description: '',
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['platform-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_expenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: aiUsage } = useQuery({
    queryKey: ['ai-usage-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('action_type, estimated_cost_usd, model_used, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      // Group by action type
      const byType = new Map<string, { count: number; cost: number }>();
      data?.forEach(d => {
        const existing = byType.get(d.action_type) || { count: 0, cost: 0 };
        byType.set(d.action_type, {
          count: existing.count + 1,
          cost: existing.cost + (d.estimated_cost_usd || 0),
        });
      });

      // Group by day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const byDay: { date: string; cost: number; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayData = data?.filter(r => r.created_at.startsWith(dateStr)) || [];
        byDay.push({
          date: d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }),
          cost: dayData.reduce((s, r) => s + (r.estimated_cost_usd || 0), 0),
          count: dayData.length,
        });
      }

      return {
        byType: Array.from(byType.entries()).map(([type, data]) => ({ type, ...data })),
        byDay,
        totalCost: data?.reduce((s, r) => s + (r.estimated_cost_usd || 0), 0) || 0,
        totalActions: data?.length || 0,
      };
    },
  });

  // Summary by type
  const expenseSummary = EXPENSE_TYPES.map(t => {
    const typeExpenses = expenses?.filter(e => e.expense_type === t.value) || [];
    const total = typeExpenses.reduce((s, e) => {
      return s + (e.currency === 'USD' ? e.amount * USD_RATE : e.amount);
    }, 0);
    return { ...t, total, count: typeExpenses.length };
  }).filter(t => t.count > 0 || t.value === 'ai_usage');

  const totalExpensesUZS = expenseSummary.reduce((s, t) => s + t.total, 0);

  const handleAdd = async () => {
    if (!form.amount || !form.expense_type) return;
    try {
      const { error } = await supabase.from('platform_expenses').insert({
        expense_type: form.expense_type,
        category: form.category || null,
        amount: parseFloat(form.amount),
        currency: form.currency,
        description: form.description || null,
      });
      if (error) throw error;
      toast.success('Xarajat qo\'shildi');
      queryClient.invalidateQueries({ queryKey: ['platform-expenses'] });
      setShowAddDialog(false);
      setForm({ expense_type: 'ai_usage', category: '', amount: '', currency: 'USD', description: '' });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const ACTION_LABELS: Record<string, string> = {
    product_scan: 'Mahsulot skaneri',
    infographic: 'Infografika',
    content_generation: 'Kontent yaratish',
    image_enhance: 'Rasm yaxshilash',
    pinterest_search: 'Pinterest qidiruv',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Platforma xarajatlari</h2>
          <p className="text-sm text-muted-foreground">AI, infrastruktura va operatsion rasxodlar</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Xarajat qo'shish</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yangi xarajat</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Turi</Label>
                <Select value={form.expense_type} onValueChange={v => setForm(f => ({ ...f, expense_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kategoriya</Label>
                <Input placeholder="gemini_pro, server, ads..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Summa</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <Label>Valyuta</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="UZS">UZS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Tavsif</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd}>Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-red-500/10 to-red-500/5">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Jami xarajat</p>
            <p className="text-xl font-bold text-red-600">
              {totalExpensesUZS >= 1e6 ? (totalExpensesUZS / 1e6).toFixed(1) + ' mln' : totalExpensesUZS.toLocaleString()} so'm
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-orange-500/10 to-orange-500/5">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">AI rasxodi (jami)</p>
            <p className="text-xl font-bold text-orange-600">${(aiUsage?.totalCost || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-500/10 to-blue-500/5">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">AI amallar soni</p>
            <p className="text-xl font-bold">{aiUsage?.totalActions || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">O'rtacha AI/amal</p>
            <p className="text-xl font-bold text-emerald-600">
              ${aiUsage && aiUsage.totalActions > 0 ? (aiUsage.totalCost / aiUsage.totalActions).toFixed(3) : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ai">AI rasxodlar</TabsTrigger>
          <TabsTrigger value="all">Barcha xarajatlar</TabsTrigger>
          <TabsTrigger value="breakdown">Taqsimot</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <div className="grid md:grid-cols-2 gap-6">
            {/* AI Daily Cost Chart */}
            <Card>
              <CardHeader><CardTitle className="text-base">Kunlik AI rasxodi</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={aiUsage?.byDay || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v.toFixed(2)} />
                    <Tooltip formatter={(v: number) => '$' + v.toFixed(3)} />
                    <Bar dataKey="cost" name="Narxi" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* AI By Action Type */}
            <Card>
              <CardHeader><CardTitle className="text-base">AI amal turlari</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiUsage?.byType.map(t => (
                    <div key={t.type} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{ACTION_LABELS[t.type] || t.type}</p>
                        <p className="text-xs text-muted-foreground">{t.count} ta amal</p>
                      </div>
                      <Badge variant="outline">${t.cost.toFixed(3)}</Badge>
                    </div>
                  ))}
                  {(!aiUsage?.byType || aiUsage.byType.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">Hali AI rasxodlari yo'q</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {expenses && expenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Turi</TableHead>
                      <TableHead>Kategoriya</TableHead>
                      <TableHead>Tavsif</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.slice(0, 50).map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(e.created_at), 'dd.MM.yy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{EXPENSE_TYPES.find(t => t.value === e.expense_type)?.label || e.expense_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{e.category || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.description || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {e.currency === 'USD' ? `$${e.amount.toFixed(2)}` : `${e.amount.toLocaleString()} so'm`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">Hali xarajatlar yo'q</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Xarajat turlari</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={expenseSummary.filter(s => s.total > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="total" nameKey="label"
                      label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                      {expenseSummary.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => v.toLocaleString() + " so'm"} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Xarajat reytingi</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expenseSummary.sort((a, b) => b.total - a.total).map(s => (
                    <div key={s.value} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm font-medium">{s.label}</span>
                      </div>
                      <span className="font-bold text-sm">
                        {s.total >= 1e6 ? (s.total / 1e6).toFixed(1) + ' mln' : s.total.toLocaleString()} so'm
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
