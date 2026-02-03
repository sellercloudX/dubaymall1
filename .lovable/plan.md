

# SuperEshop Hub - To'liq E-commerce Platforma

## 📋 Loyiha haqida
O'zbekiston va Markaziy Osiyo bozoriga mo'ljallangan to'liq e-commerce platforma. Sotuvchilar, bloggerlar va xaridorlar uchun yagona ekotizim.

---

## 🏗️ 1-Bosqich: Asos va Autentifikatsiya

### Foydalanuvchi tizimlari
- **Ro'yxatdan o'tish va kirish** (email/parol)
- **3 ta rol**: Sotuvchi, Blogger, Xaridor
- **Profil sahifasi** - shaxsiy ma'lumotlar, avatar, rol tanlash
- **Til sozlamalari** - O'zbek, Rus, Ingliz

### Asosiy sahifalar
- Bosh sahifa (landing)
- Login/Register sahifasi
- Dashboard (rolga qarab turli ko'rinishlar)

---

## 🏪 2-Bosqich: Do'kon yaratish va Mahsulot boshqaruvi

### Sotuvchi Dashboard
- **Bir bosishda do'kon yaratish** - nom, logo, ta'rif kiritish
- **Shaxsiy do'kon sahifasi** (slug bilan: `/shop/[slug]`)
- **Mahsulot qo'shish 3 usulda**:
  - 🤖 **AI orqali** - rasm yuklaysiz → AI nom, ta'rif, kategoriya, narx taklif qiladi
  - 📦 **Dropshipping import** - havola orqali mahsulot olib kelish
  - ✍️ **Qo'lda kiritish** - oddiy forma
- **Mahsulotlar ro'yxati** - tahrirlash, o'chirish, holat o'zgartirish
- **Kategoriyalar boshqaruvi**

### AI Vision integratsiyasi
- Rasmni tahlil qilish (Lovable AI - Gemini Vision)
- Avtomatik nom va ta'rif generatsiya
- Kategoriya aniqlash
- Narx tavsiyasi

---

## 🛒 3-Bosqich: Marketplace va Xarid qilish

### Umumiy Marketplace
- **Barcha mahsulotlar katalogi**
- **Qidiruv** - nom, kategoriya, narx bo'yicha
- **Filtrlar** - kategoriya, narx oralig'i, do'kon, reyting
- **AI tavsiyalar** - "Sizga yoqishi mumkin" bo'limi

### Xarid jarayoni
- **Mahsulot sahifasi** - rasmlar, ta'rif, narx, do'kon ma'lumoti
- **Savatcha** - qo'shish, o'chirish, miqdor o'zgartirish
- **Buyurtma berish** - manzil, yetkazib berish usuli
- **To'lov** - Payme, Click, Uzcard integratsiyasi (mock)
- **Buyurtma holati** - kutilmoqda, jo'natildi, yetkazildi

### Xaridor Dashboard
- Buyurtmalar tarixi
- Sevimli mahsulotlar
- Manzillar boshqaruvi

---

## 🤝 4-Bosqich: Affiliate/Blogger tizimi

### Sotuvchi tomondan
- Mahsulotni **"Reklama uchun ochish"** tugmasi
- **Komissiya foizi** belgilash (10-25%)
- Bloggerlar statistikasi - kim qancha sotdi

### Blogger Dashboard
- **Mavjud affiliate mahsulotlar** ro'yxati
- **AI matching** - sizga mos mahsulotlar tavsiyasi
- **Shaxsiy havola yaratish** (referral link)
- **Komissiya statistikasi** - sotuvlar, daromad, to'lovlar
- **Pul yechib olish** so'rovlari

### Avtomatik hisoblash
- Har bir sotuvdan komissiya hisoblash
- Blogger balansini yangilash
- To'lov tarixi

---

## 📦 5-Bosqich: Dropshipping moduli

### Import funksiyalari
- **Havola orqali import** - AliExpress, CJdropshipping
- **Mahsulot qidirish** - kategoriya bo'yicha
- **Avtomatik ma'lumot olish** - nom, ta'rif, rasmlar, narx

### Narx boshqaruvi
- **Markup sozlash** - foiz yoki qat'iy summa
- **Narx monitoring** - manba narxi o'zgarganda ogohlantirish
- **Raqobatchi narx** taklifi (AI)

### Buyurtma boshqaruvi
- Yetkazib beruvchiga avtomatik buyurtma (mock)
- Tracking raqami kiritish
- Holat yangilash

---

## 🤖 6-Bosqich: AI Chat-yordamchi

### Mijozlar uchun
- **Savol-javob** - mahsulotlar haqida
- **Mahsulot tavsiyasi** - "Menga [kategoriya] kerak"
- **Buyurtma holati** so'rash
- **Yordam** - tez-tez so'raladigan savollar

### Sotuvchilar uchun
- **Do'kon maslahatlari** - qanday yaxshilash mumkin
- **Narx optimallashtirish** tavsiyalari
- **Mahsulot ta'rifi yaxshilash**

---

## 🛡️ 7-Bosqich: Admin Panel

### Boshqaruv funksiyalari
- **Foydalanuvchilar** - ro'yxat, bloklash, rol o'zgartirish
- **Mahsulot moderatsiyasi** - tasdiqlash, rad etish
- **Do'konlar** - statistika, ogohlantirishlar
- **Buyurtmalar** - umumiy ko'rish, muammoli buyurtmalar

### Statistika
- Umumiy sotuvlar
- Faol sotuvchilar/bloggerlar
- Eng ko'p sotilgan mahsulotlar
- Daromad grafiklari

---

## 🎨 Dizayn va UX

### Umumiy uslub
- **Zamonaviy va toza** - oq fon, yumshoq ranglar
- **O'zbek bozori uchun** - tanish elementlar
- **Mobile-first** - telefondan ishlatish qulay

### Rang palitrasi
- Asosiy: Ko'k (#3B82F6) - ishonch
- Yordamchi: Yashil (#10B981) - muvaffaqiyat
- Accent: Sariq (#F59E0B) - diqqat

---

## 📊 Texnik arxitektura

### Frontend
- React + TypeScript + Tailwind CSS
- shadcn/ui komponentlari
- React Router (sahifalar)
- TanStack Query (ma'lumotlar)

### Backend (Supabase)
- **Auth** - email/parol autentifikatsiya
- **Database** - PostgreSQL (users, shops, products, orders, affiliates, commissions)
- **Storage** - rasmlar saqlash
- **Edge Functions** - AI integratsiya, to'lov webhook'lar

### AI (Lovable AI Gateway)
- Gemini Vision - rasm tahlili
- Gemini Flash - chat va tavsiyalar
- Tool calling - strukturalangan javoblar

---

## 🚀 Kutilayotgan natija

Birinchi versiyada tayyor bo'ladi:
- ✅ To'liq autentifikatsiya tizimi
- ✅ Sotuvchi do'kon yaratish va mahsulot qo'shish
- ✅ AI orqali rasmdan mahsulot yaratish
- ✅ Umumiy marketplace
- ✅ Savatcha va buyurtma berish
- ✅ Blogger affiliate tizimi
- ✅ Dropshipping import
- ✅ AI chat-yordamchi
- ✅ Admin panel
- ✅ 3 tilda interfeys

