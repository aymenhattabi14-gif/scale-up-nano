# Scale Up Nano — standalone site

This is your club site as a real, ownable project (not tied to Claude).
It uses Firebase (free) to store events, forms, responses and memories,
and deploys as a normal static website with your own domain.

## 1. Set up Firebase (the database) — ~5 minutes

1. Go to https://console.firebase.google.com and create a project (free tier is enough).
2. In the left menu: **Build → Firestore Database → Create database**. Start in
   **test mode** (we'll lock it down in step 4).
3. Click the gear icon → **Project settings → General**, scroll to "Your apps",
   click the **</>** (web) icon, register an app (no need for hosting here).
4. Copy the `firebaseConfig` object it shows you.
5. Open `src/firebase.js` in this project and paste your values into the
   `firebaseConfig` object near the top.

## 2. Run it locally

You need Node.js installed (https://nodejs.org, the LTS version).

```bash
cd scale-up-nano
npm install
npm run dev
```

Open the localhost link it prints. Your public site loads by default.
Add `#admin` to the end of the URL to see the admin console.

## 3. Lock down Firestore before going live

Test mode allows anyone to read/write anything. Since there's no login system
(by design), tighten it to still allow this app to work but reduce abuse risk:

In Firebase console → Firestore Database → **Rules**, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /club_data/{document} {
      allow read: if true;
      allow write: if request.resource.data.value is string
                   && request.resource.data.value.size() < 4000000;
    }
  }
}
```

This keeps reads public (so the site works) and blocks abnormally large writes.
Full write-protection would require adding real user accounts (Firebase Auth),
which we can add later if you outgrow the "private admin link" approach.

## 4. Deploy it (make it a real public site)

### Option A — GitHub Pages (free, no separate host account needed)

1. Create a repo at https://github.com/new — name it, e.g., `scale-up-nano`.
2. Open `vite.config.js` in this project and set `base: "/scale-up-nano/"` to
   match your repo name exactly (already set to that name — change it if you
   pick a different repo name).
3. Push this whole folder to that repo:
   ```bash
   cd scale-up-nano
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/scale-up-nano.git
   git push -u origin main
   ```
4. On GitHub, go to your repo → **Settings → Pages** → under "Build and
   deployment", set **Source** to **GitHub Actions**.
5. The workflow in `.github/workflows/deploy.yml` runs automatically on that
   push — check the **Actions** tab for progress. Once it's green, your site
   is live at `https://YOUR_USERNAME.github.io/scale-up-nano/`.
6. Any time you push new changes to `main`, it redeploys automatically.

Your admin console is at that same link with `#admin` on the end.

### Option B — Vercel (free, slightly simpler dashboard)

1. Push this folder to a GitHub repo (create one at https://github.com/new,
   then follow GitHub's instructions to push this folder to it).
2. Go to https://vercel.com, sign up with GitHub, click **Add New → Project**,
   pick your repo, leave settings as default (Vercel auto-detects Vite), click **Deploy**.
3. You'll get a live link like `scale-up-nano.vercel.app` within a minute.

Netlify works the same way if you'd rather use that instead.

## 5. Connect your own domain (optional)

**If you used Vercel:**
1. Buy a domain (Namecheap, Google Domains, GoDaddy — a `.club` or `.org`
   domain usually costs $5–15/year).
2. In Vercel: your project → **Settings → Domains → Add**, type your domain.
3. Vercel gives you 1–2 DNS records to add at your registrar. Takes 10
   minutes to a few hours to activate.

**If you used GitHub Pages:**
1. Buy a domain as above.
2. In your repo → **Settings → Pages**, enter it under "Custom domain" —
   GitHub creates a `CNAME` file in your repo automatically.
3. At your domain registrar, add a `CNAME` record pointing to
   `YOUR_USERNAME.github.io` (or the `A` records GitHub's docs list, if
   using an apex domain like `scaleupnano.com` without `www`).
4. Also set `base: "/"` in `vite.config.js` once you're on a custom domain
   (you're no longer nested under `/scale-up-nano/`), then push again.

## Using the site day to day

- Public link: share this everywhere (Instagram, QR code, school email).
- Admin link: your public link + `#admin` — keep this one private. From
  there you create event posts, build each event's formula (text / multiple
  choice / photo questions), view submissions, and approve member-submitted
  memory photos.
