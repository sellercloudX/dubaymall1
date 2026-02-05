-- Create conversations table for seller-customer chat
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, shop_id)
);

-- Create messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations (using user_id instead of owner_id)
CREATE POLICY "Users can view their own conversations" 
ON public.conversations FOR SELECT 
USING (auth.uid() = customer_id OR EXISTS (
  SELECT 1 FROM public.shops WHERE id = shop_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create conversations" 
ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() = customer_id);

-- RLS policies for messages
CREATE POLICY "Users can view messages in their conversations" 
ON public.chat_messages FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE id = conversation_id 
  AND (customer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.shops WHERE id = shop_id AND user_id = auth.uid()
  ))
));

CREATE POLICY "Users can send messages in their conversations" 
ON public.chat_messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND (customer_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.shops WHERE id = shop_id AND user_id = auth.uid()
    ))
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Index for performance
CREATE INDEX idx_conversations_customer ON public.conversations(customer_id);
CREATE INDEX idx_conversations_shop ON public.conversations(shop_id);
CREATE INDEX idx_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_messages_created ON public.chat_messages(created_at DESC);