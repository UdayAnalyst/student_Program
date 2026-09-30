# Launchpad (web)

Next.js + Tailwind front end for finding tech opportunities open to underclassmen
(Class of 2029 sophomores and Class of 2030 freshmen), with SMS alerts.

## Run it

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

## Data

- Real listings come from the scraper's output, `../output/student_programs.json`
  (written by `scraper.py` at the repo root). `lib/scraped.ts` maps those records into the
  `Opportunity` shape in `lib/types.ts`. When the scraper gains new fields (deadline, location…),
  map them there.
- `data/opportunities.json` holds mock listings that pad the demo. Turn them off with
  `INCLUDE_MOCK = false` in `lib/opportunities.ts`.

## SMS alerts

`POST /api/subscribe` saves a subscriber and sends a welcome text. `POST /api/notify`
texts each subscriber the open opportunities matching their class year that they
haven't been sent yet. Subscribers are stored in `.data/subscribers.json` (gitignored).

The provider is chosen in `.env.local` (gitignored, never commit it):

| `SMS_PROVIDER` | Behavior |
| --- | --- |
| `demo` | Texts appear on screen and in the server log; nothing is sent |
| unset | Twilio SMS. Needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Trial accounts can only send Twilio's predefined templates, so custom texts need an upgraded account |
| `whatsapp` | Twilio WhatsApp. Set `TWILIO_WHATSAPP_FROM`. Trial senders also require a Content Template (`TWILIO_WHATSAPP_CONTENT_SID`) |
| `textbelt` | Textbelt. Free key sends 1 text/day (US); set `TEXTBELT_KEY` for a paid key |
