export type Language = 'uz' | 'ru' | 'en';

export const translations = {
  uz: {
    // Common
    appName: 'SuperEshop Hub',
    tagline: 'O\'zbekiston va Markaziy Osiyo uchun e-commerce platforma',
    
    // Navigation
    home: 'Bosh sahifa',
    marketplace: 'Marketplace',
    login: 'Kirish',
    register: 'Ro\'yxatdan o\'tish',
    logout: 'Chiqish',
    dashboard: 'Boshqaruv paneli',
    profile: 'Profil',
    
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
    
    // Errors
    emailRequired: 'Email kiritish shart',
    passwordRequired: 'Parol kiritish shart',
    passwordMismatch: 'Parollar mos kelmadi',
    invalidEmail: 'Noto\'g\'ri email format',
    passwordTooShort: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak',
    
    // Success
    registrationSuccess: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz! Email tasdiqlang.',
    loginSuccess: 'Muvaffaqiyatli kirdingiz!',
  },
  ru: {
    // Common
    appName: 'SuperEshop Hub',
    tagline: 'E-commerce платформа для Узбекистана и Центральной Азии',
    
    // Navigation
    home: 'Главная',
    marketplace: 'Маркетплейс',
    login: 'Вход',
    register: 'Регистрация',
    logout: 'Выход',
    dashboard: 'Панель управления',
    profile: 'Профиль',
    
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
    
    // Errors
    emailRequired: 'Email обязателен',
    passwordRequired: 'Пароль обязателен',
    passwordMismatch: 'Пароли не совпадают',
    invalidEmail: 'Неверный формат email',
    passwordTooShort: 'Пароль должен содержать минимум 6 символов',
    
    // Success
    registrationSuccess: 'Регистрация успешна! Подтвердите email.',
    loginSuccess: 'Вход выполнен успешно!',
  },
  en: {
    // Common
    appName: 'SuperEshop Hub',
    tagline: 'E-commerce platform for Uzbekistan and Central Asia',
    
    // Navigation
    home: 'Home',
    marketplace: 'Marketplace',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    dashboard: 'Dashboard',
    profile: 'Profile',
    
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
    
    // Errors
    emailRequired: 'Email is required',
    passwordRequired: 'Password is required',
    passwordMismatch: 'Passwords do not match',
    invalidEmail: 'Invalid email format',
    passwordTooShort: 'Password must be at least 6 characters',
    
    // Success
    registrationSuccess: 'Registration successful! Please verify your email.',
    loginSuccess: 'Login successful!',
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
