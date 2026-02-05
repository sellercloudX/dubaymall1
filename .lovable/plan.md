
# MXIK (IKPU) Kodlarni Avtomatik Aniqlash - Implementatsiya Rejasi

## Umumiy ko'rinish
Bu reja mahsulotlar uchun O'zbekiston soliq tizimidagi MXIK kodlarini AI yordamida avtomatik topish tizimini yaratadi. Sotuvchi qo'lda qidirmasdan, tizim mahsulot nomidan eng mos MXIK kodini topadi.

## Arxitektura

```text
┌─────────────────────────────────────────────────────────────────┐
│                    MXIK AVTOMATIK ANIQLASH                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────────┐      ┌───────────┐ │
│  │ Mahsulot     │ ---> │ lookup-mxik-code │ ---> │ mxik_codes│ │
│  │ nomi/tavsifi │      │ Edge Function    │      │ Database  │ │
│  └──────────────┘      └──────────────────┘      └───────────┘ │
│         │                      │                      │        │
│         │                      v                      │        │
│         │              ┌──────────────────┐           │        │
│         │              │ AI (Gemini Flash)│           │        │
│         │              │ Kalit so'zlarni  │           │        │
│         │              │ ajratish         │           │        │
│         │              └──────────────────┘           │        │
│         │                      │                      │        │
│         v                      v                      v        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Natija: MXIK kod + nom + QQS               │  │
│  │  Kod: 26301100001000000 | Nomi: Mobil telefonlar | 12%  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Amalga oshirish bosqichlari

### 1-BOSQICH: Database Schema (Migration)

**Yangi jadval yaratish: `mxik_codes`**

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | uuid | Primary key |
| code | text | MXIK kodi (17 raqamli, unique) |
| name_uz | text | O'zbek tilida nomi |
| name_ru | text | Rus tilida nomi |
| group_code | text | Guruh kodi (8 raqamli) |
| group_name | text | Guruh nomi |
| unit_code | text | O'lchov birligi kodi |
| unit_name | text | O'lchov birligi nomi |
| vat_rate | numeric | QQS stavkasi (default 12%) |
| is_active | boolean | Faol holati |
| search_vector | tsvector | Full-text qidiruv uchun |
| created_at | timestamptz | Yaratilgan vaqt |

**`products` jadvaliga yangi ustunlar:**
- `mxik_code` (text) - Mahsulotning MXIK kodi
- `mxik_name` (text) - MXIK nomi (foydalanuvchiga ko'rsatish uchun)

**Indekslar:**
- GIN indeks `search_vector` ustunida (tez full-text qidiruv)
- B-tree indeks `code` ustunida (tez aniq qidiruv)
- Trigram indekslar `name_uz`, `name_ru` uchun (fuzzy matching)

**RLS Policy:**
- Hammaga o'qish ruxsati (SELECT) - kodlar ommaviy ma'lumot

---

### 2-BOSQICH: Boshlang'ich MXIK Ma'lumotlar (Seed Data)

Mavjud `yandex-market-create-card` funksiyasidagi 30+ kategoriyani migratsiya qilish va eng ko'p ishlatiladigan 200+ MXIK kodlarni qo'shish.

**Namuna kodlar:**

| Kod | Nomi (O'zbek) | Nomi (Rus) | QQS |
|-----|---------------|------------|-----|
| 26301100001000000 | Mobil telefonlar | Мобильные телефоны | 12% |
| 26201100001000000 | Noutbuklar | Ноутбуки | 12% |
| 26201200001000000 | Planshetlar | Планшеты | 12% |
| 27511100001000000 | Muzlatgichlar | Холодильники | 12% |
| 14201100001000000 | Kiyimlar | Одежда | 12% |
| 15201100001000000 | Poyabzallar | Обувь | 12% |
| ... | ... | ... | ... |

---

### 3-BOSQICH: Edge Function - `lookup-mxik-code`

**Yangi funksiya vazifasi:**

```text
INPUT: { productName, category?, description? }
        │
        v
┌─────────────────────────────┐
│ 1. AI Keyword Extraction    │
│    (Gemini Flash Lite)      │
│    Tez, arzon               │
└─────────────────────────────┘
        │
        v
┌─────────────────────────────┐
│ 2. Database Search          │
│    - Full-text search       │
│    - Trigram similarity     │
│    - Top 10 natija          │
└─────────────────────────────┘
        │
        v
┌─────────────────────────────┐
│ 3. AI Best Match Selection  │
│    (Gemini Flash)           │
│    Eng mosini tanlash       │
└─────────────────────────────┘
        │
        v
OUTPUT: {
  mxik_code: "26301100001000000",
  mxik_name: "Mobil telefonlar",
  vat_rate: 12,
  confidence: 95,
  alternatives: [...]
}
```

**Algoritm tafsilotlari:**
1. Mahsulot nomidan AI kalit so'zlarni ajratadi (masalan: "iPhone 15 Pro" -> ["telefon", "smartphone", "mobil", "apple"])
2. Database'dan mos kodlarni qidiradi (full-text + trigram)
3. AI topilgan natijalarni tahlil qilib, eng mosini tanlaydi
4. Confidence score bilan qaytaradi

---

### 4-BOSQICH: UI Komponentlar

**A) MxikLookup.tsx - Yangi komponent**

```text
┌─────────────────────────────────────────────────┐
│ MXIK Kodi (IKPU)                                │
│ ┌──────────────────────┐ ┌────────────────────┐ │
│ │ 26301100001000000    │ │ 🔍 Avtomatik topish│ │
│ └──────────────────────┘ └────────────────────┘ │
│                                                 │
│ ✅ Topildi: Mobil telefonlar                   │
│ Ishonch darajasi: 95%                           │
│ QQS stavkasi: 12%                               │
│                                                 │
│ Boshqa variantlar:                              │
│ • Aloqa qurilmalari (85%)                      │
│ • Elektron qurilmalar (72%)                    │
└─────────────────────────────────────────────────┘
```

**B) ProductForm.tsx - O'zgarishlar**

- MXIK input maydoni qo'shiladi
- "Avtomatik topish" tugmasi
- Topilgan natijani ko'rsatish
- Qo'lda tahrirlash imkoniyati

**C) AIScannerPro.tsx - O'zgarishlar**

Yangi bosqich qo'shiladi (4-bosqich sifatida):

```text
Progress bosqichlari:
✅ 1. Rasm tahlili (GPT-4o Vision)
✅ 2. SEO kontent (Claude Haiku)
✅ 3. Tavsif yaratish (Claude Sonnet)
🔄 4. MXIK aniqlash (Gemini Flash) ← YANGI
⏳ 5. Infografikalar (Gemini Image)
⏳ 6. Kartochka yaratish (Yandex API)
```

---

### 5-BOSQICH: yandex-market-create-card Yangilash

**Mavjud muammo:**
- Hardcoded `MXIK_DATABASE` faqat ~30 kategoriya
- Ko'p mahsulotlar "default" ga tushib qoladi

**Yechim:**
- `lookup-mxik-code` funksiyasini chaqirish
- Yoki `mxik_codes` jadvalidan to'g'ridan-to'g'ri qidirish
- Kartochkaga aniq MXIK kodini qo'shish

---

## Texnik tafsilotlar

### Database Migration SQL

```sql
-- pg_trgm extension (fuzzy search uchun)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- mxik_codes jadvali
CREATE TABLE mxik_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_uz text NOT NULL,
  name_ru text,
  group_code text,
  group_name text,
  unit_code text,
  unit_name text,
  vat_rate numeric DEFAULT 12,
  is_active boolean DEFAULT true,
  search_vector tsvector,
  created_at timestamptz DEFAULT now()
);

-- Indekslar
CREATE INDEX idx_mxik_code ON mxik_codes(code);
CREATE INDEX idx_mxik_search ON mxik_codes USING GIN(search_vector);
CREATE INDEX idx_mxik_name_uz_trgm ON mxik_codes USING GIN(name_uz gin_trgm_ops);
CREATE INDEX idx_mxik_name_ru_trgm ON mxik_codes USING GIN(name_ru gin_trgm_ops);

-- Search vector auto-update trigger
CREATE OR REPLACE FUNCTION update_mxik_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian', 
    COALESCE(NEW.name_uz, '') || ' ' || 
    COALESCE(NEW.name_ru, '') || ' ' ||
    COALESCE(NEW.group_name, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mxik_search_update
  BEFORE INSERT OR UPDATE ON mxik_codes
  FOR EACH ROW EXECUTE FUNCTION update_mxik_search_vector();

-- products jadvaliga ustunlar
ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik_code text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik_name text;

-- RLS policy
ALTER TABLE mxik_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read MXIK codes" 
  ON mxik_codes FOR SELECT USING (true);
```

### Edge Function Pseudocode

```typescript
// lookup-mxik-code/index.ts
Deno.serve(async (req) => {
  const { productName, category, description } = await req.json();
  
  // 1. AI orqali kalit so'zlarni ajratish (Gemini Flash Lite - tez)
  const keywords = await extractKeywordsWithAI(productName, description);
  
  // 2. Database'dan qidirish
  const matches = await supabase
    .from('mxik_codes')
    .select('*')
    .textSearch('search_vector', keywords.join(' | '))
    .limit(10);
  
  // 3. AI orqali eng mosini tanlash (Gemini Flash)
  const bestMatch = await selectBestMatchWithAI(matches, productName);
  
  return Response.json({
    mxik_code: bestMatch.code,
    mxik_name: bestMatch.name_uz,
    vat_rate: bestMatch.vat_rate,
    confidence: bestMatch.score,
    alternatives: matches.slice(1, 4)
  });
});
```

---

## O'zgartiriladigan fayllar

| Fayl | Holat | Vazifa |
|------|-------|--------|
| Database migration | YANGI | `mxik_codes` jadvali + `products` ustunlari |
| `supabase/functions/lookup-mxik-code/index.ts` | YANGI | AI MXIK lookup funksiyasi |
| `src/components/seller/MxikLookup.tsx` | YANGI | MXIK qidiruv komponenti |
| `src/components/seller/ProductForm.tsx` | TAHRIR | MXIK input qo'shish |
| `src/components/seller/AIScannerPro.tsx` | TAHRIR | MXIK bosqichini qo'shish |
| `supabase/functions/yandex-market-create-card/index.ts` | TAHRIR | Database lookup ishlatish |
| `supabase/config.toml` | TAHRIR | Yangi funksiyani qo'shish |

---

## Kutilgan natijalar

| Mezon | Hozir | Keyin |
|-------|-------|-------|
| MXIK aniqlash usuli | Qo'lda qidirish | Avtomatik AI |
| Vaqt sarfi | 2-5 daqiqa | 1-3 soniya |
| Xatolik darajasi | ~30% | <5% |
| Qamrov | 30 kategoriya | 200+ kodlar (kengaytirish mumkin) |
| Foydalanuvchi harakati | Qidirish + tanlash | Hech narsa |

---

## Keyingi qadamlar (tartib bilan)

1. Database migration - `mxik_codes` jadvali yaratish + `products` ga ustunlar
2. Seed data - 200+ MXIK kodlarni qo'shish
3. `lookup-mxik-code` edge function - AI lookup yaratish
4. `MxikLookup.tsx` - UI komponent yaratish
5. `ProductForm.tsx` - MXIK integratsiya
6. `AIScannerPro.tsx` - MXIK bosqichini qo'shish
7. `yandex-market-create-card` - Database lookup ga o'tkazish
8. Test - Turli mahsulotlar bilan sinov
