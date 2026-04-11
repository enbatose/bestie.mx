# Bestie (`bestie.mx`)

Greenfield web app for the **Bestie** roommate / shared-rent marketplace in **Mexico** (initial metros: Guadalajara, Mérida, Puerto Vallarta, Sayulita, Bucerías).

## Stack

- **Vite 6** + **React 19** + **TypeScript**
- **Tailwind CSS** with design tokens aligned to `docs/PRODUCT_V1.md` (forest / lime / mint palette)

## Run locally

```bash
cd bestie.mx
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

```bash
npm run build   # production bundle → dist/
npm run preview # serve dist locally
```

## Repo / GitHub

Create the remote **bestie.mx** on GitHub, then:

```bash
git init
git add .
git commit -m "Initial Bestie web scaffold"
git branch -M main
git remote add origin https://github.com/<you>/bestie.mx.git
git push -u origin main
```

## Product source of truth

See **`docs/PRODUCT_V1.md`** for v1 scope (map, filters, property/room model, Messenger handoff, WhatsApp OTP, groups, admin, non-goals).

## Next implementation slices

1. **Router + layouts** (e.g. React Router), auth shell, protected routes  
2. **Map** (Mapbox or Google) with pins + list sync  
3. **Search API** + filter state (location, budget, tags, gender, age)  
4. **Publication wizard** with autosave + property/room statuses  
5. **Backend** (Laravel 11 API or Node) — this repo can stay SPA or move to monorepo `apps/web`
