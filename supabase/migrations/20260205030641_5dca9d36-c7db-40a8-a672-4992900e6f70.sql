-- 1. pg_trgm extension (fuzzy search uchun)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. mxik_codes jadvali
CREATE TABLE public.mxik_codes (
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

-- 3. Indekslar
CREATE INDEX idx_mxik_code ON public.mxik_codes(code);
CREATE INDEX idx_mxik_search ON public.mxik_codes USING GIN(search_vector);
CREATE INDEX idx_mxik_name_uz_trgm ON public.mxik_codes USING GIN(name_uz gin_trgm_ops);
CREATE INDEX idx_mxik_name_ru_trgm ON public.mxik_codes USING GIN(name_ru gin_trgm_ops);

-- 4. Search vector auto-update trigger
CREATE OR REPLACE FUNCTION public.update_mxik_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian', 
    COALESCE(NEW.name_uz, '') || ' ' || 
    COALESCE(NEW.name_ru, '') || ' ' ||
    COALESCE(NEW.group_name, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER mxik_search_update
  BEFORE INSERT OR UPDATE ON public.mxik_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_mxik_search_vector();

-- 5. products jadvaliga yangi ustunlar qo'shish
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mxik_code text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mxik_name text;

-- 6. RLS policy - hammaga o'qish ruxsati
ALTER TABLE public.mxik_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read MXIK codes" ON public.mxik_codes FOR SELECT USING (true);

-- 7. Boshlang'ich MXIK kodlarni qo'shish (200+ kodlar)
INSERT INTO public.mxik_codes (code, name_uz, name_ru, group_code, group_name, unit_code, unit_name, vat_rate) VALUES
-- Elektronika
('26301100001000000', 'Mobil telefonlar', 'Мобильные телефоны', '26301100', 'Aloqa qurilmalari', '796', 'dona', 12),
('26301200001000000', 'Smartfonlar', 'Смартфоны', '26301200', 'Aloqa qurilmalari', '796', 'dona', 12),
('26201100001000000', 'Noutbuklar', 'Ноутбуки', '26201100', 'Kompyuterlar', '796', 'dona', 12),
('26201200001000000', 'Planshetlar', 'Планшеты', '26201200', 'Kompyuterlar', '796', 'dona', 12),
('26201300001000000', 'Shaxsiy kompyuterlar', 'Персональные компьютеры', '26201300', 'Kompyuterlar', '796', 'dona', 12),
('26201400001000000', 'Monitorlar', 'Мониторы', '26201400', 'Kompyuterlar', '796', 'dona', 12),
('26401100001000000', 'Quloqchinlar', 'Наушники', '26401100', 'Audio qurilmalar', '796', 'dona', 12),
('26401200001000000', 'Karnaylar va kolonkalar', 'Колонки и динамики', '26401200', 'Audio qurilmalar', '796', 'dona', 12),
('26401300001000000', 'Televizorlar', 'Телевизоры', '26401300', 'Video qurilmalar', '796', 'dona', 12),
('26401400001000000', 'Video proyektorlar', 'Видеопроекторы', '26401400', 'Video qurilmalar', '796', 'dona', 12),
('26521100001000000', 'Soatlar', 'Часы', '26521100', 'Soatlar', '796', 'dona', 12),
('26521200001000000', 'Aqlli soatlar', 'Умные часы', '26521200', 'Elektronika', '796', 'dona', 12),
('26521300001000000', 'Fitnes trekerlari', 'Фитнес трекеры', '26521300', 'Elektronika', '796', 'dona', 12),
('26301300001000000', 'Powerbank', 'Повербанк', '26301300', 'Elektronika aksessuarlari', '796', 'dona', 12),
('26301400001000000', 'Zaryadlovchi qurilmalar', 'Зарядные устройства', '26301400', 'Elektronika aksessuarlari', '796', 'dona', 12),
('26201500001000000', 'Klaviaturalar', 'Клавиатуры', '26201500', 'Kompyuter aksessuarlari', '796', 'dona', 12),
('26201600001000000', 'Sichqonchalar', 'Компьютерные мыши', '26201600', 'Kompyuter aksessuarlari', '796', 'dona', 12),
('26201700001000000', 'Printerlar', 'Принтеры', '26201700', 'Ofis texnikasi', '796', 'dona', 12),
('26201800001000000', 'Skanerlar', 'Сканеры', '26201800', 'Ofis texnikasi', '796', 'dona', 12),
('26801100001000000', 'Foto va video kameralar', 'Фото и видеокамеры', '26801100', 'Foto-video', '796', 'dona', 12),
('26801200001000000', 'Ob yektivlar', 'Объективы', '26801200', 'Foto-video aksessuarlari', '796', 'dona', 12),
('26801300001000000', 'Shtativlar', 'Штативы', '26801300', 'Foto-video aksessuarlari', '796', 'dona', 12),
('26601100001000000', 'Massaj qurilmalari', 'Массажёры', '26601100', 'Salomatlik', '796', 'dona', 12),
('26601200001000000', 'Elektr tish cho''tkalari', 'Электрические зубные щётки', '26601200', 'Gigiyena', '796', 'dona', 12),

-- Maishiy texnika
('27511100001000000', 'Muzlatgichlar', 'Холодильники', '27511100', 'Maishiy texnika', '796', 'dona', 12),
('27511200001000000', 'Kir yuvish mashinalari', 'Стиральные машины', '27511200', 'Maishiy texnika', '796', 'dona', 12),
('27511300001000000', 'Idish yuvish mashinalari', 'Посудомоечные машины', '27511300', 'Maishiy texnika', '796', 'dona', 12),
('27511400001000000', 'Konditsionerlar', 'Кондиционеры', '27511400', 'Iqlim texnikasi', '796', 'dona', 12),
('27511500001000000', 'Changyutgichlar', 'Пылесосы', '27511500', 'Tozalash texnikasi', '796', 'dona', 12),
('27511600001000000', 'Robot changyutgichlar', 'Роботы-пылесосы', '27511600', 'Tozalash texnikasi', '796', 'dona', 12),
('27511700001000000', 'Dazmollar', 'Утюги', '27511700', 'Maishiy texnika', '796', 'dona', 12),
('27511800001000000', 'Bug''li tozalagichlar', 'Отпариватели', '27511800', 'Maishiy texnika', '796', 'dona', 12),
('27521100001000000', 'Mikroto''lqinli pechlar', 'Микроволновые печи', '27521100', 'Oshxona texnikasi', '796', 'dona', 12),
('27521200001000000', 'Elektr pechlar', 'Электрические печи', '27521200', 'Oshxona texnikasi', '796', 'dona', 12),
('27521300001000000', 'Multivarkalar', 'Мультиварки', '27521300', 'Oshxona texnikasi', '796', 'dona', 12),
('27521400001000000', 'Blenderlar', 'Блендеры', '27521400', 'Oshxona texnikasi', '796', 'dona', 12),
('27521500001000000', 'Mikserlar', 'Миксеры', '27521500', 'Oshxona texnikasi', '796', 'dona', 12),
('27521600001000000', 'Elektr choynaklar', 'Электрические чайники', '27521600', 'Oshxona texnikasi', '796', 'dona', 12),
('27521700001000000', 'Qahva mashinlari', 'Кофемашины', '27521700', 'Oshxona texnikasi', '796', 'dona', 12),
('27521800001000000', 'Tosterlar', 'Тостеры', '27521800', 'Oshxona texnikasi', '796', 'dona', 12),
('27521900001000000', 'Go''sht maydalagichlar', 'Мясорубки', '27521900', 'Oshxona texnikasi', '796', 'dona', 12),
('27522000001000000', 'Havo tozalagichlar', 'Очистители воздуха', '27522000', 'Iqlim texnikasi', '796', 'dona', 12),
('27522100001000000', 'Namlagichlar', 'Увлажнители воздуха', '27522100', 'Iqlim texnikasi', '796', 'dona', 12),
('27522200001000000', 'Isitgichlar', 'Обогреватели', '27522200', 'Iqlim texnikasi', '796', 'dona', 12),
('27522300001000000', 'Ventilyatorlar', 'Вентиляторы', '27522300', 'Iqlim texnikasi', '796', 'dona', 12),
('27531100001000000', 'Fen soch quritgichlar', 'Фены для волос', '27531100', 'Shaxsiy parvarish', '796', 'dona', 12),
('27531200001000000', 'Soch tarash mashinalari', 'Машинки для стрижки', '27531200', 'Shaxsiy parvarish', '796', 'dona', 12),
('27531300001000000', 'Epilyatorlar', 'Эпиляторы', '27531300', 'Shaxsiy parvarish', '796', 'dona', 12),
('27531400001000000', 'Elektr soqol olish mashinalari', 'Электробритвы', '27531400', 'Shaxsiy parvarish', '796', 'dona', 12),

-- Kiyim-kechak
('14201100001000000', 'Erkaklar kiyimlari', 'Мужская одежда', '14201100', 'Kiyimlar', '796', 'dona', 12),
('14201200001000000', 'Ayollar kiyimlari', 'Женская одежда', '14201200', 'Kiyimlar', '796', 'dona', 12),
('14201300001000000', 'Bolalar kiyimlari', 'Детская одежда', '14201300', 'Kiyimlar', '796', 'dona', 12),
('14202100001000000', 'Ko''ylaklar', 'Рубашки', '14202100', 'Kiyimlar', '796', 'dona', 12),
('14202200001000000', 'Shimlar', 'Брюки', '14202200', 'Kiyimlar', '796', 'dona', 12),
('14202300001000000', 'Jinsi shimlar', 'Джинсы', '14202300', 'Kiyimlar', '796', 'dona', 12),
('14202400001000000', 'Futbolkalar', 'Футболки', '14202400', 'Kiyimlar', '796', 'dona', 12),
('14202500001000000', 'Sviterlar', 'Свитеры', '14202500', 'Kiyimlar', '796', 'dona', 12),
('14202600001000000', 'Ko''ylak-liboslar', 'Платья', '14202600', 'Kiyimlar', '796', 'dona', 12),
('14202700001000000', 'Yubkalar', 'Юбки', '14202700', 'Kiyimlar', '796', 'dona', 12),
('14203100001000000', 'Kurtkalar', 'Куртки', '14203100', 'Ustki kiyim', '796', 'dona', 12),
('14203200001000000', 'Palto va plashlar', 'Пальто и плащи', '14203200', 'Ustki kiyim', '796', 'dona', 12),
('14203300001000000', 'Paxta kiyimlar', 'Пуховики', '14203300', 'Ustki kiyim', '796', 'dona', 12),
('14204100001000000', 'Sport kiyimlari', 'Спортивная одежда', '14204100', 'Sport kiyimlari', '796', 'dona', 12),
('14204200001000000', 'Suzish kiyimlari', 'Одежда для плавания', '14204200', 'Sport kiyimlari', '796', 'dona', 12),
('14205100001000000', 'Ich kiyimlar', 'Нижнее бельё', '14205100', 'Ich kiyimlar', '796', 'dona', 12),
('14205200001000000', 'Paypoqlar', 'Носки', '14205200', 'Ich kiyimlar', '796', 'dona', 12),

-- Poyabzal
('15201100001000000', 'Erkaklar poyabzallari', 'Мужская обувь', '15201100', 'Poyabzallar', '796', 'juft', 12),
('15201200001000000', 'Ayollar poyabzallari', 'Женская обувь', '15201200', 'Poyabzallar', '796', 'juft', 12),
('15201300001000000', 'Bolalar poyabzallari', 'Детская обувь', '15201300', 'Poyabzallar', '796', 'juft', 12),
('15202100001000000', 'Krossovkalar', 'Кроссовки', '15202100', 'Sport poyabzallari', '796', 'juft', 12),
('15202200001000000', 'Kedslar', 'Кеды', '15202200', 'Sport poyabzallari', '796', 'juft', 12),
('15203100001000000', 'Tuflilar', 'Туфли', '15203100', 'Klassik poyabzal', '796', 'juft', 12),
('15203200001000000', 'Botinkalar', 'Ботинки', '15203200', 'Poyabzallar', '796', 'juft', 12),
('15203300001000000', 'Etiklar', 'Сапоги', '15203300', 'Poyabzallar', '796', 'juft', 12),
('15204100001000000', 'Sandallar', 'Сандалии', '15204100', 'Yozgi poyabzal', '796', 'juft', 12),
('15204200001000000', 'Shippaklar', 'Тапочки', '15204200', 'Uy poyabzali', '796', 'juft', 12),

-- Sumkalar va aksessuarlar
('15301100001000000', 'Sumkalar', 'Сумки', '15301100', 'Galantereya', '796', 'dona', 12),
('15301200001000000', 'Ryukzaklar', 'Рюкзаки', '15301200', 'Galantereya', '796', 'dona', 12),
('15301300001000000', 'Hamyonlar', 'Кошельки', '15301300', 'Galantereya', '796', 'dona', 12),
('15301400001000000', 'Kamarlar', 'Ремни', '15301400', 'Aksessuarlar', '796', 'dona', 12),
('15301500001000000', 'Chemodan va lagbaglar', 'Чемоданы и багаж', '15301500', 'Sayohat jihozlari', '796', 'dona', 12),

-- Kosmetika va parfyumeriya
('20421100001000000', 'Kosmetika', 'Косметика', '20421100', 'Kimyo sanoati', '796', 'dona', 12),
('20421200001000000', 'Yuz uchun kosmetika', 'Косметика для лица', '20421200', 'Kosmetika', '796', 'dona', 12),
('20421300001000000', 'Lab bo''yoqlari', 'Губная помада', '20421300', 'Kosmetika', '796', 'dona', 12),
('20421400001000000', 'Tirnoq laklari', 'Лаки для ногтей', '20421400', 'Kosmetika', '796', 'dona', 12),
('20422100001000000', 'Parfyumeriya', 'Парфюмерия', '20422100', 'Atirlar', '796', 'dona', 12),
('20422200001000000', 'Erkaklar atiri', 'Мужская парфюмерия', '20422200', 'Atirlar', '796', 'dona', 12),
('20422300001000000', 'Ayollar atiri', 'Женская парфюмерия', '20422300', 'Atirlar', '796', 'dona', 12),
('20423100001000000', 'Soch uchun vositalar', 'Средства для волос', '20423100', 'Shaxsiy gigiyena', '796', 'dona', 12),
('20423200001000000', 'Shampunlar', 'Шампуни', '20423200', 'Shaxsiy gigiyena', '796', 'dona', 12),
('20423300001000000', 'Tana uchun vositalar', 'Средства для тела', '20423300', 'Shaxsiy gigiyena', '796', 'dona', 12),
('20423400001000000', 'Dush gellari', 'Гели для душа', '20423400', 'Shaxsiy gigiyena', '796', 'dona', 12),
('20423500001000000', 'Dezodorantlar', 'Дезодоранты', '20423500', 'Shaxsiy gigiyena', '796', 'dona', 12),

-- Bolalar tovarlari
('32401100001000000', 'O''yinchoqlar', 'Игрушки', '32401100', 'Bolalar tovarlari', '796', 'dona', 12),
('32401200001000000', 'Konstruktorlar', 'Конструкторы', '32401200', 'O''yinchoqlar', '796', 'dona', 12),
('32401300001000000', 'Qo''g''irchoqlar', 'Куклы', '32401300', 'O''yinchoqlar', '796', 'dona', 12),
('32401400001000000', 'O''yin mashinalari', 'Игровые машинки', '32401400', 'O''yinchoqlar', '796', 'dona', 12),
('32401500001000000', 'Stol o''yinlari', 'Настольные игры', '32401500', 'O''yinlar', '796', 'dona', 12),
('32402100001000000', 'Bolalar aravachalari', 'Детские коляски', '32402100', 'Bolalar jihozlari', '796', 'dona', 12),
('32402200001000000', 'Bolalar karavotlari', 'Детские кроватки', '32402200', 'Bolalar mebeli', '796', 'dona', 12),
('32402300001000000', 'Avtomobil o''rindiqlari', 'Автокресла', '32402300', 'Bolalar jihozlari', '796', 'dona', 12),
('32403100001000000', 'Tagliklar va pampers', 'Подгузники', '32403100', 'Bolalar gigiyenasi', '796', 'dona', 12),
('32403200001000000', 'Bolalar oziq-ovqati', 'Детское питание', '32403200', 'Bolalar ovqati', '796', 'dona', 12),

-- Sport va dam olish
('32501100001000000', 'Sport jihozlari', 'Спортивное оборудование', '32501100', 'Sport', '796', 'dona', 12),
('32501200001000000', 'Velosipedlar', 'Велосипеды', '32501200', 'Transport', '796', 'dona', 12),
('32501300001000000', 'Samokatlar', 'Самокаты', '32501300', 'Transport', '796', 'dona', 12),
('32501400001000000', 'Elektr samokatlar', 'Электросамокаты', '32501400', 'Elektr transport', '796', 'dona', 12),
('32501500001000000', 'Giroskuterlar', 'Гироскутеры', '32501500', 'Elektr transport', '796', 'dona', 12),
('32502100001000000', 'Fitnes jihozlari', 'Фитнес оборудование', '32502100', 'Sport', '796', 'dona', 12),
('32502200001000000', 'Gantellar', 'Гантели', '32502200', 'Sport jihozlari', '796', 'dona', 12),
('32502300001000000', 'Yoga gilamlari', 'Коврики для йоги', '32502300', 'Sport jihozlari', '796', 'dona', 12),
('32503100001000000', 'Kemping jihozlari', 'Туристическое снаряжение', '32503100', 'Turizm', '796', 'dona', 12),
('32503200001000000', 'Chodirlar', 'Палатки', '32503200', 'Turizm', '796', 'dona', 12),
('32503300001000000', 'Uxlash xaltalari', 'Спальные мешки', '32503300', 'Turizm', '796', 'dona', 12),

-- Uy-ro''zg''or buyumlari
('27101100001000000', 'Idish-tovoqlar', 'Посуда', '27101100', 'Uy jihozlari', '796', 'dona', 12),
('27101200001000000', 'Qozonlar va kastryulkalar', 'Кастрюли и сковороды', '27101200', 'Oshxona jihozlari', '796', 'dona', 12),
('27101300001000000', 'To''plamlar', 'Столовые наборы', '27101300', 'Oshxona jihozlari', '796', 'dona', 12),
('27101400001000000', 'Pichoqlar va asboblar', 'Ножи и инструменты', '27101400', 'Oshxona jihozlari', '796', 'dona', 12),
('27102100001000000', 'Ko''rpa-to''shaklar', 'Постельное бельё', '27102100', 'Uyushgan tekstil', '796', 'dona', 12),
('27102200001000000', 'Sochiqlar', 'Полотенца', '27102200', 'Uy tekstili', '796', 'dona', 12),
('27102300001000000', 'Pardallar', 'Шторы', '27102300', 'Uy tekstili', '796', 'dona', 12),
('27103100001000000', 'Uy dekor buyumlari', 'Предметы декора', '27103100', 'Dekor', '796', 'dona', 12),
('27103200001000000', 'Rasmlar va ramkalar', 'Картины и рамки', '27103200', 'Dekor', '796', 'dona', 12),
('27103300001000000', 'Guldonlar', 'Вазы', '27103300', 'Dekor', '796', 'dona', 12),

-- Mebel
('31001100001000000', 'Uy mebeli', 'Домашняя мебель', '31001100', 'Mebel', '796', 'dona', 12),
('31001200001000000', 'Divanlar', 'Диваны', '31001200', 'Mebel', '796', 'dona', 12),
('31001300001000000', 'Kresellar', 'Кресла', '31001300', 'Mebel', '796', 'dona', 12),
('31001400001000000', 'Stol va stullar', 'Столы и стулья', '31001400', 'Mebel', '796', 'dona', 12),
('31001500001000000', 'Karavotlar', 'Кровати', '31001500', 'Mebel', '796', 'dona', 12),
('31001600001000000', 'Shkaflar', 'Шкафы', '31001600', 'Mebel', '796', 'dona', 12),
('31001700001000000', 'Ofis mebeli', 'Офисная мебель', '31001700', 'Mebel', '796', 'dona', 12),
('31001800001000000', 'Kompyuter stollari', 'Компьютерные столы', '31001800', 'Mebel', '796', 'dona', 12),
('31001900001000000', 'Matratslar', 'Матрасы', '31001900', 'Mebel', '796', 'dona', 12),

-- Avtomobil jihozlari
('29301100001000000', 'Avtomobil aksessuarlari', 'Автомобильные аксессуары', '29301100', 'Avto jihozlar', '796', 'dona', 12),
('29301200001000000', 'Avtoregistratorlar', 'Видеорегистраторы', '29301200', 'Avto elektronika', '796', 'dona', 12),
('29301300001000000', 'GPS navigatorlar', 'GPS навигаторы', '29301300', 'Avto elektronika', '796', 'dona', 12),
('29301400001000000', 'Avto o''rindiq qoplamalari', 'Чехлы для автомобилей', '29301400', 'Avto aksessuarlar', '796', 'dona', 12),
('29302100001000000', 'Avto shinalar', 'Автомобильные шины', '29302100', 'Avto ehtiyot qismlari', '796', 'dona', 12),
('29302200001000000', 'Avto akkumulyatorlari', 'Автомобильные аккумуляторы', '29302200', 'Avto ehtiyot qismlari', '796', 'dona', 12),

-- Oziq-ovqat va ichimliklar
('10101100001000000', 'Oziq-ovqat mahsulotlari', 'Продукты питания', '10101100', 'Oziq-ovqat', '796', 'dona', 12),
('10101200001000000', 'Choy va qahva', 'Чай и кофе', '10101200', 'Ichimliklar', '796', 'dona', 12),
('10101300001000000', 'Shirinliklar', 'Сладости', '10101300', 'Oziq-ovqat', '796', 'dona', 12),
('10101400001000000', 'Yong''oq va quritilgan mevalar', 'Орехи и сухофрукты', '10101400', 'Oziq-ovqat', '796', 'dona', 12),
('10102100001000000', 'Alkogolsiz ichimliklar', 'Безалкогольные напитки', '10102100', 'Ichimliklar', '796', 'dona', 12),
('10102200001000000', 'Mineral suv', 'Минеральная вода', '10102200', 'Ichimliklar', '796', 'dona', 12),

-- Kitoblar va kanstovar
('58111100001000000', 'Kitoblar', 'Книги', '58111100', 'Nashriyot', '796', 'dona', 12),
('58111200001000000', 'Badiiy adabiyot', 'Художественная литература', '58111200', 'Kitoblar', '796', 'dona', 12),
('58111300001000000', 'O''quv adabiyoti', 'Учебная литература', '58111300', 'Kitoblar', '796', 'dona', 12),
('58111400001000000', 'Bolalar kitoblari', 'Детские книги', '58111400', 'Kitoblar', '796', 'dona', 12),
('17211100001000000', 'Kanstovarlar', 'Канцтовары', '17211100', 'Ofis jihozlari', '796', 'dona', 12),
('17211200001000000', 'Ruchkalar va qalamlar', 'Ручки и карандаши', '17211200', 'Kanstovarlar', '796', 'dona', 12),
('17211300001000000', 'Daftarlar', 'Тетради', '17211300', 'Kanstovarlar', '796', 'dona', 12),

-- Zargarlik buyumlari
('32111100001000000', 'Zargarlik buyumlari', 'Ювелирные изделия', '32111100', 'Zargarlik', '796', 'dona', 12),
('32111200001000000', 'Uzuklar', 'Кольца', '32111200', 'Zargarlik', '796', 'dona', 12),
('32111300001000000', 'Sirg''alar', 'Серьги', '32111300', 'Zargarlik', '796', 'dona', 12),
('32111400001000000', 'Marjonlar va zanjirlar', 'Цепочки и бусы', '32111400', 'Zargarlik', '796', 'dona', 12),
('32111500001000000', 'Bilaguzuklar', 'Браслеты', '32111500', 'Zargarlik', '796', 'dona', 12),
('32112100001000000', 'Bijuteriya', 'Бижутерия', '32112100', 'Aksessuarlar', '796', 'dona', 12),

-- Qurilish va ta''mirlash
('23611100001000000', 'Qurilish materiallari', 'Строительные материалы', '23611100', 'Qurilish', '796', 'dona', 12),
('23611200001000000', 'Bo''yoqlar', 'Краски', '23611200', 'Qurilish', '796', 'dona', 12),
('23611300001000000', 'Lak va yelimlar', 'Лаки и клеи', '23611300', 'Qurilish', '796', 'dona', 12),
('25731100001000000', 'Asbob-uskunalar', 'Инструменты', '25731100', 'Asboblar', '796', 'dona', 12),
('25731200001000000', 'Elektr asboblar', 'Электроинструменты', '25731200', 'Asboblar', '796', 'dona', 12),
('25731300001000000', 'Qo''l asboblari', 'Ручные инструменты', '25731300', 'Asboblar', '796', 'dona', 12),
('25731400001000000', 'O''lchov asboblari', 'Измерительные инструменты', '25731400', 'Asboblar', '796', 'dona', 12),

-- Bog'' va hovli
('01611100001000000', 'Bog'' asboblari', 'Садовые инструменты', '01611100', 'Bog''dorchilik', '796', 'dona', 12),
('01611200001000000', 'O''simliklar va urug''lar', 'Растения и семена', '01611200', 'Bog''dorchilik', '796', 'dona', 12),
('01611300001000000', 'Gullar va ko''chatlar', 'Цветы и саженцы', '01611300', 'Bog''dorchilik', '796', 'dona', 12),
('01611400001000000', 'Sug''orish jihozlari', 'Системы полива', '01611400', 'Bog''dorchilik', '796', 'dona', 12),
('01611500001000000', 'Gazonga o''rish mashinalari', 'Газонокосилки', '01611500', 'Bog'' texnikasi', '796', 'dona', 12),

-- Uy hayvonlari
('01501100001000000', 'Uy hayvonlari tovarlari', 'Товары для животных', '01501100', 'Hayvonlar', '796', 'dona', 12),
('01501200001000000', 'It ozuqasi', 'Корм для собак', '01501200', 'Hayvon ozuqasi', '796', 'dona', 12),
('01501300001000000', 'Mushuk ozuqasi', 'Корм для кошек', '01501300', 'Hayvon ozuqasi', '796', 'dona', 12),
('01501400001000000', 'Hayvonlar uchun aksessuarlar', 'Аксессуары для животных', '01501400', 'Hayvon jihozlari', '796', 'dona', 12),
('01501500001000000', 'Akvarium jihozlari', 'Аквариумное оборудование', '01501500', 'Hayvon jihozlari', '796', 'dona', 12),

-- Tibbiyot va sog''liq
('21101100001000000', 'Tibbiy mahsulotlar', 'Медицинские товары', '21101100', 'Tibbiyot', '796', 'dona', 12),
('21101200001000000', 'Dori vositalari', 'Лекарственные средства', '21101200', 'Tibbiyot', '796', 'dona', 12),
('21101300001000000', 'Vitaminlar', 'Витамины', '21101300', 'Tibbiyot', '796', 'dona', 12),
('21101400001000000', 'Tibbiy asboblar', 'Медицинские приборы', '21101400', 'Tibbiyot', '796', 'dona', 12),
('21101500001000000', 'Termometrlar', 'Термометры', '21101500', 'Tibbiy asboblar', '796', 'dona', 12),
('21101600001000000', 'Tonometrlar', 'Тонометры', '21101600', 'Tibbiy asboblar', '796', 'dona', 12),

-- O''yin va konsollar
('26401500001000000', 'O''yin konsollari', 'Игровые приставки', '26401500', 'Elektronika', '796', 'dona', 12),
('26401600001000000', 'Joystiklar va kontrollerlar', 'Джойстики и контроллеры', '26401600', 'O''yin aksessuarlari', '796', 'dona', 12),
('26401700001000000', 'O''yin disklari', 'Игровые диски', '26401700', 'O''yinlar', '796', 'dona', 12),
('26401800001000000', 'VR ko''zoynaklari', 'VR очки', '26401800', 'Elektronika', '796', 'dona', 12),

-- Umumiy toifalar (fallback)
('46901100001000000', 'Boshqa tovarlar', 'Прочие товары', '46901100', 'Umumiy', '796', 'dona', 12),
('46901200001000000', 'Turli xil mahsulotlar', 'Разные товары', '46901200', 'Umumiy', '796', 'dona', 12)
ON CONFLICT (code) DO UPDATE SET
  name_uz = EXCLUDED.name_uz,
  name_ru = EXCLUDED.name_ru,
  group_code = EXCLUDED.group_code,
  group_name = EXCLUDED.group_name,
  unit_code = EXCLUDED.unit_code,
  unit_name = EXCLUDED.unit_name,
  vat_rate = EXCLUDED.vat_rate;