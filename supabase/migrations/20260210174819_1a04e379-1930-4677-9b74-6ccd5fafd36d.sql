
-- Trigger: xaridor buyurtma statusi o'zgarganda notification yaratish
CREATE OR REPLACE FUNCTION public.notify_buyer_on_status_change()
RETURNS trigger AS $$
DECLARE
  status_text text;
BEGIN
  -- Faqat status o'zgarganda ishlaydi
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN status_text := 'tasdiqlandi ✅';
    WHEN 'processing' THEN status_text := 'tayyorlanmoqda 📦';
    WHEN 'shipped' THEN status_text := 'jo''natildi 🚚';
    WHEN 'out_for_delivery' THEN status_text := 'yetkazilmoqda 🏃';
    WHEN 'delivered' THEN status_text := 'yetkazildi ✅';
    WHEN 'cancelled' THEN status_text := 'bekor qilindi ❌';
    ELSE status_text := NEW.status;
  END CASE;

  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (
    NEW.user_id,
    'Buyurtma ' || status_text,
    'Buyurtma #' || NEW.order_number || ' holati: ' || status_text,
    'order',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_buyer_on_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_buyer_on_status_change();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
