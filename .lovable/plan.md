
## 🚀 SellerCloudX Extension v4.0 — Multi-Marketplace Pro

### Qamrov kengaytirish

**Qo'llab-quvvatlanadigan saytlar:**
1. `seller.uzum.uz` — kartochka yaratish, boost, etiketka, moliya scraping
2. `seller.wildberries.ru` — moliya hisobotlar, buyurtmalar, narx boshqarish
3. `partner.market.yandex.ru` — moliya, buyurtmalar, analitika
4. `mpstats.io` / `zoomselling.io` — raqobatchi monitoring, trend scraping
5. `uzum.uz` (marketplace front) — har bir mahsulot sahifasida statistika overlay

### Bosqich 1: Arxitektura (manifest + multi-site)
- `manifest.json` ni 5 ta saytga kengaytirish
- Har bir sayt uchun alohida content script
- Background service worker — universal command router

### Bosqich 2: Moliyaviy scraping (API bermagan ma'lumotlar)
- **Uzum:** Komissiya, logistika, to'lovlar jadvallarini DOM dan olish
- **WB:** Moliya hisobotlari, xizmat haqlari, qaytarishlar
- **Yandex:** Komissiya tafsilotlari, logistika xarajatlari
- Barcha ma'lumotlar `marketplace_finance_scraped` jadvaliga saqlash

### Bosqich 3: Buyurtmalarni qayta ishlash
- Seller kabinetlarida buyurtmalarni qabul qilish/rad etish
- FBS yig'ish varaqlari va etiketkalarni avtomatik chop etish
- Status o'zgartirish (API cheklovlarini chetlab o'tish)

### Bosqich 4: Raqobatchi monitoring
- mpstats.io dan narx, reyting, savdo hajmi scraping
- zoomselling.io dan trend ma'lumotlari
- uzum.uz marketplace sahifalarida inline statistika

### Bosqich 5: Avtomatik narx yangilash (DOM orqali)
- Seller kabinetida narxlarni bevosita o'zgartirish
- API 403 bo'lganda ham ishlaydi
- Min/Max narx himoyasi bilan

### Bosqich 6: Chrome Web Store tayyorlash
- Ikonkalar, screenshots, description
- Privacy policy sahifasi
- Review uchun topshirish

### Texnik yechim:
```
chrome-extension/
├── manifest.json (5 sayt)
├── background.js (universal router)
├── content-uzum-seller.js
├── content-wb-seller.js  
├── content-yandex-seller.js
├── content-mpstats.js
├── content-uzum-market.js (front overlay)
├── popup.html/js
└── icons/
```

### Ma'lumotlar oqimi:
Extension → DOM scraping → Background → Supabase REST API → Dashboard

### ⚠️ Muhim eslatma:
- mpstats.io va zoomselling.io scraping ularning ToS ga zid bo'lishi mumkin
- WB va Yandex seller panellarining DOM tuzilishi tez-tez o'zgaradi
- Har bir content script mustaqil ishlashi kerak (bir sayt buzilsa boshqalari ishlab turadi)
