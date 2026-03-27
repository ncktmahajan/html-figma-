# HTML to Figma Plugin

Convert HTML code with inline styles into editable Figma layers with pixel-perfect accuracy.

## Features

✨ **Complete Style Support**
- Background colors and gradients (linear, radial)
- Borders with individual side widths and colors
- Border radius (all corners)
- Box shadows (multiple, inner/outer)
- Text styling (fonts, sizes, weights, colors)
- Text shadows and decorations
- Opacity and blend modes
- Padding and spacing
- Flexbox alignment

🎨 **Supported Elements**
- Text elements with full typography
- Rectangles with backgrounds and borders
- Images (placeholder support)
- SVG graphics (placeholder support)
- Pseudo-elements (::before, ::after)

## Installation

### Prerequisites

1. **Install Node.js** (includes npm)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Install TypeScript globally**
   ```bash
   npm install -g typescript
   ```

### Setup

1. **Navigate to plugin directory**
   ```bash
   cd "/Users/kosoku/Downloads/html to figma"
   ```

2. **Install dependencies**
   ```bash
   npm install --save-dev @figma/plugin-typings
   ```

3. **Compile TypeScript**
   ```bash
   npx tsc
   ```
   
   Or watch for changes:
   ```bash
   npx tsc --watch
   ```

### Load Plugin in Figma

1. Open Figma Desktop App
2. Go to **Plugins** → **Development** → **Import plugin from manifest**
3. Select the `manifest.json` file from this directory
4. Plugin will appear in **Plugins** → **Development** → **HTML to Figma**

## Usage

### Method 1: Upload HTML File

1. Open the plugin in Figma
2. Click **Upload File** tab
3. Drag and drop your `.html` file or click to browse
4. Click **Convert to Figma**

### Method 2: Paste HTML Code

1. Open the plugin in Figma
2. Click **Paste Code** tab
3. Paste your HTML with inline styles or `<style>` tags
4. Click **Convert to Figma**

### Example HTML

```html
<style>
  .container {
    width: 400px;
    height: 300px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
  
  .title {
    color: white;
    font-size: 32px;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
</style>

<div class="container">
  <h1 class="title">Hello Figma!</h1>
</div>
```

## Supported CSS Properties

### Layout
- `display: flex` (with justify-content, align-items, flex-direction)
- `padding` (all sides)
- `width`, `height`
- `position` (captured as absolute coordinates)

### Backgrounds
- `background-color` (rgb, rgba, hex)
- `background-image: linear-gradient()` (all angles, hex/rgb colors)
- `background-image: radial-gradient()`

### Borders
- `border-width` (individual sides)
- `border-color` (individual sides)
- `border-style` (solid, dashed, etc.)
- `border-radius` (individual corners)

### Effects
- `box-shadow` (multiple shadows, inner/outer)
- `opacity`

### Typography
- `font-family`
- `font-size`
- `font-weight`
- `font-style` (italic, oblique)
- `color`
- `text-align`
- `text-transform`
- `text-decoration` (underline, line-through)
- `letter-spacing`
- `line-height`
- `text-shadow`

### Pseudo-elements
- `::before` (background, dimensions)
- `::after` (background, dimensions, positioning)

## Development

### File Structure

```
html to figma/
├── manifest.json       # Plugin configuration
├── code.ts            # Main plugin logic (TypeScript)
├── code.js            # Compiled JavaScript
├── ui.html            # Plugin UI interface
├── tsconfig.json      # TypeScript configuration
├── package.json       # Node dependencies
└── README.md          # This file
```

### Making Changes

1. **Edit TypeScript** (`code.ts`)
   - Modify plugin logic
   - Add new features

2. **Edit UI** (`ui.html`)
   - Update interface
   - Modify capture logic

3. **Compile**
   ```bash
   npx tsc
   ```

4. **Reload Plugin** in Figma
   - Right-click plugin → **Reload**

### TypeScript Configuration

The plugin uses ES6 target for Figma compatibility:
- Target: ES6
- Strict mode: disabled
- Output: code.js

## Troubleshooting

### Plugin doesn't load
- Ensure `code.js` exists (run `npx tsc`)
- Check Figma console for errors (Plugins → Development → Open Console)

### Styles not converting
- Use inline styles or `<style>` tags
- External CSS files are not supported
- CSS variables must be defined in the HTML

### Gradients not showing
- Use format: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Ensure hex colors are 3 or 6 characters
- RGB/RGBA also supported

### Text misaligned
- Check flexbox properties (justify-content, align-items)
- Verify padding values
- Text uses computed positions from browser rendering

### Fonts not loading
- Plugin tries requested font, then Inter, then Roboto
- Falls back to Inter Regular if font unavailable
- Install fonts in Figma for best results

## Limitations

- External CSS files not supported (use inline or `<style>` tags)
- Images show as placeholders (no network access)
- Complex layouts may need manual adjustment
- Nested elements are flattened to absolute positions
- JavaScript/dynamic content not executed

## Tips for Best Results

1. **Use inline styles or `<style>` tags**
   ```html
   <div style="background: #667eea;">...</div>
   ```

2. **Define CSS variables in HTML**
   ```html
   <style>
     :root {
       --primary-color: #667eea;
     }
   </style>
   ```

3. **Use flexbox for alignment**
   ```css
   display: flex;
   justify-content: center;
   align-items: center;
   ```

4. **Specify exact dimensions**
   ```css
   width: 400px;
   height: 300px;
   ```

5. **Use standard color formats**
   - Hex: `#667eea`
   - RGB: `rgb(102, 126, 234)`
   - RGBA: `rgba(102, 126, 234, 0.8)`

## Support

For issues or feature requests, check the plugin console:
- Figma → Plugins → Development → Open Console

## License

MIT License - Feel free to modify and distribute.

## Version

1.0.0 - Initial release with full gradient and alignment support
