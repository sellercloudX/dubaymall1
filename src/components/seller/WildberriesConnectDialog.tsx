import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, Loader } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWildberriesConnections } from '@/hooks/useWildberriesConnections';

interface WildberriesConnectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function WildberriesConnectDialog({
  isOpen,
  onOpenChange,
  onConnected,
}: WildberriesConnectDialogProps) {
  const [supplierId, setSupplierId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connectWildberries } = useWildberriesConnections();

  const handleConnect = async () => {
    if (!supplierId || !apiKey) {
      setError('Supplier ID va API key talab');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await connectWildberries(
        parseInt(supplierId),
        apiKey,
        warehouseId ? parseInt(warehouseId) : undefined
      );

      if (!result.success) {
        setError(result.error || 'Ulanishda xato');
        return;
      }

      setSupplierId('');
      setApiKey('');
      setWarehouseId('');
      onOpenChange(false);
      onConnected?.();
    } catch (err) {
      setError('Ulanishda xato');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Wildberries ulash</DialogTitle>
          <DialogDescription>
            O'zingizning Wildberries akkauntini ulash uchun Supplier ID va API keyni kiriting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="supplier-id">Supplier ID</Label>
            <Input
              id="supplier-id"
              type="number"
              placeholder="123456"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Wildberries kabinet'idan topish mumkin
            </p>
          </div>

          <div>
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Sizning API key'ingiz"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              https://seller.wildberries.ru/apis dan oling
            </p>
          </div>

          <div>
            <Label htmlFor="warehouse-id">Warehouse ID (ixtiyoriy)</Label>
            <Input
              id="warehouse-id"
              type="number"
              placeholder="Ombor ID (ixtiyoriy)"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Birgina ombor bilan ishlash uchun kiriting
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              API key shifrlangan holda saqlanadi. U hech qachon ko'rinmaydi.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Bekor qilish
            </Button>
            <Button onClick={handleConnect} disabled={isLoading}>
              {isLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
              Ulash
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
