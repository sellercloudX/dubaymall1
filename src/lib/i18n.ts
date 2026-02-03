export type Language = 'uz' | 'ru' | 'en';

export const translations = {
  uz: {
    // Common
    appName: 'SuperEshop Hub',
    tagline: 'O\'zbekiston va Markaziy Osiyo uchun e-commerce platforma',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    delete: 'O\'chirish',
    edit: 'Tahrirlash',
    add: 'Qo\'shish',
    search: 'Qidirish',
    filter: 'Filtr',
    loading: 'Yuklanmoqda...',
    noData: 'Ma\'lumot topilmadi',
    success: 'Muvaffaqiyatli!',
    error: 'Xatolik yuz berdi',
    required: 'Majburiy maydon',
    
    // Navigation
    home: 'Bosh sahifa',
    marketplace: 'Marketplace',
    login: 'Kirish',
    register: 'Ro\'yxatdan o\'tish',
    logout: 'Chiqish',
    dashboard: 'Boshqaruv paneli',
    profile: 'Profil',
    myShop: 'Mening do\'konim',
    myProducts: 'Mahsulotlarim',
    
    // Auth
    email: 'Email',
    password: 'Parol',
    confirmPassword: 'Parolni tasdiqlang',
    fullName: 'To\'liq ism',
    phone: 'Telefon raqami',
    forgotPassword: 'Parolni unutdingizmi?',
    noAccount: 'Hisobingiz yo\'qmi?',
    hasAccount: 'Hisobingiz bormi?',
    signIn: 'Kirish',
    signUp: 'Ro\'yxatdan o\'tish',
    
    // Roles
    selectRole: 'Rolni tanlang',
    seller: 'Sotuvchi',
    sellerDesc: 'O\'z do\'koningizni yarating va mahsulotlar soting',
    blogger: 'Blogger',
    bloggerDesc: 'Mahsulotlarni reklama qiling va komissiya oling',
    buyer: 'Xaridor',
    buyerDesc: 'Mahsulotlarni xarid qiling',
    
    // Landing
    heroTitle: 'Biznesingizni onlayn olib chiqing',
    heroSubtitle: 'Bir necha daqiqada professional do\'kon yarating, AI yordamida mahsulot qo\'shing va sotishni boshlang',
    getStarted: 'Boshlash',
    learnMore: 'Batafsil',
    
    // Features
    features: 'Imkoniyatlar',
    feature1Title: 'Bir bosishda do\'kon',
    feature1Desc: 'Professional do\'koningizni bir necha daqiqada yarating',
    feature2Title: 'AI mahsulot qo\'shish',
    feature2Desc: 'Rasmni yuklang - AI nom, ta\'rif va narx taklif qiladi',
    feature3Title: 'Dropshipping',
    feature3Desc: 'AliExpress va CJ dan mahsulotlarni import qiling',
    feature4Title: 'Affiliate tizimi',
    feature4Desc: 'Bloggerlar uchun komissiya dasturi',
    
    // Footer
    allRightsReserved: 'Barcha huquqlar himoyalangan',
    
    // Shop
    createShop: 'Do\'kon yaratish',
    shopName: 'Do\'kon nomi',
    shopDescription: 'Do\'kon haqida',
    shopSlug: 'Do\'kon URL manzili',
    shopLogo: 'Do\'kon logosi',
    shopCreated: 'Do\'kon muvaffaqiyatli yaratildi!',
    manageShop: 'Do\'konni boshqarish',
    viewShop: 'Do\'konni ko\'rish',
    shopSettings: 'Do\'kon sozlamalari',
    noShop: 'Sizda hali do\'kon yo\'q',
    createShopDesc: 'Do\'kon yarating va mahsulotlar sotishni boshlang',
    
    // Products
    products: 'Mahsulotlar',
    addProduct: 'Mahsulot qo\'shish',
    productName: 'Mahsulot nomi',
    productDescription: 'Mahsulot ta\'rifi',
    productPrice: 'Narxi',
    productOriginalPrice: 'Asl narxi',
    productStock: 'Omborda',
    productCategory: 'Kategoriya',
    productImages: 'Rasmlar',
    productStatus: 'Holati',
    productCreated: 'Mahsulot qo\'shildi!',
    productUpdated: 'Mahsulot yangilandi!',
    productDeleted: 'Mahsulot o\'chirildi!',
    
    // Product Status
    statusDraft: 'Qoralama',
    statusActive: 'Faol',
    statusInactive: 'Faol emas',
    statusOutOfStock: 'Tugagan',
    
    // Product Source
    sourceManual: 'Qo\'lda',
    sourceAI: 'AI orqali',
    sourceDropshipping: 'Dropshipping',
    
    // Add Product Methods
    addManually: 'Qo\'lda qo\'shish',
    addWithAI: 'AI orqali qo\'shish',
    addDropshipping: 'Dropshipping import',
    uploadImage: 'Rasm yuklash',
    analyzeImage: 'Rasmni tahlil qilish',
    aiSuggestion: 'AI tavsiyasi',
    
    // Affiliate
    enableAffiliate: 'Affiliate rejimini yoqish',
    commissionPercent: 'Komissiya foizi',
    
    // Stats
    totalProducts: 'Jami mahsulotlar',
    totalSales: 'Jami sotuvlar',
    totalViews: 'Ko\'rishlar',
    
    // Errors
    emailRequired: 'Email kiritish shart',
    passwordRequired: 'Parol kiritish shart',
    passwordMismatch: 'Parollar mos kelmadi',
    invalidEmail: 'Noto\'g\'ri email format',
    passwordTooShort: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak',
    shopNameRequired: 'Do\'kon nomi kiritish shart',
    productNameRequired: 'Mahsulot nomi kiritish shart',
    priceRequired: 'Narx kiritish shart',
    
    // Success
    registrationSuccess: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz! Email tasdiqlang.',
    loginSuccess: 'Muvaffaqiyatli kirdingiz!',
    
    // Cart & Checkout
    cart: 'Savatcha',
    addToCart: 'Savatga',
    addedToCart: 'Savatchaga qo\'shildi',
    cartEmpty: 'Savatcha bo\'sh',
    cartEmptyDesc: 'Hali hech narsa qo\'shmagansiz',
    loginRequired: 'Tizimga kiring',
    loginToViewCart: 'Savatchani ko\'rish uchun tizimga kiring',
    loginToCheckout: 'Buyurtma berish uchun tizimga kiring',
    subtotal: 'Jami',
    orderSummary: 'Buyurtma ma\'lumotlari',
    productsCount: 'Mahsulotlar',
    delivery: 'Yetkazib berish',
    free: 'Bepul',
    total: 'Jami to\'lov',
    checkout: 'Buyurtma berish',
    quantity: 'Miqdori',
    
    // Checkout
    shippingAddress: 'Yetkazib berish manzili',
    region: 'Viloyat',
    city: 'Shahar/Tuman',
    address: 'To\'liq manzil',
    notes: 'Izoh',
    paymentMethod: 'To\'lov usuli',
    cashOnDelivery: 'Naqd pul (yetkazib berishda)',
    cashOnDeliveryDesc: 'Mahsulotni qabul qilganda to\'laysiz',
    paymeDesc: 'Payme ilovasi orqali to\'lang',
    clickDesc: 'Click ilovasi orqali to\'lang',
    fillAllFields: 'Barcha maydonlarni to\'ldiring',
    placeOrder: 'Buyurtma berish',
    processing: 'Jarayonda...',
    orderSuccess: 'Buyurtma qabul qilindi!',
    orderNumber: 'Buyurtma raqami',
    orderConfirmation: 'Tez orada operatorimiz siz bilan bog\'lanadi',
    myOrders: 'Buyurtmalarim',
    continueShopping: 'Xaridni davom ettirish',
  },
  ru: {
    // Common
    appName: 'SuperEshop Hub',
    tagline: 'E-commerce платформа для Узбекистана и Центральной Азии',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    add: 'Добавить',
    search: 'Поиск',
    filter: 'Фильтр',
    loading: 'Загрузка...',
    noData: 'Данные не найдены',
    success: 'Успешно!',
    error: 'Произошла ошибка',
    required: 'Обязательное поле',
    
    // Navigation
    home: 'Главная',
    marketplace: 'Маркетплейс',
    login: 'Вход',
    register: 'Регистрация',
    logout: 'Выход',
    dashboard: 'Панель управления',
    profile: 'Профиль',
    myShop: 'Мой магазин',
    myProducts: 'Мои товары',
    
    // Auth
    email: 'Email',
    password: 'Пароль',
    confirmPassword: 'Подтвердите пароль',
    fullName: 'Полное имя',
    phone: 'Номер телефона',
    forgotPassword: 'Забыли пароль?',
    noAccount: 'Нет аккаунта?',
    hasAccount: 'Уже есть аккаунт?',
    signIn: 'Войти',
    signUp: 'Зарегистрироваться',
    
    // Roles
    selectRole: 'Выберите роль',
    seller: 'Продавец',
    sellerDesc: 'Создайте свой магазин и продавайте товары',
    blogger: 'Блогер',
    bloggerDesc: 'Рекламируйте товары и получайте комиссию',
    buyer: 'Покупатель',
    buyerDesc: 'Покупайте товары',
    
    // Landing
    heroTitle: 'Выведите свой бизнес онлайн',
    heroSubtitle: 'Создайте профессиональный магазин за несколько минут, добавляйте товары с помощью AI и начните продавать',
    getStarted: 'Начать',
    learnMore: 'Подробнее',
    
    // Features
    features: 'Возможности',
    feature1Title: 'Магазин в один клик',
    feature1Desc: 'Создайте профессиональный магазин за несколько минут',
    feature2Title: 'AI добавление товаров',
    feature2Desc: 'Загрузите фото - AI предложит название, описание и цену',
    feature3Title: 'Дропшиппинг',
    feature3Desc: 'Импортируйте товары с AliExpress и CJ',
    feature4Title: 'Партнерская система',
    feature4Desc: 'Комиссионная программа для блогеров',
    
    // Footer
    allRightsReserved: 'Все права защищены',
    
    // Shop
    createShop: 'Создать магазин',
    shopName: 'Название магазина',
    shopDescription: 'Описание магазина',
    shopSlug: 'URL адрес магазина',
    shopLogo: 'Логотип магазина',
    shopCreated: 'Магазин успешно создан!',
    manageShop: 'Управление магазином',
    viewShop: 'Просмотр магазина',
    shopSettings: 'Настройки магазина',
    noShop: 'У вас пока нет магазина',
    createShopDesc: 'Создайте магазин и начните продавать товары',
    
    // Products
    products: 'Товары',
    addProduct: 'Добавить товар',
    productName: 'Название товара',
    productDescription: 'Описание товара',
    productPrice: 'Цена',
    productOriginalPrice: 'Первоначальная цена',
    productStock: 'На складе',
    productCategory: 'Категория',
    productImages: 'Изображения',
    productStatus: 'Статус',
    productCreated: 'Товар добавлен!',
    productUpdated: 'Товар обновлен!',
    productDeleted: 'Товар удален!',
    
    // Product Status
    statusDraft: 'Черновик',
    statusActive: 'Активный',
    statusInactive: 'Неактивный',
    statusOutOfStock: 'Нет в наличии',
    
    // Product Source
    sourceManual: 'Вручную',
    sourceAI: 'Через AI',
    sourceDropshipping: 'Дропшиппинг',
    
    // Add Product Methods
    addManually: 'Добавить вручную',
    addWithAI: 'Добавить через AI',
    addDropshipping: 'Импорт дропшиппинг',
    uploadImage: 'Загрузить изображение',
    analyzeImage: 'Анализировать изображение',
    aiSuggestion: 'Предложение AI',
    
    // Affiliate
    enableAffiliate: 'Включить партнерский режим',
    commissionPercent: 'Процент комиссии',
    
    // Stats
    totalProducts: 'Всего товаров',
    totalSales: 'Всего продаж',
    totalViews: 'Просмотров',
    
    // Errors
    emailRequired: 'Email обязателен',
    passwordRequired: 'Пароль обязателен',
    passwordMismatch: 'Пароли не совпадают',
    invalidEmail: 'Неверный формат email',
    passwordTooShort: 'Пароль должен содержать минимум 6 символов',
    shopNameRequired: 'Название магазина обязательно',
    productNameRequired: 'Название товара обязательно',
    priceRequired: 'Цена обязательна',
    
    // Success
    registrationSuccess: 'Регистрация успешна! Подтвердите email.',
    loginSuccess: 'Вход выполнен успешно!',
    
    // Cart & Checkout
    cart: 'Корзина',
    addToCart: 'В корзину',
    addedToCart: 'Добавлено в корзину',
    cartEmpty: 'Корзина пуста',
    cartEmptyDesc: 'Вы ещё ничего не добавили',
    loginRequired: 'Войдите в систему',
    loginToViewCart: 'Войдите, чтобы увидеть корзину',
    loginToCheckout: 'Войдите, чтобы оформить заказ',
    subtotal: 'Итого',
    orderSummary: 'Информация о заказе',
    productsCount: 'Товары',
    delivery: 'Доставка',
    free: 'Бесплатно',
    total: 'К оплате',
    checkout: 'Оформить заказ',
    quantity: 'Количество',
    
    // Checkout
    shippingAddress: 'Адрес доставки',
    region: 'Область',
    city: 'Город/Район',
    address: 'Полный адрес',
    notes: 'Комментарий',
    paymentMethod: 'Способ оплаты',
    cashOnDelivery: 'Наличные (при получении)',
    cashOnDeliveryDesc: 'Оплата при получении товара',
    paymeDesc: 'Оплата через Payme',
    clickDesc: 'Оплата через Click',
    fillAllFields: 'Заполните все поля',
    placeOrder: 'Оформить заказ',
    processing: 'Обработка...',
    orderSuccess: 'Заказ принят!',
    orderNumber: 'Номер заказа',
    orderConfirmation: 'Наш оператор свяжется с вами в ближайшее время',
    myOrders: 'Мои заказы',
    continueShopping: 'Продолжить покупки',
  },
  en: {
    // Common
    appName: 'SuperEshop Hub',
    tagline: 'E-commerce platform for Uzbekistan and Central Asia',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    loading: 'Loading...',
    noData: 'No data found',
    success: 'Success!',
    error: 'An error occurred',
    required: 'Required field',
    
    // Navigation
    home: 'Home',
    marketplace: 'Marketplace',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    dashboard: 'Dashboard',
    profile: 'Profile',
    myShop: 'My Shop',
    myProducts: 'My Products',
    
    // Auth
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fullName: 'Full Name',
    phone: 'Phone Number',
    forgotPassword: 'Forgot password?',
    noAccount: 'Don\'t have an account?',
    hasAccount: 'Already have an account?',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    
    // Roles
    selectRole: 'Select Role',
    seller: 'Seller',
    sellerDesc: 'Create your shop and sell products',
    blogger: 'Blogger',
    bloggerDesc: 'Promote products and earn commission',
    buyer: 'Buyer',
    buyerDesc: 'Buy products',
    
    // Landing
    heroTitle: 'Take Your Business Online',
    heroSubtitle: 'Create a professional store in minutes, add products with AI, and start selling',
    getStarted: 'Get Started',
    learnMore: 'Learn More',
    
    // Features
    features: 'Features',
    feature1Title: 'One-Click Store',
    feature1Desc: 'Create your professional store in minutes',
    feature2Title: 'AI Product Adding',
    feature2Desc: 'Upload a photo - AI suggests name, description and price',
    feature3Title: 'Dropshipping',
    feature3Desc: 'Import products from AliExpress and CJ',
    feature4Title: 'Affiliate System',
    feature4Desc: 'Commission program for bloggers',
    
    // Footer
    allRightsReserved: 'All rights reserved',
    
    // Shop
    createShop: 'Create Shop',
    shopName: 'Shop Name',
    shopDescription: 'Shop Description',
    shopSlug: 'Shop URL',
    shopLogo: 'Shop Logo',
    shopCreated: 'Shop created successfully!',
    manageShop: 'Manage Shop',
    viewShop: 'View Shop',
    shopSettings: 'Shop Settings',
    noShop: 'You don\'t have a shop yet',
    createShopDesc: 'Create a shop and start selling products',
    
    // Products
    products: 'Products',
    addProduct: 'Add Product',
    productName: 'Product Name',
    productDescription: 'Product Description',
    productPrice: 'Price',
    productOriginalPrice: 'Original Price',
    productStock: 'In Stock',
    productCategory: 'Category',
    productImages: 'Images',
    productStatus: 'Status',
    productCreated: 'Product added!',
    productUpdated: 'Product updated!',
    productDeleted: 'Product deleted!',
    
    // Product Status
    statusDraft: 'Draft',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    statusOutOfStock: 'Out of Stock',
    
    // Product Source
    sourceManual: 'Manual',
    sourceAI: 'Via AI',
    sourceDropshipping: 'Dropshipping',
    
    // Add Product Methods
    addManually: 'Add Manually',
    addWithAI: 'Add with AI',
    addDropshipping: 'Dropshipping Import',
    uploadImage: 'Upload Image',
    analyzeImage: 'Analyze Image',
    aiSuggestion: 'AI Suggestion',
    
    // Affiliate
    enableAffiliate: 'Enable Affiliate Mode',
    commissionPercent: 'Commission Percent',
    
    // Stats
    totalProducts: 'Total Products',
    totalSales: 'Total Sales',
    totalViews: 'Views',
    
    // Errors
    emailRequired: 'Email is required',
    passwordRequired: 'Password is required',
    passwordMismatch: 'Passwords do not match',
    invalidEmail: 'Invalid email format',
    passwordTooShort: 'Password must be at least 6 characters',
    shopNameRequired: 'Shop name is required',
    productNameRequired: 'Product name is required',
    priceRequired: 'Price is required',
    
    // Success
    registrationSuccess: 'Registration successful! Please verify your email.',
    loginSuccess: 'Login successful!',
    
    // Cart & Checkout
    cart: 'Cart',
    addToCart: 'Add to Cart',
    addedToCart: 'Added to cart',
    cartEmpty: 'Cart is empty',
    cartEmptyDesc: 'You haven\'t added anything yet',
    loginRequired: 'Please log in',
    loginToViewCart: 'Log in to view your cart',
    loginToCheckout: 'Log in to checkout',
    subtotal: 'Subtotal',
    orderSummary: 'Order Summary',
    productsCount: 'Products',
    delivery: 'Delivery',
    free: 'Free',
    total: 'Total',
    checkout: 'Checkout',
    quantity: 'Quantity',
    
    // Checkout
    shippingAddress: 'Shipping Address',
    region: 'Region',
    city: 'City/District',
    address: 'Full Address',
    notes: 'Notes',
    paymentMethod: 'Payment Method',
    cashOnDelivery: 'Cash on Delivery',
    cashOnDeliveryDesc: 'Pay when you receive your order',
    paymeDesc: 'Pay via Payme app',
    clickDesc: 'Pay via Click app',
    fillAllFields: 'Please fill all fields',
    placeOrder: 'Place Order',
    processing: 'Processing...',
    orderSuccess: 'Order placed!',
    orderNumber: 'Order number',
    orderConfirmation: 'Our operator will contact you soon',
    myOrders: 'My Orders',
    continueShopping: 'Continue Shopping',
  },
};

export function useTranslation(language: Language) {
  return translations[language];
}

export function getStoredLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('language');
    if (stored && ['uz', 'ru', 'en'].includes(stored)) {
      return stored as Language;
    }
  }
  return 'uz';
}

export function setStoredLanguage(language: Language) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', language);
  }
}