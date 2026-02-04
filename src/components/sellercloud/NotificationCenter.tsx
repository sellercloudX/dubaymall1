import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, BellRing, Package, ShoppingCart, DollarSign, 
  AlertTriangle, Check, X, Settings, Mail, 
  MessageSquare, Smartphone
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'order' | 'stock' | 'price' | 'sync' | 'system';
  title: string;
  message: string;
  marketplace?: string;
  isRead: boolean;
  createdAt: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'order',
    title: 'Yangi buyurtma',
    message: 'Yandex Marketdan 3 ta yangi buyurtma keldi',
    marketplace: 'yandex',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    severity: 'success',
  },
  {
    id: '2',
    type: 'stock',
    title: 'Kam qoldiq ogohlantirishi',
    message: 'iPhone 15 Pro Max - faqat 5 dona qoldi',
    marketplace: 'uzum',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    severity: 'warning',
  },
  {
    id: '3',
    type: 'price',
    title: 'Raqobatchi narxi o\'zgardi',
    message: 'Samsung S24 Ultra - raqobatchi $50 arzonlashtirdi',
    marketplace: 'yandex',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    severity: 'info',
  },
  {
    id: '4',
    type: 'sync',
    title: 'Sinxronlash muvaffaqiyatli',
    message: '150 ta mahsulot sinxronlandi',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    severity: 'success',
  },
  {
    id: '5',
    type: 'system',
    title: 'API xatosi',
    message: 'Wildberries API vaqtincha ishlamayapti',
    marketplace: 'wildberries',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    severity: 'error',
  },
];

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  order: ShoppingCart,
  stock: Package,
  price: DollarSign,
  sync: Check,
  system: AlertTriangle,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  success: 'bg-green-500',
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [showSettings, setShowSettings] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <BellRing className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <CardTitle>Bildirishnomalar</CardTitle>
                <CardDescription>
                  {unreadCount > 0 ? `${unreadCount} ta o'qilmagan` : 'Barcha o\'qilgan'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <Check className="h-4 w-4 mr-2" />
                  Barchasini o'qilgan deb belgilash
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bildirishnoma sozlamalari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Email */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Email</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Yangi buyurtmalar</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Kam qoldiq</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Narx o'zgarishi</span>
                    <Switch />
                  </div>
                </div>
              </div>

              {/* Telegram */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Telegram</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Yangi buyurtmalar</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Kam qoldiq</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Narx o'zgarishi</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              {/* Push */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Push</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Yangi buyurtmalar</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Kam qoldiq</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Narx o'zgarishi</span>
                    <Switch />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Bildirishnomalar yo'q</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map(notification => {
                  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-muted/50 transition-colors ${
                        !notification.isRead ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full ${SEVERITY_COLORS[notification.severity]} bg-opacity-10 flex items-center justify-center`}>
                            <Icon className={`h-5 w-5 ${
                              notification.severity === 'error' ? 'text-red-500' :
                              notification.severity === 'warning' ? 'text-yellow-500' :
                              notification.severity === 'success' ? 'text-green-500' :
                              'text-blue-500'
                            }`} />
                          </div>
                          {!notification.isRead && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-sm">{notification.title}</div>
                              <p className="text-sm text-muted-foreground">{notification.message}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!notification.isRead && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteNotification(notification.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {notification.marketplace && (
                              <Badge variant="secondary" className="text-xs">
                                {notification.marketplace}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
