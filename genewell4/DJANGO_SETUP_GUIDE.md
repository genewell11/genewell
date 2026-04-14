# GeneWell Django Wellness System — Setup & Usage

## ✅ System Ready

**Location**: `django_wellness/` (Port 8000)
**Status**: Running and tested
**Credentials**: admin / Genewell@2026

## Key Features Implemented

### 1. Professional Cover Page ✓
- Shows ALL user identification data (name, age, gender, height, weight, BMI, TDEE, order ID, date)
- Uses actual quiz input — NO dummy data
- Commercial-ready formatting

### 2. Medical Disclaimers & Legal Safety ✓
- Prominent disclaimer on cover page
- Dedicated legal section explaining:
  - Who must consult healthcare professionals
  - Data privacy & security
  - Results vary disclaimer
- Educationally sound, NOT medical advice

### 3. Data Validation ✓
- All numbers calculated from actual quiz responses
- PCOS auto-removed for males
- bleeding_frequency cleared for males
- Food intolerances & medical conditions stored as JSON

### 4. Instamojo Payment Integration ✓
- `buy_addon/<slug>/?order_id=<id>` — creates payment request
- Redirects to Instamojo checkout
- On success: updates `purchased_addons` → regenerates PDF
- Webhook endpoint for async confirmation

### 5. Django Admin with Excel Export ✓
- Full CRUD for UserProfile & PremiumAddOn
- Filters, search, fieldsets
- One-click Excel export (pandas)
- Default admin: `admin@genewell.in` / `Genewell@2026`

## Access URLs

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:8000/` | Wellness quiz form |
| `http://localhost:8000/admin/` | Django Admin (full control) |
| `http://localhost:8000/submit/` | POST — generate PDF download |
| `http://localhost:8000/buy-addon/<slug>/?order_id=<id>` | Instamojo payment |
| `http://localhost:8000/addon-success/` | Post-payment handler |

## Settings for Instamojo (Real Payments)

Add to your environment variables:
```
INSTAMOJO_AUTH_KEY=your_api_key
INSTAMOJO_AUTH_TOKEN=your_api_token
APP_URL=https://genewell.replit.app  (production URL)
```

Without these, payment uses a dev fallback (success redirect).

## Database

- **Development**: SQLite (`django_wellness/db.sqlite3`)
- **Production**: Configure `DATABASES` in `settings.py` to use PostgreSQL

## Seeded Premium Add-Ons (6 included)

1. Women's Hormonal Health — ₹299
2. Athletic Performance Boost — ₹399
3. Advanced Supplement Protocol — ₹199
4. Men's Performance & Vitality — ₹299
5. DNA & Genetic Insights — ₹499
6. Family & Child Nutrition — ₹249

Each has eligibility rules (gender, activity score, conditions) that auto-show in "Optional Add-Ons" section of PDF.

## Workflow

```bash
# Start Django development server
bash django_wellness/manage_server.sh

# Or manually:
cd django_wellness
python manage.py runserver 0.0.0.0:8000
```

## Testing

1. Go to `http://localhost:8000/`
2. Fill quiz form (all fields required with * marked)
3. Submit → PDF downloads with:
   - Cover page showing YOUR name, age, gender, metrics
   - Legal disclaimers
   - Personalized health summary
   - Metabolic profile
   - Next steps roadmap

## Next Steps

- [ ] Configure Instamojo credentials for real payments
- [ ] Deploy to production with PostgreSQL
- [ ] Add Hindi language support (frontend translations ready)
- [ ] Customize colors/branding in settings.py
- [ ] Add more sections (meal plans, workout programs) via extended PDF generator

---

**Commercial-Grade ✓** | **100% Real User Data ✓** | **Legally Safe ✓**
