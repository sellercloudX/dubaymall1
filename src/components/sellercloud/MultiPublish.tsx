import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, Globe, Check, X, Loader2, 
  Package, ArrowRight, FileText, Image
} from 'lucide-react';

interface MultiPublishProps {
  connectedMarketplaces: string[];
}

const MARKETPLACE_INFO: Record<string, { name: string; logo: string; color: string }> = {
  yandex: { name: 'Yandex Market', logo: '🟡', color: 'from-yellow-500 to-amber-500' },
  uzum: { name: 'Uzum Market', logo: '🟣', color: 'from-purple-500 to-violet-500' },
  wildberries: { name: 'Wildberries', logo: '🟣', color: 'from-fuchsia-500 to-pink-500' },
  ozon: { name: 'Ozon', logo: '🔵', color: 'from-blue-500 to-cyan-500' },
};

interface DraftProduct {
  id: string;
  name: string;
  images: string[];
  price: number;
  category: string;
  description: string;
  status: 'draft' | 'ready' | 'publishing' | 'published' | 'error';
  publishedTo: string[];
  errors: Record<string, string>;
}

const MOCK_DRAFTS: DraftProduct[] = [
  {
    id: '1',
    name: 'Xiaomi Redmi Note 13 Pro',
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
    price: 299,
    category: 'Telefonlar',
    description: 'Yangi Xiaomi telefoni...',
    status: 'ready',
    publishedTo: [],
    errors: {},
  },
  {
    id: '2',
    name: 'Samsung Galaxy Buds FE',
    images: ['img1.jpg', 'img2.jpg'],
    price: 89,
    category: 'Quloqchinlar',
    description: 'Samsung simsiz quloqchinlari...',
    status: 'draft',
    publishedTo: [],
    errors: {},
  },
];

export function MultiPublish({ connectedMarketplaces }: MultiPublishProps) {
  const [drafts, setDrafts] = useState<DraftProduct[]>(MOCK_DRAFTS);
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>(connectedMarketplaces);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);

  const toggleMarketplace = (mp: string) => {
    setSelectedMarketplaces(prev => 
      prev.includes(mp) ? prev.filter(m => m !== mp) : [...prev, mp]
    );
  };

  const toggleProduct = (id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (selectedProducts.length === 0 || selectedMarketplaces.length === 0) return;
    
    setIsPublishing(true);
    setPublishProgress(0);
    
    const total = selectedProducts.length * selectedMarketplaces.length;
    let completed = 0;
    
    // Simulate publishing
    for (const productId of selectedProducts) {
      for (const mp of selectedMarketplaces) {
        await new Promise(resolve => setTimeout(resolve, 500));
        completed++;
        setPublishProgress((completed / total) * 100);
      }
    }
    
    setIsPublishing(false);
    setSelectedProducts([]);
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Upload className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ko'p marketplacega joylash</h3>
          <p className="text-muted-foreground mb-4">
            Avval kamida bitta marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Marketplace Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Joylash marketplacelari
          </CardTitle>
          <CardDescription>
            Mahsulotlarni qaysi marketplacelarga joylashni tanlang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {connectedMarketplaces.map(mp => {
              const info = MARKETPLACE_INFO[mp];
              const isSelected = selectedMarketplaces.includes(mp);
              return (
                <div
                  key={mp}
                  onClick={() => toggleMarketplace(mp)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-xl`}>
                      {info.logo}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{info.name}</div>
                      <Badge variant={isSelected ? 'default' : 'secondary'} className="text-xs mt-1">
                        {isSelected ? 'Tanlangan' : 'Tanlanmagan'}
                      </Badge>
                    </div>
                    <Checkbox checked={isSelected} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Joylash uchun mahsulotlar
              </CardTitle>
              <CardDescription>
                {drafts.length} ta qoralama mahsulot
              </CardDescription>
            </div>
            {selectedProducts.length > 0 && (
              <Badge variant="secondary">
                {selectedProducts.length} ta tanlangan
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {drafts.map(draft => {
              const isSelected = selectedProducts.includes(draft.id);
              return (
                <div
                  key={draft.id}
                  onClick={() => toggleProduct(draft.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox checked={isSelected} />
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{draft.name}</div>
                      <div className="text-sm text-muted-foreground">{draft.category}</div>
                      <div className="flex items-center gap-4 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Image className="h-3 w-3 mr-1" />
                          {draft.images.length} rasm
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          Tavsif bor
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${draft.price}</div>
                      <Badge 
                        variant={draft.status === 'ready' ? 'default' : 'secondary'}
                        className="mt-1"
                      >
                        {draft.status === 'ready' ? 'Tayyor' : 'Qoralama'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Published Status */}
                  {draft.publishedTo.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground mb-2">Joylangan:</div>
                      <div className="flex gap-2">
                        {draft.publishedTo.map(mp => (
                          <Badge key={mp} variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1 text-green-500" />
                            {MARKETPLACE_INFO[mp]?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Publish Action */}
      <Card>
        <CardContent className="py-6">
          {isPublishing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Joylanmoqda...</span>
              </div>
              <Progress value={publishProgress} />
              <p className="text-sm text-muted-foreground">
                {selectedProducts.length} mahsulot × {selectedMarketplaces.length} marketplace = {selectedProducts.length * selectedMarketplaces.length} ta kartochka
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {selectedProducts.length} mahsulot → {selectedMarketplaces.length} marketplace
                </div>
                <p className="text-sm text-muted-foreground">
                  Jami {selectedProducts.length * selectedMarketplaces.length} ta kartochka yaratiladi
                </p>
              </div>
              <Button 
                size="lg"
                disabled={selectedProducts.length === 0 || selectedMarketplaces.length === 0}
                onClick={handlePublish}
              >
                <Upload className="h-4 w-4 mr-2" />
                Joylash
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
