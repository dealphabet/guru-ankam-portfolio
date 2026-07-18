# Guru Ankam — Portfolio

A portfolio website for Guru Ankam — photographer, drummer, software engineer, and creative. Built with Astro + Tailwind CSS, featuring a CMS-driven content system, light/dark theme, and an admin editor panel.

**Author:** Gurukrupal Ankam (branded as "Guru Ankam")

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Design System](#design-system)
- [Pages](#pages)
- [Content System](#content-system)
- [Admin Panel](#admin-panel)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Build & Deploy](#build--deploy)

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Astro | v5.18.2 | Static site framework (requires Node >=20.9.0) |
| Tailwind CSS | v3.4.19 | Utility-first CSS via `@astrojs/tailwind` |
| Inter | — | Primary typeface (Google Fonts) |
| JetBrains Mono | — | Monospace font (admin panel only) |

**Why Astro v5 instead of v7?** The project runs on Node.js v20.9.0. Astro v7 requires Node >=22.12.0, so v5 is the latest compatible version.

---

## Project Structure

```
guru-ankam-portfolio/
├── data/
│   └── content.json              # Central content store (all editable site data)
├── public/
│   ├── admin.html                # CMS admin editor (standalone HTML, 568 lines)
│   └── favicon.svg               # Blue "G" favicon
├── src/
│   ├── layouts/
│   │   └── Layout.astro          # Shared layout: nav, footer, theme toggle, debug
│   ├── pages/
│   │   ├── index.astro           # Homepage (430 lines)
│   │   ├── about.astro           # About page (42 lines)
│   │   ├── photography.astro     # Photo gallery + viewer (313 lines)
│   │   ├── music.astro           # Drummer intro (47 lines)
│   │   ├── code.astro            # Project cards + overlays (250 lines)
│   │   ├── creative.astro        # Art/storyboard + overlays (214 lines)
│   │   └── contact.astro         # Social links (67 lines)
│   └── styles/
│       └── global.css            # Design system (532 lines)
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

**Total source:** ~2,895 lines across 15 files. 7 pages, 1 layout, 1 CSS file, 1 data file, 1 admin panel.

---

## Design System

### Light/Dark Theme

The theme system uses CSS custom properties with two modes:

- **Light mode:** White-blue palette (`--bg-primary: #f8fafc`, `--accent-1: #2563eb`)
- **Dark mode:** Blue-purple-black palette (`--bg-primary: #0a0a14`, `--accent-1: #60a5fa`)

**Detection:** System preference via `prefers-color-scheme` media query + manual toggle (persisted in `localStorage`). The `<html>` element gets a `.dark` class for dark mode.

### CSS Variables (key ones)

| Variable | Light | Dark | Purpose |
|----------|-------|------|---------|
| `--bg-primary` | `#f8fafc` | `#0a0a14` | Page background |
| `--bg-card` | `#ffffff` | `#14142a` | Card surfaces |
| `--text-primary` | `#0c1222` | `#f0f0ff` | Main text |
| `--accent-1` | `#2563eb` | `#60a5fa` | Primary accent |
| `--tag-bg` | `#dbeafe` | `rgba(96,165,250,0.1)` | Tag pill backgrounds |

### Tailwind Config

- Custom font: `Inter` as the primary sans-serif
- Custom color scales: `surface` (dark palette) and `accent` (amber, orange, purple, blue, emerald)
- Custom animations: `fade-in` and `pulse-slow`

### Component Classes

| Class | Purpose |
|-------|---------|
| `.nav-link` | Navigation links (muted, bold on hover/active) |
| `.card-hover` | Cards with shadow + lift on hover |
| `.fade-in` / `.fade-in-delay-*` | Staggered entrance animations |
| `.showcase-*` | Banner carousel components |
| `.discover-*` | Vertical discipline carousel |
| `.photo-viewer-*` | Unsplash-style photo overlay |
| `.detail-*` | Notion-style project/work overlay |
| `.filter-section` | Tag filter wrapper (z-index: 50) |
| `.gallery-placeholder` | Gallery items (z-index: 1) |

---

## Pages

### 1. Homepage (`/`) — `index.astro` (430 lines)

The homepage has four sections stacked vertically:

#### a) Recently On Banner Carousel
- Full-bleed banner (28vh height, min 240px)
- Shows recent work items with gradient backgrounds (or uploaded photos)
- Decorative icon at `right-[18%]` (opacity 8%)
- Text content: icon + title, category pill, description, "Explore" link
- Navigation: left/right arrow buttons (glass-morphism style, z-index: 20)
- Dots below the carousel for direct navigation
- Auto-advances every 5 seconds (restarts on manual interaction)
- **Pointer-events fix:** Overlay and content container have `pointer-events: none`, children (text, arrows) have `pointer-events: auto`. Active slide gets `pointer-events: auto` via inline style + JS.

#### b) Personal Branding
- GA icon (blue accent, bordered card)
- "Guru Ankam" heading (extrabold)
- Tagline: "Photographer · Drummer · Developer · Creative"
- Bio paragraph from `content.site.bio`

#### c) Discover More Carousel
- Vertical infinite carousel showing disciplines (Photography, Music, Code, Creative)
- **Double-list approach:** Items are tripled (12 items = 3 copies of 4) for seamless infinite scrolling
- Active item centered in a 216px container (3 items visible at 72px each)
- Active item has full opacity + shadow; inactive items are dimmed (0.45 opacity)
- "Go!" button appears only on the active item
- Controls: prev arrow, play/pause toggle (icon button), next arrow
- Dots below for direct navigation
- Keyboard support: ArrowUp/ArrowDown
- Touch support: swipe up/down on mobile
- Aligned with "Discover more about me!" title via `md:items-start` + `md:pt-8`

#### d) Bottom CTA
- "Want to know the full story? About me →" link

### 2. Photography (`/photography`) — `photography.astro` (313 lines)

- Page title "Moments in Light" with description
- **Tag dropdown filter:** Collapsible dropdown with all unique tags; when selected, shows as a pill with X to remove
- Category filter buttons (All, Landscape, Portrait, Street)
- Gallery grid (1/2/3 columns responsive)
- **Pure gallery style:** Photos show without any overlay by default
- **Hover overlay:** On mouse hover, shows title, category, and up to 3 tags in a dark gradient overlay
- Placeholder SVG for photos without uploaded files

#### Photo Viewer Overlay (Unsplash-style)
- **Transparent background:** `rgba(0,0,0,0.88)` + backdrop blur (16px)
- **Back button:** Prominent pill-shaped button with "Back" label, glass-morphism, hover animation
- **Main photo:** Takes `min-height: 50vh`, `max-height: 80vh` — dominant element
- **Info underneath:** Title, description, camera/lens/location details
- **Tags:** Clickable tags in viewer — closes viewer and filters gallery to that tag
- **Similar photos:** Horizontal scrollable row (200px wide cards, scroll-snap)
- Keyboard: Escape to close. Click outside to close.

### 3. Code (`/code`) — `code.astro` (250 lines)

- Page title "Building Things" with description
- **Tag dropdown filter:** Same pattern as photography (dropdown + active pill with X)
- Project cards with:
  - Banner/preview image (from `file` field) or gradient + icon fallback
  - Title, description, GitHub/Live links (stopped propagation so clicking links doesn't open overlay)
  - Tech stack tags as pills

#### Project Detail Overlay (Notion-style)
- Back button (same style as photo viewer)
- Banner: uploaded image or gradient
- Main area: icon + title + description + long description (HTML)
- Sidebar: Tech Stack pills + Details text
- GitHub + Live Demo buttons

### 4. Creative (`/creative`) — `creative.astro` (214 lines)

- Same pattern as Code page
- 2-column grid of creative works
- Tag dropdown filter
- Preview image or gradient + icon on cards
- Type label, title, description, tags on each card

#### Creative Detail Overlay
- Same Notion-style pattern as Code
- Banner + icon + title + type + description + long description
- Sidebar: Tags

### 5. About (`/about`) — `about.astro` (42 lines)

- Simple page with title, bio paragraphs (supports HTML like `<strong>`), and quick facts
- Reads from `content.pages.about`
- Quick facts are colored items with icons

### 6. Music (`/music`) — `music.astro` (47 lines)

- Drummer intro, gear list, influences
- Reads from `content.pages.music`

### 7. Contact (`/contact`) — `contact.astro` (67 lines)

- Email, GitHub, Instagram, LinkedIn links
- Reads from `content.site`

---

## Content System

### Architecture

All site content lives in a single file: `data/content.json` (202 lines).

**Flow:**
1. Pages import `content.json` at build time (Astro frontmatter)
2. Content is rendered into static HTML
3. Admin panel edits the in-memory content object
4. User exports edited JSON → replaces `data/content.json` → rebuilds

### Content Structure

```json
{
  "site": {
    "name": "Guru Ankam",
    "tagline": "Photographer · Drummer · Developer · Creative",
    "bio": "...",
    "email": "...",
    "github": "...", "instagram": "...", "linkedin": "..."
  },
  "showcase": {
    "label": "Recently on:",
    "slides": [{ "title", "category", "description", "icon", "gradient", "dotColor", "href", "imageFile" }]
  },
  "disciplines": [
    { "title", "tagline", "href", "color", "number" }
  ],
  "pages": {
    "about": { "title", "bio": [], "facts": [] },
    "photography": { "title", "description", "photos": [{ "alt", "category", "tags", "camera", "lens", "location", "file" }] },
    "music": { "title", "description", "gear": [], "influences": "" },
    "code": { "title", "description", "projects": [{ "title", "description", "longDescription", "tags", "techDetails", "github", "live", "icon", "gradient", "bannerColor", "file" }] },
    "creative": { "title", "description", "works": [{ "title", "description", "type", "longDescription", "icon", "gradient", "bannerColor", "tags", "file" }] }
  }
}
```

**Key fields:**
- `file`: Base64 data URL for uploaded images (photos, showcase slides, code/creative banners)
- `imageFile`: Base64 data URL for showcase slide background images
- `tags`: Array of strings for filtering (photography, code, creative)
- `gradient`: CSS gradient string for backgrounds (fallback when no image)

### Image Handling

Images are stored as base64 data URLs directly in `content.json`. This works for small galleries but can bloat the JSON file with many large images. For production, consider moving to a file-based or cloud storage approach.

---

## Admin Panel

`public/admin.html` (568 lines) — A fully self-contained, standalone HTML page with inline CSS and JavaScript. No framework dependencies.

### Features

- **Dark theme UI** (GitHub-style design)
- **Sidebar navigation** with sections: Site Settings, Recently On, Discover More, About, Photography, Music, Code, Creative
- **Inline editing** for all content.json fields via `data-path` bindings
- **Drag-drop file upload** with:
  - Format validation: JPG, PNG, WebP only
  - Size limit: 10MB
  - Recommended size display: 1920×1080
  - Visual preview after upload
- **Export:** Downloads the current in-memory content as `content.json`
- **Import:** Loads a JSON file into the editor
- **Responsive:** Works on mobile (sidebar collapses)

### Per-Section Editors

| Section | Editable Fields |
|---------|----------------|
| Site Settings | Name, tagline, description, bio, email, social URLs |
| Recently On | Slides with: image upload, title, category, description, icon, link, dot color, gradient |
| Discover More | Items with: title, number, tagline, link, color |
| About | Page title, bio paragraphs, quick facts (text + color) |
| Photography | Page title, description, photos with: image upload, alt text, category, comma-separated tags, camera, lens, location |
| Music | Page title, description, gear list, influences |
| Code | Page title, projects with: banner image upload, title, icon, description, long description, tech details, comma-separated tags, GitHub URL, live URL, banner color, gradient |
| Creative | Page title, works with: banner image upload, title, icon, type, comma-separated tags, description, long description, banner color, gradient |

### How to Use

1. Open `/admin.html` in the browser
2. Edit content in any section
3. Upload images via drag-drop zones
4. Click "Export content.json" to download
5. Replace `data/content.json` in the project root
6. Run `npx astro build` to rebuild the site

---

## Key Features

### Tag Filtering System

Implemented consistently across Photography, Code, and Creative pages:

1. **Dropdown trigger:** Button with tag icon + "Filter by tag" (or "Tags" for photography)
2. **Dropdown menu:** Lists all unique tags from the items, scrollable if many
3. **Selection:** Click a tag → dropdown closes, items filtered, active tag shown as pill with X
4. **Removal:** Click X on the pill → filter cleared, all items shown
5. **Z-index layering:** Filter section (`z-index: 50`) > gallery items (`z-index: 1`) > dropdown (`z-index: 200`)

### Infinite Carousel (Discover More)

Uses a **double-list** approach instead of clone nodes:

1. Items are tripled in the DOM (e.g., 4 items → 12 DOM elements)
2. Track starts at index 4 (the first item of the second copy)
3. Scrolling increments/decrements `currentIndex`
4. When reaching the end of the second copy, instantly resets to the first copy (no visual jump)
5. Active item is centered in the viewport using `translateY`

### Showcase Carousel

- Slides stacked with `position: absolute`, toggled via opacity classes
- Active slide: `opacity: 100`, `pointer-events: auto`
- Inactive slides: `opacity: 0`, `pointer-events: none !important`
- Arrows use glass-morphism (backdrop blur + semi-transparent white)
- Dot colors read dynamically from slide data (no hardcoding)

### Theme Toggle

- Detects system preference on first load
- Persists manual choice in `localStorage`
- Toggles `.dark` class on `<html>`
- Smooth transitions via CSS `transition` on `background-color` and `color`

### Debug Mode

- "D" button in bottom-right corner
- Red labels appear on all sections showing section names
- Toggle persists in `localStorage`
- Useful during development to identify section boundaries

---

## How It Works

### Build Pipeline

```
data/content.json → Astro frontmatter → Static HTML/CSS/JS → dist/
```

1. Each `.astro` page imports `content.json` in its frontmatter (server-side)
2. Content is destructured and passed to HTML templates
3. Tailwind processes classes at build time
4. Client-side JS (carousels, overlays, filters) is bundled separately
5. Output: static files in `dist/` ready for any static host

### Client-Side Interactions

All interactivity is vanilla JavaScript (no framework runtime):

| Feature | Mechanism |
|---------|-----------|
| Showcase carousel | `setInterval` for autoplay, CSS opacity transitions |
| Discover carousel | `translateY` transforms, `setTimeout` for snap-back |
| Photo viewer | `classList.add('open')`, `document.body.style.overflow = 'hidden'` |
| Tag filtering | Toggle `display: none` on non-matching items |
| Theme toggle | `.dark` class on `<html>`, `localStorage` persistence |
| Debug mode | Toggle `display: none/block` on `.debug-label` elements |

### Photo Upload Flow

1. User drops/selects image in admin drop zone
2. `FileReader.readAsDataURL()` converts to base64
3. Data URL stored in `content` object (e.g., `content.pages.photography.photos[idx].file`)
4. User exports JSON → replaces `content.json` → rebuilds
5. At build time, `p.file` is rendered as `<img src={p.file}>`

---

## Build & Deploy

### Commands

```bash
npm run dev      # Start dev server (hot reload)
npm run build    # Build static site to dist/
npm run preview  # Preview built site locally
```

### Requirements

- Node.js >=20.9.0 (for Astro v5 compatibility)
- npm (with `--cache /tmp/npm-cache-tmp` flag if root-owned files in `~/.npm/_cacache`)

### Deployment

The `dist/` folder is a static site. Deploy to:
- **Vercel:** `vercel dist/`
- **Netlify:** Point to `dist/` folder
- **GitHub Pages:** Push `dist/` to `gh-pages` branch
- **Any static host:** Upload the `dist/` folder

### Build Stats

- Build time: ~800ms (7 pages)
- Zero warnings, zero errors
- Output: `dist/` with HTML pages + `_astro/` CSS/JS bundles

---

## Future Improvements

- [ ] Upgrade Node.js to v22+ to enable Astro v7
- [ ] Add real photos to replace placeholders
- [ ] Add real project data (GitHub URLs, live demos)
- [ ] Update social links in `content.json`
- [ ] Consider cloud image storage (S3, Cloudinary) to avoid bloating `content.json`
- [ ] Add analytics (Plausible, Umami)
- [ ] Music audio player integration
- [ ] Consider adding a blog section
