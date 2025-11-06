# AspectNova — A Universal Expo + React Native Boilerplate for Content, Media, and Reading Apps

**AspectNova Base** is a modern, production-ready **Expo + React Native boilerplate** built with **TypeScript**, **Expo Router**, **Zustand**, and **React Query**.  
It serves as a **universal content platform foundation** for building reading, media, or document-based apps — everything from a **book library**, **digital magazine**, or **article reader**, to a **documentation viewer**, **education app**, or **company knowledge base**.

---

## What It Is

A cross-platform, theme-aware, and offline-ready **content application framework** with:
- Robust **authentication** system scaffold.
- Modular architecture ready for **mock or live backends**.
- Built-in **library, feed, and reader** modules.
- Clean, type-safe, and fully **responsive** UI.  

Designed for teams that require a robust, ready-to-extend foundation rather than starting every project from scratch.

---

## Use Cases

**AspectNova Base** can be adapted into a variety of professional-grade apps:

| Category | Example Use Case | Description |
|-----------|------------------|--------------|
| **Book Library App** | eBook / PDF library | Browse, search, and read PDFs or eBooks locally or from a backend. |
| **Magazine Reader** | Digital news or article app | Deliver rich visual content with feature banners and feed sections. |
| **Knowledge Base Viewer** | Corporate or educational portal | Present documents, guides, or learning materials with categories and search. |
| **Education App** | Course or syllabus reader | Fetch lessons, modules, and PDFs for offline study. |
| **Content Aggregator** | Tech news, blog, or feed reader | Connect to APIs or RSS feeds and render with elegant UI. |
| **Documentation Viewer** | Internal docs or user manuals | Browse sections, cache pages, and open PDFs in modal readers. |
| **Training & Certification App** | Learning + reading experience | Combine login, progress tracking, and PDF/video resources. |

---

## Core Features

### Authentication
- Prebuilt auth flow (`/app/(auth)`) with login screen and secure storage via **expo-secure-store**.  
- Redirect logic integrated with **Expo Router guards**.  
- Extendable to JWT, OAuth, or API key systems.

### Library & Content Management
- Adaptive grid layout for all platforms (responsive + fluid).  
- Pull-to-refresh and infinite scrolling.  
- Data persistence via **React Query** and **Zustand**.  
- Category tabs, search, and offline caching.

### Feed / Explore
- Feature banners (`FeatureBand`) and card lists (`FeedRow`).  
- Dynamic categories via Zustand (`useCategories`).  
- Instant navigation using **Expo Router** + stable route keys.  
- High-resolution covers and prefetch optimization.

### Reader Module
- Modal PDF reader (`/app/(modals)/pdf/[id].tsx`).  
- Tiles-first rendering for fast display and smooth paging.  
- Persistent reader state (page, zoom, layout).  
- Offline mock support and backend-ready hooks.

### Design & Theming
- Elegant typography: **Playfair Display** + **Roboto Condensed**.  
- Automatic light/dark theme switching.  
- Unified spacing, color palette, radius, and shadow tokens.  
- Theme constants stored in `@/config/theme.ts`.

### Backend & Mock Mode
- Local **mock API interceptor** with seeded demo data (no server needed).  
- Switch instantly to a live backend using `.env.local.backend`.  
- Fully typed API clients in `src/lib/pdfApi.ts`.

### Developer Experience
- **Strict TypeScript**, **Zod validation**, and **React Query** hooks.  
- **ESLint**, **Prettier**, and **Universe config**.  
- Debug tools (React Query Devtools for web).  
- Built-in stubs for web-only dependencies.  
- Node ≥ 20, Expo SDK 54.

---

## Architecture Overview

```
src/
├── app/
│   ├── (auth)/login.tsx           # Authentication flow
│   ├── (tabs)/home/feed.tsx       # Explore / Feed
│   ├── (tabs)/library.tsx         # Library view with grid
│   ├── (modals)/pdf/[id].tsx      # PDF modal reader
│   ├── (tabs)/_layout.tsx         # Tabs + category context
│   ├── _layout.tsx                # Root navigation
│   └── index.tsx                  # Entry route
│
├── components/ui/                 # Reusable UI elements
│   ├── SafeImage.tsx, Button.tsx, ErrorView.tsx, TabsBar.tsx ...
│
├── config/                        # Environment + theme
│   ├── env.ts, theme.ts, constants.ts, routes.ts
│
├── lib/                           # Helpers and API clients
│   ├── pdfApi.ts, image-utils.ts, react-query-lifecycle.ts ...
│
├── mock/
│   └── installMock.ts             # Local mock fetch interceptor
│
├── modules/reader/
│   └── queries.ts                 # Reader data queries
│
├── store/                         # Zustand global state
│   ├── useAuth.ts, usePdfStore.ts, useCategories.ts
│   └── devtools.[native|web].ts
│
└── utils/
    └── devLog.ts
```

---

## Environment Configuration

| Mode | File | Description |
|------|------|-------------|
| **Mock** | `.env.local.mock` | Uses generated demo images and local data. |
| **Backend** | `.env.local.backend` | Connects to your live API server. |

Switch easily:
```bash
cp .env.local.mock .env.local      # Mock mode (offline)
# or
cp .env.local.backend .env.local   # Backend mode
```

---

## Environment Variables

| Key | Description |
|-----|--------------|
| `APP_ENV` | `development` or `production` |
| `API_BASE_URL` | `mock://local` or real backend URL |
| `APP_BRAND_NAME` | App title (UI) |
| `APP_SCHEME` | Deep link scheme |
| `APP_WEB_ORIGIN` | Dev web origin |
| `DEMO_IMAGES` | Enable seeded Unsplash demo covers |
| `ALLOWED_IMAGE_HOSTS` | Whitelisted CDNs |
| `EAS_PROJECT_ID`, `APP_VERSION` | Expo / EAS metadata |

---

## Technical Highlights

- **Expo Router** for file-based navigation (tabs, modals, auth).  
- **React Query** for async data and caching.  
- **Zustand** for simple, performant state management.  
- **Zod** for runtime schema validation.  
- **Reanimated + Worklets** for smooth transitions.  
- Optimized `FlatList` virtualization, memoization, and prefetching.  
- Accessibility-friendly, safe-area compliant UI.

---

## Development

**AspectNova** provides a flexible development workflow supporting both **mock** and **backend** environments.  
This section describes the recommended setup for local development and common developer tasks.

### Prerequisites
- **Node.js ≥ 20**
- **Expo CLI** — install globally with `npm i -g expo-cli`
- **Xcode** or **Android Studio** (optional, for native builds)

### Local Setup
Clone the repository and install dependencies:
```bash
git clone https://github.com/dmsfiris/AspectNova.git
cd AspectNova
npm install
```

### Running in Mock Mode
Start the application with local mock data and assets:
```bash
cp .env.local.mock .env.local
npm run start
```

### Connecting to a Backend
Switch the environment to use your live API or remote server:
```bash
cp .env.local.backend .env.local
npm run start
```

### Quality Checks
Run static analysis and type validation before committing changes:
```bash
npm run lint
npm run typecheck
```

---

## NPM Scripts

```json
{
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
  "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit"
}
```

---

## Future Enhancements

- PDF streaming & thumbnail caching  
- Backend-driven pagination & categories  
- Offline mode (IndexedDB / AsyncStorage)  
- Persistent authentication & user profiles  
- Full dark mode customization  
- Bookmarks & annotation support  
- Push notifications for new content  

---

## Showcase

**AspectNova** is built to adapt to a variety of product scenarios.  
Below are representative configurations demonstrating its flexibility and modular architecture.

| Variant | Highlights |
|----------|-------------|
| **Book Library** | Cross-platform eBook and PDF browsing with adaptive grid layout, search, and persistent reader state. |
| **Magazine Reader** | Editorial-style feed with feature banners, category tabs, and fast navigation across platforms. |
| **Knowledge Base** | Structured documentation viewer with search, local caching, and offline support. |
| **Education App** | Course viewer with authenticated lessons, reading progress, and modal PDF lessons. |
| **News Reader** | Lightweight content feed optimized for performance, pull-to-refresh, and pagination. |

Each configuration shares the same code foundation—only data sources, branding, and layout composition vary—making **AspectNova** an ideal base for both experimental prototypes and production-grade apps.

---

## Credits

Developed with ❤️ by **AspectSoft**  
Built with **Expo Router**, **React Native**, and **TypeScript**  
UI/UX inspired by clean, minimalist reading platforms  

---

## License

Licensed under the **Apache License 2.0** — see the LICENSE and NOTICE files for details.