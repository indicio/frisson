/**
 * Color Palette Generator
 * Generates harmonious color palettes using color theory principles
 */

/**
 * Generate a random number between min and max
 */
function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Wrap hue value to ensure it's within 0-360 range
 */
function wrapHue(value) {
  while (value < 0) value += 360;
  while (value >= 360) value -= 360;
  return value;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  h = h / 360;
  s = s / 100;
  l = l / 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Get relative luminance (WCAG 2.0 formula)
 */
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Get contrast ratio between two colors (WCAG 2.0)
 */
function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(color1.r, color1.g, color1.b);
  const lum2 = getLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generate a palette of exactly THREE colors
 * @param {Object} options - Palette generation options
 * @param {string} options.paletteMode - 'analogous' | 'triadic' | 'complementary' | 'random'
 * @param {number|null} options.baseHue - Base hue (0-360) or null for random
 * @param {number} options.minSaturation - Min saturation (0-100)
 * @param {number} options.maxSaturation - Max saturation (0-100)
 * @param {number} options.minLightness - Min lightness (0-100)
 * @param {number} options.maxLightness - Max lightness (0-100)
 * @param {string} options.warmCoolLock - 'any' | 'warm' | 'cool'
 * @param {boolean} options.ensureContrast - Whether to ensure minimum contrast
 * @returns {Object} Object with c1, c2, c3 hex color strings
 */
export function generatePalette(options = {}) {
  const {
    paletteMode = 'triadic',
    baseHue = null,
    minSaturation = 50,
    maxSaturation = 100,
    minLightness = 30,
    maxLightness = 70,
    warmCoolLock = 'any',
    ensureContrast = false
  } = options;
  
  // Clamp and validate ranges
  const minSat = Math.max(0, Math.min(100, minSaturation));
  const maxSat = Math.max(minSat, Math.min(100, maxSaturation));
  const minLight = Math.max(0, Math.min(100, minLightness));
  const maxLight = Math.max(minLight, Math.min(100, maxLightness));
  
  // Determine base hue
  let hue;
  if (baseHue !== null) {
    hue = wrapHue(baseHue);
  } else {
    // Generate random hue based on warmCoolLock
    if (warmCoolLock === 'warm') {
      // Warm colors: 0-90 and 300-360 (reds, oranges, yellows, magentas)
      const warmRange1 = randBetween(0, 90);
      const warmRange2 = randBetween(300, 360);
      hue = Math.random() < 0.5 ? warmRange1 : warmRange2;
    } else if (warmCoolLock === 'cool') {
      // Cool colors: 90-270 (greens, cyans, blues)
      hue = randBetween(90, 270);
    } else {
      // Any hue
      hue = randBetween(0, 360);
    }
  }
  
  // Generate hues based on palette mode
  let hues = [hue];
  
  if (paletteMode === 'analogous') {
    // Analogous: hues near each other (±20-30 degrees)
    const offset = randBetween(20, 30);
    hues = [
      wrapHue(hue - offset),
      hue,
      wrapHue(hue + offset)
    ];
  } else if (paletteMode === 'triadic') {
    // Triadic: hues roughly 120 degrees apart
    hues = [
      hue,
      wrapHue(hue + 120),
      wrapHue(hue + 240)
    ];
  } else if (paletteMode === 'complementary') {
    // Complementary: base hue + two hues on opposite side
    hues = [
      hue,
      wrapHue(hue + 180),
      wrapHue(hue + 150)
    ];
  } else {
    // Random: three random hues within constraints
    if (warmCoolLock === 'warm') {
      const warmRange1 = randBetween(0, 90);
      const warmRange2 = randBetween(300, 360);
      hues = [
        Math.random() < 0.5 ? warmRange1 : warmRange2,
        Math.random() < 0.5 ? warmRange1 : warmRange2,
        Math.random() < 0.5 ? warmRange1 : warmRange2
      ];
    } else if (warmCoolLock === 'cool') {
      hues = [
        randBetween(90, 270),
        randBetween(90, 270),
        randBetween(90, 270)
      ];
    } else {
      hues = [
        randBetween(0, 360),
        randBetween(0, 360),
        randBetween(0, 360)
      ];
    }
  }
  
  // Generate saturation and lightness for each color
  let colors = hues.map(h => {
    const s = randBetween(minSat, maxSat);
    const l = randBetween(minLight, maxLight);
    const rgb = hslToRgb(h, s, l);
    return { h, s, l, rgb };
  });
  
  // Ensure contrast if requested
  if (ensureContrast) {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      // Check contrast between c1 and c2
      const contrast12 = getContrastRatio(colors[0].rgb, colors[1].rgb);
      
      if (contrast12 < 3) {
        // Adjust lightness to increase contrast
        if (colors[0].l < colors[1].l) {
          colors[0].l = Math.max(minLight, colors[0].l - 10);
          colors[1].l = Math.min(maxLight, colors[1].l + 10);
        } else {
          colors[0].l = Math.min(maxLight, colors[0].l + 10);
          colors[1].l = Math.max(minLight, colors[1].l - 10);
        }
        
        // Recalculate RGB
        colors[0].rgb = hslToRgb(colors[0].h, colors[0].s, colors[0].l);
        colors[1].rgb = hslToRgb(colors[1].h, colors[1].s, colors[1].l);
        attempts++;
      } else {
        break;
      }
    }
  }
  
  // Convert to hex strings
  return {
    c1: rgbToHex(colors[0].rgb.r, colors[0].rgb.g, colors[0].rgb.b),
    c2: rgbToHex(colors[1].rgb.r, colors[1].rgb.g, colors[1].rgb.b),
    c3: rgbToHex(colors[2].rgb.r, colors[2].rgb.g, colors[2].rgb.b),
    // Include HSL info for debugging/reference
    _hsl: colors.map(c => ({ h: Math.round(c.h), s: Math.round(c.s), l: Math.round(c.l) }))
  };
}

/**
 * Generate a palette with sensible defaults for module color randomization
 * @returns {Object} Object with c1, c2, c3 hex color strings
 */
export function generateRandomPalette() {
  const modes = ['analogous', 'triadic', 'complementary', 'random'];
  const paletteMode = modes[Math.floor(Math.random() * modes.length)];
  const warmCoolLock = ['any', 'warm', 'cool'][Math.floor(Math.random() * 3)];
  
  return generatePalette({
    paletteMode,
    baseHue: null,
    minSaturation: 50,
    maxSaturation: 100,
    minLightness: 30,
    maxLightness: 70,
    warmCoolLock,
    ensureContrast: Math.random() > 0.5
  });
}

