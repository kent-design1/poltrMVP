# i18n Translation Plan for POLTR Frontend

## Current State

- **Next.js 16 App Router**, React 19, ~30 custom components
- **~150+ hardcoded strings**, mixed German/English
- **No i18n setup** exists — clean slate
- Backend already supports `de-CH`, `fr-CH`, `it-CH`, `rm-CH`

## Recommended Library: `next-intl`

Best fit for App Router + Swiss multilingual context.

- First-class App Router / Server Components support
- Simple JSON message files, ICU message format
- Locale-prefixed routing (`/de/ballots`, `/fr/ballots`)
- Type-safe with TypeScript
- Lightweight, well-maintained

## Locale Priority

| Locale | Role |
|--------|------|
| `de` | Default (most Swiss referenda users) |
| `fr` | Secondary |
| `it` | Tertiary |
| `en` | Fallback / dev |

---

## Implementation Phases

### Phase 1: Setup & Configuration

1. Install `next-intl`
2. Create message files:
   ```
   src/messages/
   ├── de.json    <- default locale (Swiss German)
   ├── fr.json
   ├── it.json
   └── en.json    <- fallback for dev/international
   ```
3. Configure `next.config.ts` with `createNextIntlPlugin`
4. Create `src/i18n/` config files:
   - `routing.ts` — define locales, default locale, pathnames
   - `request.ts` — server-side locale resolution
5. Create middleware (`src/middleware.ts`) for locale detection & routing

### Phase 2: Restructure Routes for Locale Prefix

6. Add `[locale]` segment to the app directory:
   ```
   src/app/[locale]/
   ├── layout.tsx          <- set <html lang={locale}>
   ├── (auth)/
   │   ├── page.tsx
   │   └── auth/...
   ├── (app)/
   │   ├── layout.tsx
   │   ├── home/page.tsx
   │   ├── ballots/...
   │   └── review/...
   └── [slug]/page.tsx
   ```
   URLs become: `poltr.ch/de/ballots`, `poltr.ch/fr/ballots`, etc.

7. Update root layout to receive `locale` param, set `lang` attribute

### Phase 3: Extract Strings

8. Structure message keys by domain:
   ```json
   {
     "nav": {
       "home": "Startseite",
       "ballots": "Abstimmungen",
       "review": "Peer Review",
       "logout": "Abmelden"
     },
     "auth": {
       "loginTitle": "Bei POLTR anmelden",
       "email": "E-Mail-Adresse",
       "sendMagicLink": "Magic Link senden"
     },
     "ballots": {
       "title": "Abstimmungen",
       "loading": "Lade Abstimmungen...",
       "current": "Aktuell",
       "archived": "Archiviert",
       "noCurrentBallots": "Keine aktuellen Abstimmungen.",
       "noArchivedBallots": "Keine archivierten Abstimmungen.",
       "arguments": "Argumente",
       "helpful": "Hilfreich"
     },
     "review": {
       "title": "Peer Review",
       "noPending": "No pending reviews. Check back later.",
       "approve": "Genehmigen",
       "reject": "Ablehnen",
       "justificationRequired": "Justification (required)",
       "justificationOptional": "(optional)",
       "submit": "Review absenden"
     },
     "home": {
       "greeting": "Hallo {name}!",
       "seeBallots": "Abstimmungen ansehen",
       "verificationSuccess": "E-ID-Verifizierung erfolgreich!",
       "verificationFailed": "E-ID-Verifizierung fehlgeschlagen."
     },
     "common": {
       "loading": "Laden...",
       "error": "Fehler",
       "submit": "Absenden",
       "serverError": "Serverfehler — bitte versuchen Sie es spaeter erneut."
     }
   }
   ```

9. Replace hardcoded strings in each file:
   - **Server components**: `const t = await getTranslations('namespace')`
   - **Client components**: `const t = useTranslations('namespace')`
   - Example: `"Abstimmungen"` becomes `t('ballots.title')`

### Phase 4: Language Switcher & Polish

10. Add a locale switcher component to the nav/sidebar
11. Update `<Link>` imports to use `next-intl` navigation helpers (locale-aware links)
12. Handle API routes — these stay locale-unaware (no prefix needed)
13. Translate `en.json`, `fr.json`, `it.json` (can be done incrementally)

### Phase 5: Metadata & SEO

14. Localize `generateMetadata` in layout/page files
15. Add `alternate` hreflang tags for SEO

---

## File Changes Summary

| Action | Files |
|--------|-------|
| New files | `src/messages/{de,fr,it,en}.json`, `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/middleware.ts` |
| Move | `src/app/(auth)` -> `src/app/[locale]/(auth)`, same for `(app)`, `[slug]` |
| Modify | Every page/component with hardcoded text (~15 files), `next.config.ts`, root `layout.tsx`, `package.json` |
| No change | `src/components/ui/*` (shadcn), `src/lib/*` (business logic), API routes |

## Risks & Considerations

- **Route restructuring** is the biggest change — all internal links need updating
- **OAuth callback URLs** must remain locale-unaware or handle redirect properly
- **CMS content** (`[slug]` pages) — if Payload CMS already serves localized content, coordinate the locale
- **Incremental rollout** possible: start with `de` only, add translations later
