/**
 * Canvas-based Infographic Overlay System
 * 
 * Renders text, badges, and feature callouts ON TOP of Gemini-generated
 * text-free product images. This ensures:
 * - 100% accurate text (no AI "bujmaytirish")
 * - O'zbek/Rus tillarida xatosiz matnlar
 * - Professional marketplace-level infographics
 * - Final output: 1080x1440 PNG
 */

export interface OverlayConfig {
  productName: string;
  features: string[];
  brand?: string;
  price?: number;
  badge?: string; // e.g. "TOP SELLER", "YANGI", "AKSIYA"
  categoryKey?: string;
  colorScheme?: string;
}

interface ColorTheme {
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  badgeBg: string;
  badgeText: string;
  featureBg: string;
}

const CATEGORY_THEMES: Record<string, ColorTheme> = {
  kosmetika: {
    primary: '#D4A574', secondary: '#FFF5EE', accent: '#C9956B',
    textPrimary: '#2D1810', textSecondary: '#6B4C3B',
    badgeBg: '#D4A574', badgeText: '#FFFFFF',
    featureBg: 'rgba(212, 165, 116, 0.15)',
  },
  parfyumeriya: {
    primary: '#8B6914', secondary: '#FFF8E7', accent: '#C9A227',
    textPrimary: '#1A1A2E', textSecondary: '#4A4A6A',
    badgeBg: '#C9A227', badgeText: '#FFFFFF',
    featureBg: 'rgba(201, 162, 39, 0.12)',
  },
  elektronika: {
    primary: '#2196F3', secondary: '#E3F2FD', accent: '#1565C0',
    textPrimary: '#FFFFFF', textSecondary: '#B0BEC5',
    badgeBg: '#2196F3', badgeText: '#FFFFFF',
    featureBg: 'rgba(33, 150, 243, 0.15)',
  },
  kiyim: {
    primary: '#212121', secondary: '#F5F5F5', accent: '#616161',
    textPrimary: '#212121', textSecondary: '#757575',
    badgeBg: '#212121', badgeText: '#FFFFFF',
    featureBg: 'rgba(33, 33, 33, 0.08)',
  },
  oshxona: {
    primary: '#4CAF50', secondary: '#F1F8E9', accent: '#2E7D32',
    textPrimary: '#1B5E20', textSecondary: '#558B2F',
    badgeBg: '#4CAF50', badgeText: '#FFFFFF',
    featureBg: 'rgba(76, 175, 80, 0.12)',
  },
  sport: {
    primary: '#FF5722', secondary: '#FBE9E7', accent: '#E64A19',
    textPrimary: '#BF360C', textSecondary: '#D84315',
    badgeBg: '#FF5722', badgeText: '#FFFFFF',
    featureBg: 'rgba(255, 87, 34, 0.12)',
  },
  bolalar: {
    primary: '#FF9800', secondary: '#FFF3E0', accent: '#F57C00',
    textPrimary: '#E65100', textSecondary: '#FF8F00',
    badgeBg: '#FF9800', badgeText: '#FFFFFF',
    featureBg: 'rgba(255, 152, 0, 0.12)',
  },
  'oziq-ovqat': {
    primary: '#8BC34A', secondary: '#F9FBE7', accent: '#689F38',
    textPrimary: '#33691E', textSecondary: '#558B2F',
    badgeBg: '#8BC34A', badgeText: '#FFFFFF',
    featureBg: 'rgba(139, 195, 74, 0.12)',
  },
  aksessuarlar: {
    primary: '#795548', secondary: '#EFEBE9', accent: '#5D4037',
    textPrimary: '#3E2723', textSecondary: '#5D4037',
    badgeBg: '#795548', badgeText: '#FFFFFF',
    featureBg: 'rgba(121, 85, 72, 0.12)',
  },
  default: {
    primary: '#1976D2', secondary: '#E3F2FD', accent: '#1565C0',
    textPrimary: '#212121', textSecondary: '#616161',
    badgeBg: '#1976D2', badgeText: '#FFFFFF',
    featureBg: 'rgba(25, 118, 210, 0.10)',
  },
};

function getTheme(categoryKey?: string): ColorTheme {
  return CATEGORY_THEMES[categoryKey || 'default'] || CATEGORY_THEMES.default;
}

/**
 * Renders infographic overlay on a text-free product image
 * Returns a base64 PNG data URL (1080x1440)
 */
export async function renderInfographicOverlay(
  baseImageUrl: string,
  config: OverlayConfig
): Promise<string> {
  const WIDTH = 1080;
  const HEIGHT = 1440;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Load base image
  const img = await loadImage(baseImageUrl);
  
  // Draw base image (cover the canvas)
  drawCover(ctx, img, WIDTH, HEIGHT);

  const theme = getTheme(config.categoryKey);

  // Semi-transparent gradient overlay at top and bottom for text readability
  // Top gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 200);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, WIDTH, 200);

  // Bottom gradient
  const bottomGrad = ctx.createLinearGradient(0, HEIGHT - 400, 0, HEIGHT);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, HEIGHT - 400, WIDTH, 400);

  // Badge (top-left)
  if (config.badge) {
    drawBadge(ctx, config.badge, 40, 40, theme);
  }

  // Brand name (top-right)
  if (config.brand) {
    ctx.font = 'bold 28px "Inter", "Arial", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(config.brand.toUpperCase(), WIDTH - 50, 70);
    ctx.shadowBlur = 0;
  }

  // Product name (bottom area)
  ctx.textAlign = 'left';
  ctx.font = 'bold 42px "Inter", "Arial", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  
  const nameLines = wrapText(ctx, config.productName, WIDTH - 100);
  const nameStartY = HEIGHT - 320;
  nameLines.forEach((line, i) => {
    ctx.fillText(line, 50, nameStartY + i * 50);
  });
  ctx.shadowBlur = 0;

  // Features (bottom, below product name)
  if (config.features && config.features.length > 0) {
    const featuresStartY = nameStartY + nameLines.length * 50 + 20;
    drawFeatures(ctx, config.features.slice(0, 5), 50, featuresStartY, WIDTH - 100, theme);
  }

  // Price tag (bottom-right)
  if (config.price && config.price > 0) {
    drawPriceTag(ctx, config.price, WIDTH - 50, HEIGHT - 50, theme);
  }

  return canvas.toDataURL('image/png', 0.95);
}

/**
 * Renders a clean product image WITHOUT infographic overlay
 * Just ensures the image is 1080x1440
 */
export async function renderCleanImage(
  baseImageUrl: string
): Promise<string> {
  const WIDTH = 1080;
  const HEIGHT = 1440;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const img = await loadImage(baseImageUrl);
  drawCover(ctx, img, WIDTH, HEIGHT);

  return canvas.toDataURL('image/png', 0.95);
}

// --- Helper functions ---

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  
  if (imgRatio > canvasRatio) {
    sw = img.height * canvasRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / canvasRatio;
    sy = (img.height - sh) / 2;
  }
  
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function drawBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: ColorTheme) {
  ctx.font = 'bold 24px "Inter", "Arial", sans-serif';
  const metrics = ctx.measureText(text);
  const padX = 20;
  const padY = 12;
  const bw = metrics.width + padX * 2;
  const bh = 38;
  const radius = 8;

  // Rounded rect
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, radius);
  ctx.fillStyle = theme.badgeBg;
  ctx.fill();

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Text
  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + bh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawFeatures(
  ctx: CanvasRenderingContext2D,
  features: string[],
  x: number,
  y: number,
  maxWidth: number,
  theme: ColorTheme
) {
  const lineHeight = 40;
  const dotRadius = 5;
  const icons = ['✦', '◆', '●', '▸', '★'];

  features.forEach((feature, i) => {
    const fy = y + i * lineHeight;

    // Feature icon
    ctx.font = '18px "Inter", "Arial", sans-serif';
    ctx.fillStyle = theme.badgeBg;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 3;
    ctx.fillText(icons[i % icons.length], x, fy + 4);

    // Feature text
    ctx.font = '26px "Inter", "Arial", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(feature, x + 28, fy + 4);
    ctx.shadowBlur = 0;
  });
}

function drawPriceTag(
  ctx: CanvasRenderingContext2D,
  price: number,
  rightX: number,
  bottomY: number,
  theme: ColorTheme
) {
  const formatted = formatPrice(price);
  ctx.font = 'bold 36px "Inter", "Arial", sans-serif';
  const metrics = ctx.measureText(formatted);
  const padX = 24;
  const padY = 16;
  const bw = metrics.width + padX * 2;
  const bh = 52;
  const bx = rightX - bw;
  const by = bottomY - bh;

  // Background
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 10);
  ctx.fillStyle = theme.badgeBg;
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Price text
  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = 'right';
  ctx.fillText(formatted, rightX - padX, bottomY - 14);
}

function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}M so'm`;
  }
  return `${price.toLocaleString('uz-UZ')} so'm`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3); // Max 3 lines
}
