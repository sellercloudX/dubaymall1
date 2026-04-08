
## 📊 Yangi tarif tuzilmasi

### Tariflar (4 ta):

| | Boshlang'ich | Biznes | Professional | Enterprise |
|---|---|---|---|---|
| **Narx** | 299,000 so'm/oy | 1,499,000 so'm/oy | 5,999,000 so'm/oy | Kelishuv |
| **Marketplace** | 1 ta MP | 1 ta MP | Cheksiz MP | Cheksiz |
| **Do'konlar** | 1 ta do'kon | 3 tagacha do'kon | Cheksiz | Cheksiz |
| **Tahlillar** | Faqat 7 kunlik data | 30 kunlik data | Yillik data | Cheksiz |
| **P&L/ABC/Unit** | 7 kunlik | 30 kunlik | To'liq | To'liq |
| **AI chegirma** | 0% | 15% | 30% | 40% (max) |
| **Jamoa** | ❌ | ❌ | 3 ta xodim | Cheksiz |
| **Multi-store** | ❌ | ❌ | ✅ | ✅ |
| **Auto-reorder** | ❌ | ❌ | ❌ | ✅ |

### Free tarif → O'chiriladi
- Bepul tarif o'rniga 1 oylik sinov (trial) beriladi — Boshlang'ich tarif sifatida
- Trial tugagandan so'ng, to'lov qilinmasa — platforma bloklanadi

### 🎯 Gamifikatsiya & Retention tizimi

1. **Balans bonuslari:**
   - 100k+ to'ldirsa → +5% bonus
   - 500k+ to'ldirsa → +10% bonus
   - 1M+ to'ldirsa → +15% bonus

2. **Kunlik faollik bonuslari:**
   - Har kuni kirsa → streak counter
   - 7 kun ketma-ket → 5,000 so'm bonus
   - 30 kun ketma-ket → 25,000 so'm bonus

3. **Upgrade triggers (UI):**
   - "Bu oyda X so'm yo'qotdingiz — Growth tarifda buni oldini olish mumkin edi"
   - "Sizning sotuvlaringiz o'sdi — Professional tarif sizga 3x foyda beradi"
   - Balans past bo'lganda → "To'ldiring va +10% bonus oling"

### 📝 Texnik ishlar:

1. **DB:** `subscription_plans` ni yangilash (4 ta yangi tarif)
2. **DB:** `user_activity_streaks` yangi jadval (streak tracking)  
3. **DB:** `balance_bonus_rules` yangi jadval
4. **DB:** `check_feature_access` funksiyasiga `data_retention_days` qo'shish
5. **Frontend:** `PlanSelector` qayta yozish
6. **Frontend:** `FeatureGate` ga data-retention cheklovi
7. **Frontend:** `UpgradeTrigger` ni kuchaytirish
8. **Frontend:** Streak/bonus UI komponenti
