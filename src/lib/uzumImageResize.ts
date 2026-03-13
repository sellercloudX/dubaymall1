/**
 * Uzum Market rasm resize utility
 * Rasmlarni ANIQ 1080x1440 pikselga o'zgartiradi (3:4 ratio)
 * Uzum bu o'lchamdan 1 piksel ham og'ishni qabul qilmaydi!
 */

const UZUM_WIDTH = 1080;
const UZUM_HEIGHT = 1440;

/**
 * Rasmni 1080x1440 ga resize qiladi (client-side Canvas API)
 * @param imageSource - base64, blob URL yoki https URL
 * @returns base64 JPEG string (data:image/jpeg;base64,...)
 */
export async function resizeImageForUzum(imageSource: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = UZUM_WIDTH;
      canvas.height = UZUM_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      
      // Oq fon
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, UZUM_WIDTH, UZUM_HEIGHT);
      
      // "Cover" resize — rasm butunlay to'ldiradi, kerakli joyini crop qiladi
      const srcRatio = img.width / img.height;
      const dstRatio = UZUM_WIDTH / UZUM_HEIGHT; // 0.75
      
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      
      if (srcRatio > dstRatio) {
        // Rasm keng — yon tomonlarni qirqish
        sw = img.height * dstRatio;
        sx = (img.width - sw) / 2;
      } else {
        // Rasm baland — yuqori/pastni qirqish
        sh = img.width / dstRatio;
        sy = (img.height - sh) / 2;
      }
      
      // Yuqori sifatli interpolatsiya
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, UZUM_WIDTH, UZUM_HEIGHT);
      
      // JPEG sifati 95% (Uzum standarti)
      const result = canvas.toDataURL('image/jpeg', 0.95);
      resolve(result);
    };
    
    img.onerror = () => reject(new Error('Rasmni yuklashda xatolik'));
    img.src = imageSource;
  });
}

/**
 * "Contain" resize — rasm to'liq ko'rinadi, qolgan joy oq fon
 * Ba'zi mahsulotlar uchun crop qilish yaxshi emas (masalan: kiyim)
 */
export async function resizeImageForUzumContain(imageSource: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = UZUM_WIDTH;
      canvas.height = UZUM_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      
      // Oq fon
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, UZUM_WIDTH, UZUM_HEIGHT);
      
      // "Contain" — rasm butunlay sig'adi
      const scale = Math.min(UZUM_WIDTH / img.width, UZUM_HEIGHT / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (UZUM_WIDTH - dw) / 2;
      const dy = (UZUM_HEIGHT - dh) / 2;
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
      
      const result = canvas.toDataURL('image/jpeg', 0.95);
      resolve(result);
    };
    
    img.onerror = () => reject(new Error('Rasmni yuklashda xatolik'));
    img.src = imageSource;
  });
}

/**
 * Rasm o'lchamini tekshiradi
 */
export async function checkImageDimensions(imageSource: string): Promise<{
  width: number;
  height: number;
  isValid: boolean;
  message: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const isValid = img.width === UZUM_WIDTH && img.height === UZUM_HEIGHT;
      resolve({
        width: img.width,
        height: img.height,
        isValid,
        message: isValid 
          ? `✅ To'g'ri: ${img.width}×${img.height}` 
          : `❌ Noto'g'ri: ${img.width}×${img.height} (kerak: ${UZUM_WIDTH}×${UZUM_HEIGHT})`,
      });
    };
    
    img.onerror = () => resolve({
      width: 0,
      height: 0,
      isValid: false,
      message: '❌ Rasmni yuklashda xatolik',
    });
    
    img.src = imageSource;
  });
}

/**
 * Base64 stringni Blob ga o'giradi (upload uchun)
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const data = atob(parts[1]);
  const arr = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) arr[i] = data.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Rasmni resize qilib storage'ga yuklaydi
 */
export async function resizeAndUploadForUzum(
  supabase: any,
  userId: string,
  imageSource: string,
  mode: 'cover' | 'contain' = 'cover'
): Promise<string | null> {
  try {
    const resized = mode === 'cover' 
      ? await resizeImageForUzum(imageSource)
      : await resizeImageForUzumContain(imageSource);
    
    const blob = base64ToBlob(resized);
    const fileName = `${userId}/uzum/${Date.now()}-${Math.random().toString(36).substring(2, 6)}.jpg`;
    
    const { error } = await supabase.storage.from('product-images').upload(fileName, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    
    if (error) {
      console.error('Uzum image upload error:', error);
      return null;
    }
    
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Uzum image resize error:', err);
    return null;
  }
}
