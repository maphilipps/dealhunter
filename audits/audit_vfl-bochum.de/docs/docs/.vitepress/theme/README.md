# adesso VitePress Theme

Simple custom theme applying adesso SE corporate branding to VitePress documentation.

## Structure

```
.vitepress/theme/
├── index.js      # Theme entry point (extends VitePress default)
├── custom.css    # All color and typography overrides
└── README.md     # This file
```

## Design System

**Colors:**
- Primary: `#006EC7` (adesso Blue)
- Secondary: `#461EBE` (adesso Violet)
- Gradient: Blue to Violet for navbar/sidebar
- Text: `#000000` (Pure black for accessibility)

**Typography:**
- Body: Fira Sans (Google Fonts)
- Headings: Fira Sans Condensed (Google Fonts)
- Code: JetBrains Mono / Fira Code

## How to Change Colors

Edit `custom.css` and modify CSS variables:

```css
:root {
  --vp-c-brand-1: #006EC7;  /* Change primary blue */
  --vp-c-text-1: #000000;   /* Change body text color */
  --vp-c-bg-soft: #E7E5E3;  /* Change soft background */
  /* etc... */
}
```

All VitePress CSS variables are documented here:
https://vitepress.dev/reference/default-theme-config#custom-css

## How to Change Fonts

Edit `docs/.vitepress/config.js` and update Google Fonts URL in `head` section:

```javascript
head: [
  ['link', {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap'
  }]
]
```

Then update font family in `custom.css`:

```css
:root {
  --vp-font-family-base: 'YOUR_FONT', sans-serif;
}
```

## Troubleshooting

### Fonts not loading

**Problem:** Fira Sans not rendering, seeing fallback fonts instead

**Solutions:**
1. Check browser DevTools Network tab for font requests (should see requests to fonts.gstatic.com)
2. Verify Google Fonts URL is correct in `config.js`
3. Clear browser cache and hard reload (Cmd+Shift+R)
4. Test directly: Open https://fonts.google.com/specimen/Fira+Sans in browser

### Colors not applying

**Problem:** Still seeing default VitePress blue instead of adesso blue

**Solutions:**
1. Verify `custom.css` is imported in `index.js`
2. Check browser DevTools Elements tab → Computed styles
3. Clear VitePress cache: `rm -rf docs/.vitepress/cache`
4. Restart dev server: `npm run docs:dev`

### Theme breaks after VitePress update

**Problem:** After updating VitePress, theme styling is broken

**Solutions:**
1. Check VitePress changelog for breaking changes: https://github.com/vuejs/vitepress/releases
2. Review updated CSS variable names in VitePress docs
3. Test in dev mode before deploying to production
4. If needed, compare against VitePress default theme source code

## Maintenance

**Updating adesso brand colors:**
1. Edit `custom.css` CSS variables
2. Run accessibility contrast check (see below)
3. Test in browser
4. Commit changes

**Checking color contrast (WCAG AA):**

Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

Required ratios:
- Normal text (< 18pt): 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum

**Current colors meet WCAG AA:**
- adesso Blue #006EC7 on white: 4.82:1 ✅
- Pure black #000000 on white: 21:1 ✅

## Architecture Decisions

**Why single CSS file?**
- Simple: Everything in one place
- Fast: No unnecessary abstraction layers
- Maintainable: Easy to find and update styles
- KISS principle: Solves the actual problem without overengineering

**Why Google Fonts?**
- Free and open source (SIL Open Font License)
- Global CDN (fast worldwide delivery)
- Automatically cached by browsers
- No self-hosting complexity

**Why disable dark mode?**
- adesso design system extraction didn't include dark mode colors
- Light mode ensures consistent brand presentation
- Can be added later if client provides dark mode color palette

## References

- **VitePress Docs:** https://vitepress.dev
- **VitePress Theming:** https://vitepress.dev/guide/extending-default-theme
- **Fira Sans:** https://fonts.google.com/specimen/Fira+Sans
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
