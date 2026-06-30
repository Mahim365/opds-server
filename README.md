# Free OPDS Server — Anna's Archive + Z-Library

Deploy this for **free** on Vercel and get an OPDS feed you can add to Readest, KOReader, or any OPDS reader.

---

## 🚀 Deploy in 5 Minutes (Free)

### Step 1 — Create a GitHub account
Go to https://github.com and sign up (free).

### Step 2 — Create a new repository
1. Click the **+** button → **New repository**
2. Name it: `opds-server`
3. Set to **Public**
4. Click **Create repository**

### Step 3 — Upload these files
1. On your new repo page, click **uploading an existing file**
2. Upload ALL files from this zip (keeping the folder structure):
   - `api/opds.js`
   - `api/opds/search.xml.js`
   - `vercel.json`
   - `package.json`
3. Click **Commit changes**

### Step 4 — Deploy on Vercel
1. Go to https://vercel.com and sign up with your GitHub account (free)
2. Click **Add New Project**
3. Click **Import** next to your `opds-server` repository
4. Leave all settings as default
5. Click **Deploy**
6. Wait ~1 minute...
7. ✅ You'll get a URL like: `https://opds-server-xyz.vercel.app`

---

## 📱 Add to Readest

1. Open **Readest** app
2. Go to **Library** → **OPDS Catalog** (or Settings → Add Catalog)
3. Enter your Vercel URL:
   ```
   https://opds-server-xyz.vercel.app/api/opds
   ```
4. Save — you can now search Anna's Archive & Z-Library directly from Readest!

---

## 🔍 How to Search

Your OPDS URL supports these parameters:

| URL | What it does |
|-----|-------------|
| `/api/opds` | Root catalog (shows all sources) |
| `/api/opds?q=dune&source=annas` | Search Anna's Archive for "dune" |
| `/api/opds?q=dune&source=zlib` | Search Z-Library for "dune" |
| `/api/opds?q=dune&source=all` | Search both at once |

---

## ✅ Features
- 100% free (Vercel free tier is generous)
- No API keys needed
- Searches Anna's Archive + Z-Library
- Returns EPUB and PDF results
- Works with Readest, KOReader, Calibre, Panels, and any OPDS reader

## ⚠️ Notes
- Results link to the book's page on the source site (not direct download)
- If Anna's Archive or Z-Library changes their site layout, results may be fewer
- Vercel free tier: 100GB bandwidth/month, more than enough for personal use
