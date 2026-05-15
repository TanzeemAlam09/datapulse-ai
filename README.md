# ⚡ DataPulse AI — Automated Invoice Extractor

> Next.js 16 · Neon PostgreSQL · Tesseract OCR · Deploy FREE on Vercel

---

## ✨ Features

- 📄 **PDF Upload & Parsing** — text-based AND scanned PDFs (Tesseract OCR)
- 🧠 **Smart Extraction** — invoice number, dates, vendor, client, line items, tax, totals
- ⚠️ **Duplicate Detection** — auto-flags invoices matching same vendor + amount within 7 days
- 🔴 **Overdue Tracker** — highlights invoices past their due date with days overdue
- 📊 **Analytics Dashboard** — vendor spend, category breakdown, monthly volume chart
- 🏷️ **Auto-Categorization** — line items tagged: Design, Dev, Marketing, Infrastructure, etc.
- 📥 **Export** — CSV and JSON export per invoice
- 🔐 **Auth System** — register, login, JWT tokens
- 🛡️ **Admin Panel** — user management, audit logs

---

## 🚀 Deployment

### STEP 1 — Neon Database (free)
1. Go to https://neon.tech → Sign up free
2. Click "New Project" → name it "datapulse" → Create
3. Go to Connection Details → copy the Connection String

### STEP 2 — Push to GitHub
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/datapulse-ai.git
   git push -u origin main

### STEP 3 — Deploy on Vercel (free)
1. Go to https://vercel.com → Sign up with GitHub
2. Click "Add New Project" → import your repo
3. Add Environment Variables:
   DATABASE_URL = (your Neon connection string)
   JWT_SECRET   = (any random string)
4. Click Deploy → wait ~1 min

### STEP 4 — Initialize Database (ONE TIME)
Visit this URL once after deploy:
   https://YOUR-APP.vercel.app/api/init

You'll see: Database initialized. Default admin: admin / Admin@123

### STEP 5 — Login
Go to https://YOUR-APP.vercel.app
Admin: admin / Admin@123  ← change this immediately!

---

## 💻 Local Development

   npm install
   cp .env.example .env.local
   # paste your Neon DATABASE_URL in .env.local
   npm run dev
   # visit http://localhost:3000/api/init  (once)
   # then http://localhost:3000

---

## ❓ FAQ

Q: Do I need to set up a server?
A: No. Vercel runs Next.js API routes as serverless functions automatically.

Q: Does it cost money?
A: No. Vercel free + Neon free = $0/month.

Q: Can it read scanned PDFs?
A: Yes! Tesseract OCR is built in — both text-based and scanned PDFs work.

Q: How do I add users?
A: Admin Panel → User Management → Create User.

Q: What does duplicate detection do?
A: If you upload an invoice with the same vendor name and total amount as one uploaded in the last 7 days, a warning banner appears before saving.
