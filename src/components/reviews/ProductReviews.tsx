import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StarRating } from './StarRating';
import { useProductReviews, useProductRating, useAddReview, useUserReview, useDeleteReview } from '@/hooks/useReviews';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MessageSquare, CheckCircle, Trash2, Loader2, User } from 'lucide-react';

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { user } = useAuth();
  const { data: reviews, isLoading } = useProductReviews(productId);
  const { data: ratingData } = useProductRating(productId);
  const { data: userReview } = useUserReview(productId, user?.id);
  const addReview = useAddReview();
  const deleteReview = useDeleteReview();

  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async () => {
    if (newRating === 0) {
      toast.error('Reyting tanlang');
      return;
    }

    try {
      await addReview.mutateAsync({
        productId,
        rating: newRating,
        comment: newComment,
      });
      toast.success('Izoh qo\'shildi!');
      setNewRating(0);
      setNewComment('');
      setShowForm(false);
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error('Siz allaqachon izoh qoldirgansiz');
      } else {
        toast.error('Xatolik yuz berdi');
      }
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await deleteReview.mutateAsync({ reviewId, productId });
      toast.success('Izoh o\'chirildi');
    } catch {
      toast.error('Xatolik yuz berdi');
    }
  };

  const getRatingDistribution = () => {
    if (!reviews?.length) return Array(5).fill(0);
    const distribution = Array(5).fill(0);
    reviews.forEach(r => {
      distribution[r.rating - 1]++;
    });
    return distribution.reverse();
  };

  const distribution = getRatingDistribution();

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Sharhlar va reytinglar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Average Rating */}
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">
                {ratingData?.average_rating || '0'}
              </div>
              <StarRating rating={ratingData?.average_rating || 0} size="lg" />
              <p className="text-sm text-muted-foreground mt-2">
                {ratingData?.total_reviews || 0} ta sharh asosida
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star, idx) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-sm w-8">{star} ⭐</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{
                        width: reviews?.length
                          ? `${(distribution[idx] / reviews.length) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">
                    {distribution[idx]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Review Button */}
          {user && !userReview && !showForm && (
            <Button onClick={() => setShowForm(true)} className="mt-6 w-full">
              Izoh qoldirish
            </Button>
          )}

          {/* Add Review Form */}
          {showForm && (
            <div className="mt-6 p-4 border rounded-lg space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Reyting</label>
                <StarRating
                  rating={newRating}
                  interactive
                  onRatingChange={setNewRating}
                  size="lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Izoh (ixtiyoriy)</label>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Mahsulot haqida fikringizni yozing..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={addReview.isPending}>
                  {addReview.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Yuborish
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}

          {!user && (
            <p className="text-center text-muted-foreground mt-6">
              Izoh qoldirish uchun tizimga kiring
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="font-semibold">Barcha sharhlar ({reviews?.length || 0})</h3>
        
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : reviews?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Hali sharhlar yo'q. Birinchi bo'lib izoh qoldiring!
            </CardContent>
          </Card>
        ) : (
          reviews?.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={review.reviewer_avatar || undefined} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {review.reviewer_name || 'Foydalanuvchi'}
                        </span>
                        {review.is_verified_purchase && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Tasdiqlangan xarid
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(review.created_at), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(review.id)}
                      disabled={deleteReview.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {review.comment && (
                  <p className="mt-3 text-sm text-muted-foreground">{review.comment}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
