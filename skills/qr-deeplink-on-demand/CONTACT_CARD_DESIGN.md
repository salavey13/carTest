# Contact Card with QR Code → Crew Creation Deep Link

## Overview

A printable contact card (vCard-style PNG or PDF business card) that contains
a QR code linking to the **crew creation** deep link. When scanned, the QR
opens the Telegram bot at `t.me/oneBikePlsBot/app?startapp=create_crew`,
which `hooks/useStartParamRouter.ts` routes to `/wblanding#create-crew-form`,
where `<CrewCreationForm>` renders and calls the `createCrew()` server action
to insert a new crew row + owner membership.

## The Deep Link

```
https://t.me/oneBikePlsBot/app?startapp=create_crew
```

Routing chain:

```
QR code (PNG/PDF)
  ↓ (camera scan)
t.me/oneBikePlsBot/app?startapp=create_crew
  ↓ (Telegram opens WebApp)
hooks/useStartParamRouter.ts (line 32):
  create_crew → "/wblanding#create-crew-form"
  ↓
app/wblanding/page.tsx renders <CrewCreationForm>
  ↓ (anchor scroll to #create-crew-form)
app/wblanding/components/CrewCreationForm.tsx
  ↓ (user fills name + slug + description, clicks "СФОРМИРОВАТЬ ЭКИПАЖ")
app/actions.ts → createCrew()
  ↓ (inserts public.crews + crew_members{role=owner})
  ↓ (also re-assigns owner's bikes to the new crew)
  ↓ (redirect via window.location.href)
/franchize/create?slug=<new-slug>&just_created=1
  ↓
CreateFranchizeForm loads crew by slug (now it exists → canEdit=true)
  ↓ (user customizes palette / content / map / contract defaults)
saveFranchizeConfig() → updates metadata.franchize on the new crew
```

## Visual Layout

### PNG vCard (1024×576, 16:9)

```
┌──────────────────────────────────────────────────────────┐
│ ████████████████████████████████████████████████████████ │  ← accent bar
│                                                          │
│   ┌─────────────┐    ┃                                   │
│   │             │    ┃  VIP BIKE ELECTRO                 │
│   │             │    ┃  Создай свой экипаж за 30 секунд  │
│   │   QR CODE   │    ┃                                   │
│   │  360×360    │    ┃  ☎ +7 9200-789-888                │
│   │             │    ┃  ✈ @I_O_S_NN                      │
│   │  [LOGO in   │    ┃  ⌖ пл. Комсомольская 2, Н. Новгород│
│   │   center]   │    ┃                                   │
│   │             │    ┃  Отсканируйте QR для запуска      │
│   └─────────────┘    ┃  в Telegram                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### PDF Business Card (A6 landscape, 105×148 mm)

Same layout, but print-ready:
- 4-color process, 300 DPI
- A6 = standard business card size (105×148 mm = ~4.1×5.8 in)
- Landscape orientation
- Bleed area: 3mm on each side (not rendered — extend accent bar to edges)
- Safe area: 5mm inset on each side

## Generation

Use the `qr-deeplink-on-demand` skill:

```bash
# PNG vCard (digital sharing, social media, website embed)
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format vcard_png \
  --brandName "VIP BIKE ELECTRO" \
  --tagline "Создай свой экипаж за 30 секунд" \
  --phone "+7 9200-789-888" \
  --telegram "@I_O_S_NN" \
  --address "пл. Комсомольская 2, Нижний Новгород" \
  --accentColor "#FFD700" \
  --bgColor "#0A0A0A" \
  --textColor "#FFFAF0" \
  --out /home/z/my-project/download/qr-vcard-create-crew.png

# PDF business card (print-ready, A6 landscape)
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format pdf_card \
  --brandName "VIP BIKE ELECTRO" \
  --tagline "Создай свой экипаж за 30 секунд" \
  --phone "+7 9200-789-888" \
  --telegram "@I_O_S_NN" \
  --address "пл. Комсомольская 2, Нижний Новгород" \
  --accentColor "#FFD700" \
  --bgColor "#0A0A0A" \
  --textColor "#FFFAF0" \
  --out /home/z/my-project/download/card-create-crew.pdf

# Raw QR (for embedding in your own designs, posters, stickers)
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format raw_png \
  --qrSize 1024 \
  --out /home/z/my-project/download/qr-create-crew-large.png
```

## Use Cases

1. **Offline marketing** — Print the PDF card on physical business cards for
   trade shows, moto-meets, dealer events. Attendees scan with their phone
   camera → Telegram opens → they create their own crew in 30 seconds.

2. **Telegram-shareable image** — Post the PNG vCard in crew channels,
   partner chats, or DMs. Recipients tap to open the image, then scan the QR
   with their phone camera (or long-press → "QR code detected" in iOS
   Photos).

3. **Sticker pack** — Print the raw QR on die-cut stickers. Apply to
   laptops, bike frames, helmets, store windows.

4. **Email signature embed** — Embed the PNG vCard in your email signature
   so every email you send advertises crew creation.

5. **Boss-command integration** — When the boss agent identifies a hot lead
   who wants to start their own franchise, automatically generate the PDF
   card and send it to the lead's Telegram chat:

   ```bash
   # In a boss-command handler:
   node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
     --type create_crew \
     --bot oneBikePlsBot \
     --format pdf_card \
     --brandName "$LEAD_NAME" \
     --phone "$LEAD_PHONE" \
     --out "/tmp/card-$LEAD_ID.pdf"

   node scripts/codex-notify.mjs telegram-doc \
     --chatId "$LEAD_CHAT_ID" \
     --document "/tmp/card-$LEAD_ID.pdf"
   ```

## Customization

All visual parameters are configurable via CLI flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `--brandName` | "Экипаж" | Brand name in card header |
| `--tagline` | "" | Slogan under brand name (PDF only) |
| `--phone` | "" | Contact phone |
| `--telegram` | "" | Telegram handle (e.g. "@I_O_S_NN") |
| `--address` | "" | Physical address |
| `--logoUrl` | "" | URL to logo (PNG/SVG) — embedded in QR center + card header |
| `--accentColor` | "#FFD700" | Accent color (top bar, brand underline, tagline) |
| `--bgColor` | "#0A0A0A" | Card background |
| `--textColor` | "#FFFAF0" | Body text color |
| `--qrSize` | (per format) | QR pixel size (raw=512, vcard=360, pdf=280) |
| `--errorCorrection` | "H" | QR error correction: L/M/Q/H (H supports logo overlay) |

## Verification

To verify the QR works end-to-end:

1. Generate the card (commands above)
2. Open the PNG/PDF on your phone or print it
3. Scan the QR with your phone camera
4. You should be redirected to `t.me/oneBikePlsBot/app?startapp=create_crew`
5. Telegram opens the WebApp → loads `/wblanding#create-crew-form`
6. The CrewCreationForm is in view (scrolled to the `#create-crew-form` anchor)
7. Fill in name/slug/description → click "СФОРМИРОВАТЬ ЭКИПАЖ"
8. `createCrew()` runs → crew row + owner membership inserted
9. Browser redirects to `/franchize/create?slug=<new-slug>&just_created=1`
10. `CreateFranchizeForm` loads → user customizes palette/content/map/contract
11. `saveFranchizeConfig()` saves → new crew is now live at `/franchize/<slug>`

## Files

- `skills/qr-deeplink-on-demand/SKILL.md` — skill definition
- `skills/qr-deeplink-on-demand/scripts/generate-qr.mjs` — generator script
- `hooks/useStartParamRouter.ts` — deep-link router (line 32: `create_crew → /wblanding#create-crew-form`)
- `app/wblanding/components/CrewCreationForm.tsx` — real create form
- `app/franchize/create/CreateFranchizeForm.tsx` — customization form (post-create)
- `app/franchize/components/FranchizeProfileButton.tsx` — dropdown that exposes the create button
- `docs/crewDocs/vip-bike-franchize-hydration.sql` — SQL seed (now includes `ui.showCreateButton: true`)
