figma.showUI(__html__, { width: 380, height: 500 });

// ─── Color Parsing ───────────────────────────────────────────────────────────

function parseCssColor(css: string): { r: number; g: number; b: number; opacity: number } | null {
  if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)' || css === 'none') return null;

  const hex6 = css.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    const h = hex6[1];
    return {
      r: parseInt(h.substr(0, 2), 16) / 255,
      g: parseInt(h.substr(2, 2), 16) / 255,
      b: parseInt(h.substr(4, 2), 16) / 255,
      opacity: 1,
    };
  }

  const hex3 = css.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    const h = hex3[1];
    return {
      r: parseInt(h[0] + h[0], 16) / 255,
      g: parseInt(h[1] + h[1], 16) / 255,
      b: parseInt(h[2] + h[2], 16) / 255,
      opacity: 1,
    };
  }

  const hex8 = css.match(/^#([0-9a-fA-F]{8})$/);
  if (hex8) {
    const h = hex8[1];
    return {
      r: parseInt(h.substr(0, 2), 16) / 255,
      g: parseInt(h.substr(2, 2), 16) / 255,
      b: parseInt(h.substr(4, 2), 16) / 255,
      opacity: parseInt(h.substr(6, 2), 16) / 255,
    };
  }

  const rgb = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgb) {
    return {
      r: parseFloat(rgb[1]) / 255,
      g: parseFloat(rgb[2]) / 255,
      b: parseFloat(rgb[3]) / 255,
      opacity: rgb[4] !== undefined ? parseFloat(rgb[4]) : 1,
    };
  }

  return null;
}

// ─── Gradient Parsing ─────────────────────────────────────────────────────────

/** Split a comma-separated gradient arg string respecting nested parens */
function splitArgs(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseColorStops(parts: string[], startIdx: number): ColorStop[] {
  const stops: ColorStop[] = [];
  const colorParts = parts.slice(startIdx);

  for (let i = 0; i < colorParts.length; i++) {
    const part = colorParts[i].trim();
    let r = 0, g = 0, b = 0, a = 1;
    let pos = -1;

    // Extract hex color
    const hexM = part.match(/#([0-9a-fA-F]{3,8})/);
    // Extract rgb/rgba color
    const rgbM = part.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
    // Extract percentage position
    const posM = part.match(/([\d.]+)%/);

    if (hexM) {
      let hex = hexM[1];
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
      r = parseInt(hex.substr(0, 2), 16) / 255;
      g = parseInt(hex.substr(2, 2), 16) / 255;
      b = parseInt(hex.substr(4, 2), 16) / 255;
      a = hex.length === 8 ? parseInt(hex.substr(6, 2), 16) / 255 : 1;
    } else if (rgbM) {
      r = parseFloat(rgbM[1]) / 255;
      g = parseFloat(rgbM[2]) / 255;
      b = parseFloat(rgbM[3]) / 255;
      a = rgbM[4] !== undefined ? parseFloat(rgbM[4]) : 1;
    } else {
      continue; // skip unrecognised parts
    }

    pos = posM ? parseFloat(posM[1]) / 100
               : (colorParts.length === 1 ? 0 : i / (colorParts.length - 1));

    stops.push({ position: Math.max(0, Math.min(1, pos)), color: { r, g, b, a } });
  }

  return stops;
}

function parseLinearGradient(content: string): GradientPaint | null {
  const parts = splitArgs(content);
  let angle = 180; // CSS default: to bottom
  let startIdx = 0;

  const first = parts[0].trim().toLowerCase();
  const degMatch = first.match(/^(-?[\d.]+)deg$/);
  if (degMatch) {
    angle = parseFloat(degMatch[1]);
    startIdx = 1;
  } else if (first.startsWith('to ')) {
    const map: Record<string, number> = {
      'to bottom': 180, 'to top': 0, 'to right': 90, 'to left': 270,
      'to bottom right': 135, 'to right bottom': 135,
      'to bottom left': 225, 'to left bottom': 225,
      'to top right': 45,    'to right top': 45,
      'to top left': 315,    'to left top': 315,
    };
    if (map[first] !== undefined) { angle = map[first]; startIdx = 1; }
  }

  const stops = parseColorStops(parts, startIdx);
  if (stops.length < 2) return null;

  // CSS: 0deg = to top; Figma: angle from start to end point
  // Convert CSS angle to Figma gradientTransform matrix
  const rad = ((angle - 90) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: [
      [cos,  sin, 0.5 - cos * 0.5 - sin * 0.5],
      [-sin, cos, 0.5 + sin * 0.5 - cos * 0.5],
    ],
    gradientStops: stops,
  };
}

function parseRadialGradient(content: string): GradientPaint | null {
  const parts = splitArgs(content);
  let startIdx = 0;

  // Skip shape/size/position token if present
  const first = parts[0].trim().toLowerCase();
  if (
    first.startsWith('ellipse') || first.startsWith('circle') ||
    first.startsWith('closest') || first.startsWith('farthest') ||
    first.includes(' at ')
  ) {
    startIdx = 1;
  }

  const stops = parseColorStops(parts, startIdx);
  if (stops.length < 2) return null;

  // Centered radial gradient
  return {
    type: 'GRADIENT_RADIAL',
    gradientTransform: [[0.5, 0, 0.25], [0, 0.5, 0.25]],
    gradientStops: stops,
  };
}

function parseCssGradient(css: string): Paint[] {
  if (!css || css === 'none') return [];

  // Handle multiple backgrounds separated by comma (take first gradient)
  const linearM = css.match(/linear-gradient\((.+?)\)/);
  if (linearM) {
    const g = parseLinearGradient(linearM[1]);
    if (g) return [g];
  }

  const radialM = css.match(/radial-gradient\((.+?)\)/);
  if (radialM) {
    const g = parseRadialGradient(radialM[1]);
    if (g) return [g];
  }

  const c = parseCssColor(css);
  if (c) return [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.opacity }];
  return [];
}

function solidPaint(css: string): Paint[] {
  if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)' || css === 'none') return [];
  const c = parseCssColor(css);
  if (!c) return [];
  return [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.opacity }];
}

// ─── Shadow Parsing ───────────────────────────────────────────────────────────

function parseBoxShadow(shadow: string): Effect[] {
  if (!shadow || shadow === 'none') return [];

  const effects: Effect[] = [];

  // Split multiple shadows while respecting rgba() commas
  const shadowParts: string[] = [];
  let depth = 0, cur = '';
  for (let i = 0; i < shadow.length; i++) {
    const ch = shadow[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { shadowParts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) shadowParts.push(cur.trim());

  for (const part of shadowParts) {
    const isInset = /\binset\b/.test(part);

    // Extract color (rgba, rgb, or hex)
    let r = 0, g = 0, b = 0, a = 0.4;
    const rgbaM = part.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
    const hexM  = part.match(/#([0-9a-fA-F]{3,8})/);
    if (rgbaM) {
      r = parseFloat(rgbaM[1]) / 255;
      g = parseFloat(rgbaM[2]) / 255;
      b = parseFloat(rgbaM[3]) / 255;
      a = rgbaM[4] !== undefined ? parseFloat(rgbaM[4]) : 1;
    } else if (hexM) {
      const c = parseCssColor('#' + hexM[1]);
      if (c) { r = c.r; g = c.g; b = c.b; a = c.opacity; }
    }

    // Extract px values: offsetX offsetY blur spread
    const pxVals = (part.match(/-?[\d.]+px/g) || []).map(parseFloat);
    if (pxVals.length < 2) continue;

    effects.push({
      type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: { r, g, b, a },
      offset: { x: pxVals[0], y: pxVals[1] },
      radius: pxVals[2] ?? 0,
      spread: pxVals[3] ?? 0,
      visible: true,
      blendMode: 'NORMAL',
    } as DropShadowEffect);
  }

  return effects;
}

// ─── Font Loading ─────────────────────────────────────────────────────────────

const _loadedFonts: Record<string, boolean> = {};

async function loadFont(family: string, weight: string | number, style: string): Promise<FontName> {
  const w = typeof weight === 'string' ? (parseInt(weight) || 400) : weight;
  const isBold   = w >= 600 || weight === 'bold';
  const isItalic = style === 'italic' || style === 'oblique';

  // Build ordered list of Figma style names to try
  const baseStyle = w <= 300 ? 'Light'
    : w <= 400 ? 'Regular'
    : w <= 500 ? 'Medium'
    : w <= 600 ? 'SemiBold'
    : w <= 700 ? 'Bold'
    : w <= 800 ? 'ExtraBold'
    : 'Black';

  const styleVariants = isItalic && isBold
    ? ['Bold Italic', 'Bold', 'Regular']
    : isItalic
    ? ['Italic', 'Regular']
    : isBold
    ? ['Bold', baseStyle, 'Regular']
    : [baseStyle, 'Regular'];

  const families = [family, 'Inter', 'Roboto'];

  for (const fam of families) {
    for (const sty of styleVariants) {
      const key = `${fam}:${sty}`;
      if (_loadedFonts[key]) return { family: fam, style: sty };
      try {
        await figma.loadFontAsync({ family: fam, style: sty });
        _loadedFonts[key] = true;
        return { family: fam, style: sty };
      } catch (_) { /* try next */ }
    }
  }

  // Absolute fallback
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  _loadedFonts['Inter:Regular'] = true;
  return { family: 'Inter', style: 'Regular' };
}

// ─── Layer Creators ───────────────────────────────────────────────────────────

async function createTextLayer(layer: any, ox: number, oy: number): Promise<TextNode> {
  const font = await loadFont(
    (layer.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim(),
    layer.fontWeight || '400',
    layer.fontStyle  || 'normal'
  );

  const t = figma.createText();
  t.name = layer.name || 'text';
  t.fontName = font;

  // Text transform
  let chars: string = layer.text || '';
  if (layer.textTransform === 'uppercase') chars = chars.toUpperCase();
  else if (layer.textTransform === 'lowercase') chars = chars.toLowerCase();
  else if (layer.textTransform === 'capitalize')
    chars = chars.replace(/\b\w/g, (c: string) => c.toUpperCase());
  t.characters = chars;

  t.fontSize = Math.max(1, parseFloat(layer.fontSize) || 14);

  const alignMap: Record<string, 'LEFT'|'CENTER'|'RIGHT'|'JUSTIFIED'> = {
    left: 'LEFT', center: 'CENTER', right: 'RIGHT',
    justify: 'JUSTIFIED', start: 'LEFT', end: 'RIGHT',
  };
  t.textAlignHorizontal = alignMap[layer.textAlign] || 'LEFT';

  if (layer.textDecoration) {
    if (layer.textDecoration.includes('underline'))   t.textDecoration = 'UNDERLINE';
    if (layer.textDecoration.includes('line-through')) t.textDecoration = 'STRIKETHROUGH';
  }

  if (layer.letterSpacing && layer.letterSpacing !== 'normal') {
    const ls = parseFloat(layer.letterSpacing);
    if (!isNaN(ls) && ls !== 0) t.letterSpacing = { value: ls, unit: 'PIXELS' };
  }

  if (layer.lineHeight && layer.lineHeight !== 'normal') {
    const lh = parseFloat(layer.lineHeight);
    if (!isNaN(lh) && lh > 0) t.lineHeight = { value: lh, unit: 'PIXELS' };
  }

  const fills = solidPaint(layer.color || '#000000');
  if (fills.length) t.fills = fills;

  if (layer.textShadow && layer.textShadow !== 'none') {
    const fx = parseBoxShadow(layer.textShadow);
    if (fx.length) t.effects = fx;
  }

  // Pixel-perfect integer positions
  t.x = Math.round(layer.x - ox);
  t.y = Math.round(layer.y - oy);

  if (layer.width > 0) {
    t.textAutoResize = 'HEIGHT';
    t.resize(Math.max(Math.round(layer.width), 1), t.height);
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  if (typeof layer.opacity === 'number' && layer.opacity < 1) t.opacity = layer.opacity;

  return t;
}

function createRectLayer(layer: any, ox: number, oy: number): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = layer.name || 'rect';
  rect.x = Math.round(layer.x - ox);
  rect.y = Math.round(layer.y - oy);
  rect.resize(Math.max(Math.round(layer.width), 1), Math.max(Math.round(layer.height), 1));

  // Fill: gradient > bgImage (url) > bgColor
  let fills: Paint[] = [];
  if (layer.gradient && layer.gradient !== 'none') {
    fills = parseCssGradient(layer.gradient);
  }
  if (fills.length === 0 && layer.bgColor) {
    fills = solidPaint(layer.bgColor);
  }
  rect.fills = fills;

  // Corner radii
  rect.topLeftRadius     = layer.borderTopLeftRadius     || 0;
  rect.topRightRadius    = layer.borderTopRightRadius    || 0;
  rect.bottomLeftRadius  = layer.borderBottomLeftRadius  || 0;
  rect.bottomRightRadius = layer.borderBottomRightRadius || 0;

  // Stroke (use the largest border side)
  const bw = Math.max(
    layer.borderTopWidth    || 0,
    layer.borderRightWidth  || 0,
    layer.borderBottomWidth || 0,
    layer.borderLeftWidth   || 0
  );
  if (bw > 0) {
    const bc = layer.borderTopColor || layer.borderRightColor ||
               layer.borderBottomColor || layer.borderLeftColor || '';
    const bs = layer.borderTopStyle || layer.borderRightStyle ||
               layer.borderBottomStyle || layer.borderLeftStyle || '';
    if (bs && bs !== 'none') {
      const strokeFill = solidPaint(bc);
      if (strokeFill.length) {
        rect.strokes = strokeFill;
        rect.strokeWeight = bw;
        rect.strokeAlign  = 'INSIDE';
      }
    }
  }

  // Box shadow
  if (layer.boxShadow && layer.boxShadow !== 'none') {
    const fx = parseBoxShadow(layer.boxShadow);
    if (fx.length) rect.effects = fx;
  }

  if (typeof layer.opacity === 'number' && layer.opacity < 1) rect.opacity = layer.opacity;

  return rect;
}

async function createImageLayer(layer: any, ox: number, oy: number): Promise<RectangleNode> {
  const rect = figma.createRectangle();
  rect.name  = layer.name || 'image';
  rect.x     = Math.round(layer.x - ox);
  rect.y     = Math.round(layer.y - oy);
  rect.resize(Math.max(Math.round(layer.width), 1), Math.max(Math.round(layer.height), 1));

  rect.topLeftRadius     = layer.borderTopLeftRadius     || 0;
  rect.topRightRadius    = layer.borderTopRightRadius    || 0;
  rect.bottomLeftRadius  = layer.borderBottomLeftRadius  || 0;
  rect.bottomRightRadius = layer.borderBottomRightRadius || 0;

  if (layer.imageData && layer.imageData.length > 0) {
    try {
      const img = figma.createImage(new Uint8Array(layer.imageData));
      const mode: 'FILL'|'FIT'|'CROP'|'TILE' =
        layer.objectFit === 'contain' ? 'FIT' :
        layer.objectFit === 'cover'   ? 'FILL' : 'FILL';
      rect.fills = [{ type: 'IMAGE', scaleMode: mode, imageHash: img.hash } as ImagePaint];
    } catch (_) {
      rect.fills = [{ type: 'SOLID', color: { r: 0.87, g: 0.87, b: 0.87 } }];
    }
  } else {
    rect.fills = [{ type: 'SOLID', color: { r: 0.87, g: 0.87, b: 0.87 } }];
  }

  if (typeof layer.opacity === 'number' && layer.opacity < 1) rect.opacity = layer.opacity;

  return rect;
}

async function createSVGLayer(layer: any, ox: number, oy: number): Promise<SceneNode> {
  if (layer.svgContent) {
    try {
      const node = figma.createNodeFromSvg(layer.svgContent);
      node.name = layer.name || 'svg';
      // Place it, then scale to match the captured bounding rect
      node.x = Math.round(layer.x - ox);
      node.y = Math.round(layer.y - oy);
      node.resize(
        Math.max(Math.round(layer.width), 1),
        Math.max(Math.round(layer.height), 1)
      );
      if (typeof layer.opacity === 'number' && layer.opacity < 1) node.opacity = layer.opacity;
      return node;
    } catch (e) {
      // Fall through to placeholder
    }
  }

  // Placeholder rect if SVG string is unavailable or fails to parse
  const rect = figma.createRectangle();
  rect.name  = layer.name || 'svg';
  rect.x     = Math.round(layer.x - ox);
  rect.y     = Math.round(layer.y - oy);
  rect.resize(Math.max(Math.round(layer.width), 1), Math.max(Math.round(layer.height), 1));
  const bg = solidPaint(layer.bgColor || 'transparent');
  rect.fills = bg.length ? bg : [];
  rect.topLeftRadius     = layer.borderTopLeftRadius     || 0;
  rect.topRightRadius    = layer.borderTopRightRadius    || 0;
  rect.bottomLeftRadius  = layer.borderBottomLeftRadius  || 0;
  rect.bottomRightRadius = layer.borderBottomRightRadius || 0;
  return rect;
}

// ─── Main Message Handler ─────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: { type: string; layers?: any[] }) => {
  if (msg.type === 'convert' && msg.layers) {
    try {
      const layers = msg.layers;

      // Compute bounding box of all layers
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const l of layers) {
        minX = Math.min(minX, l.x);
        minY = Math.min(minY, l.y);
        maxX = Math.max(maxX, l.x + (l.width  || 0));
        maxY = Math.max(maxY, l.y + (l.height || 0));
      }

      const cw = Math.max(Math.round(maxX - minX), 100);
      const ch = Math.max(Math.round(maxY - minY), 100);

      const frame = figma.createFrame();
      frame.name = 'HTML Import';
      frame.x    = Math.round(figma.viewport.center.x - cw / 2);
      frame.y    = Math.round(figma.viewport.center.y - ch / 2);
      frame.resize(cw, ch);
      frame.fills        = [];
      frame.clipsContent = false;

      for (const layer of layers) {
        let node: SceneNode | null = null;

        if (layer.type === 'TEXT')  node = await createTextLayer(layer, minX, minY);
        if (layer.type === 'RECT')  node = createRectLayer(layer, minX, minY);
        if (layer.type === 'IMAGE') node = await createImageLayer(layer, minX, minY);
        if (layer.type === 'SVG')   node = await createSVGLayer(layer, minX, minY);

        if (node) frame.appendChild(node);
      }

      figma.currentPage.appendChild(frame);
      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);

      figma.ui.postMessage({ type: 'done', count: frame.children.length });
    } catch (e: any) {
      figma.ui.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (msg.type === 'cancel') figma.closePlugin();
};