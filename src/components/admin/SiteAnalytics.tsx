 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
 import { TrendingUp, Users, Eye, Globe, Clock, RefreshCw, Smartphone, Monitor, ArrowUpRight } from 'lucide-react';
 import { useQuery } from '@tanstack/react-query';
 
 interface AnalyticsData {
   totalPageviews: number;
   uniqueVisitors: number;
   avgSessionDuration: number;
   bounceRate: number;
   pageviewsByDay: { date: string; views: number; visitors: number }[];
   topPages: { path: string; views: number }[];
   deviceBreakdown: { device: string; count: number }[];
   trafficSources: { source: string; count: number }[];
 }
 
 const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#10b981', '#f59e0b'];
 
 export function SiteAnalytics() {
   const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
   
   const getDateRange = () => {
     const end = new Date();
     const start = new Date();
     if (period === '7d') start.setDate(end.getDate() - 7);
     else if (period === '30d') start.setDate(end.getDate() - 30);
     else start.setDate(end.getDate() - 90);
     return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
   };
 
   const { data: analytics, isLoading, refetch } = useQuery({
     queryKey: ['site-analytics', period],
     queryFn: async (): Promise<AnalyticsData> => {
       // This would integrate with your actual analytics
       // For now, generating realistic sample data
       const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
       const pageviewsByDay = Array.from({ length: Math.min(days, 30) }, (_, i) => {
         const date = new Date();
         date.setDate(date.getDate() - (days - 1 - i));
         return {
           date: date.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
           views: Math.floor(Math.random() * 500) + 100,
           visitors: Math.floor(Math.random() * 200) + 50,
         };
       });
 
       const totalPageviews = pageviewsByDay.reduce((sum, d) => sum + d.views, 0);
       const uniqueVisitors = pageviewsByDay.reduce((sum, d) => sum + d.visitors, 0);
 
       return {
         totalPageviews,
         uniqueVisitors,
         avgSessionDuration: Math.floor(Math.random() * 180) + 60,
         bounceRate: Math.floor(Math.random() * 30) + 35,
         pageviewsByDay,
         topPages: [
           { path: '/', views: Math.floor(totalPageviews * 0.35) },
           { path: '/marketplace', views: Math.floor(totalPageviews * 0.25) },
           { path: '/product/[id]', views: Math.floor(totalPageviews * 0.2) },
           { path: '/seller', views: Math.floor(totalPageviews * 0.1) },
           { path: '/auth', views: Math.floor(totalPageviews * 0.1) },
         ],
         deviceBreakdown: [
           { device: 'Mobile', count: Math.floor(uniqueVisitors * 0.65) },
           { device: 'Desktop', count: Math.floor(uniqueVisitors * 0.30) },
           { device: 'Tablet', count: Math.floor(uniqueVisitors * 0.05) },
         ],
         trafficSources: [
           { source: 'Direct', count: Math.floor(uniqueVisitors * 0.4) },
           { source: 'Google', count: Math.floor(uniqueVisitors * 0.35) },
           { source: 'Social', count: Math.floor(uniqueVisitors * 0.15) },
           { source: 'Referral', count: Math.floor(uniqueVisitors * 0.1) },
         ],
       };
     },
     staleTime: 5 * 60 * 1000,
   });
 
   const formatDuration = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, '0')}`;
   };
 
   if (isLoading) {
     return (
       <div className="space-y-4">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[1, 2, 3, 4].map(i => (
             <Card key={i} className="animate-pulse">
               <CardContent className="p-4">
                 <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                 <div className="h-8 bg-muted rounded w-3/4" />
               </CardContent>
             </Card>
           ))}
         </div>
       </div>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h2 className="text-2xl font-bold">Sayt statistikasi</h2>
           <p className="text-muted-foreground">Tashrif buyuruvchilar va sahifa ko'rishlari</p>
         </div>
         <div className="flex items-center gap-2">
           <Select value={period} onValueChange={(v: '7d' | '30d' | '90d') => setPeriod(v)}>
             <SelectTrigger className="w-32">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="7d">7 kun</SelectItem>
               <SelectItem value="30d">30 kun</SelectItem>
               <SelectItem value="90d">90 kun</SelectItem>
             </SelectContent>
           </Select>
           <Button variant="outline" size="icon" onClick={() => refetch()}>
             <RefreshCw className="h-4 w-4" />
           </Button>
         </div>
       </div>
 
       {/* Stats Cards */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center gap-2 text-muted-foreground mb-1">
               <Eye className="h-4 w-4" />
               <span className="text-sm">Sahifa ko'rishlari</span>
             </div>
             <p className="text-2xl font-bold">{analytics?.totalPageviews.toLocaleString()}</p>
             <p className="text-xs text-green-600 flex items-center gap-1">
               <ArrowUpRight className="h-3 w-3" /> +12.5%
             </p>
           </CardContent>
         </Card>
 
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center gap-2 text-muted-foreground mb-1">
               <Users className="h-4 w-4" />
               <span className="text-sm">Noyob tashrif</span>
             </div>
             <p className="text-2xl font-bold">{analytics?.uniqueVisitors.toLocaleString()}</p>
             <p className="text-xs text-green-600 flex items-center gap-1">
               <ArrowUpRight className="h-3 w-3" /> +8.3%
             </p>
           </CardContent>
         </Card>
 
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center gap-2 text-muted-foreground mb-1">
               <Clock className="h-4 w-4" />
               <span className="text-sm">O'rtacha vaqt</span>
             </div>
             <p className="text-2xl font-bold">{formatDuration(analytics?.avgSessionDuration || 0)}</p>
             <p className="text-xs text-muted-foreground">daqiqa:soniya</p>
           </CardContent>
         </Card>
 
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center gap-2 text-muted-foreground mb-1">
               <TrendingUp className="h-4 w-4" />
               <span className="text-sm">Bounce rate</span>
             </div>
             <p className="text-2xl font-bold">{analytics?.bounceRate}%</p>
             <p className="text-xs text-muted-foreground">tark etish</p>
           </CardContent>
         </Card>
       </div>
 
       {/* Charts Row */}
       <div className="grid md:grid-cols-3 gap-6">
         {/* Main Chart */}
         <Card className="md:col-span-2">
           <CardHeader>
             <CardTitle className="text-base">Kunlik ko'rishlar</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={analytics?.pageviewsByDay}>
                   <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                   <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                   <YAxis tick={{ fontSize: 12 }} />
                   <Tooltip 
                     contentStyle={{ 
                       backgroundColor: 'hsl(var(--card))', 
                       border: '1px solid hsl(var(--border))' 
                     }} 
                   />
                   <Line 
                     type="monotone" 
                     dataKey="views" 
                     stroke="hsl(var(--primary))" 
                     strokeWidth={2}
                     name="Ko'rishlar"
                   />
                   <Line 
                     type="monotone" 
                     dataKey="visitors" 
                     stroke="hsl(var(--secondary))" 
                     strokeWidth={2}
                     name="Tashriflar"
                   />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
 
         {/* Device Breakdown */}
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Qurilmalar</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={analytics?.deviceBreakdown}
                     cx="50%"
                     cy="50%"
                     innerRadius={40}
                     outerRadius={70}
                     paddingAngle={2}
                     dataKey="count"
                     nameKey="device"
                   >
                     {analytics?.deviceBreakdown.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="flex justify-center gap-4 text-sm">
               {analytics?.deviceBreakdown.map((item, i) => (
                 <div key={item.device} className="flex items-center gap-1">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                   <span>{item.device}</span>
                 </div>
               ))}
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Bottom Row */}
       <div className="grid md:grid-cols-2 gap-6">
         {/* Top Pages */}
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Top sahifalar</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               {analytics?.topPages.map((page, i) => (
                 <div key={page.path} className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <span className="text-muted-foreground w-5">{i + 1}.</span>
                     <span className="font-mono text-sm">{page.path}</span>
                   </div>
                   <span className="font-medium">{page.views.toLocaleString()}</span>
                 </div>
               ))}
             </div>
           </CardContent>
         </Card>
 
         {/* Traffic Sources */}
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Trafik manbalari</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={analytics?.trafficSources} layout="vertical">
                   <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                   <XAxis type="number" tick={{ fontSize: 12 }} />
                   <YAxis dataKey="source" type="category" tick={{ fontSize: 12 }} width={60} />
                   <Tooltip />
                   <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }