# मराठी टायपिंग – Smart Marathi Keyboard

**English मध्ये टाइप करा, मराठीत लिहा!**

Free, offline, no-sign-up Marathi transliteration web app. Type Marathi using English/Roman letters and instantly get correctly rendered Unicode Devanagari.

Example: `namaskar` → `नमस्कार`, `mala marathi yete` → `मला मराठी येते`

---

## Features

- Live Roman → Devanagari transliteration (word-by-word, cursor-safe)
- Candidate suggestions for ambiguous spellings (ळ/ल, ण/न, ड/द, final -a vs -aa, anusvara)
- Accept/reject via keyboard (Tab/↓, Shift+Tab/↑, Space, Esc) and mouse
- Preserves spaces, punctuation, numbers, paragraphs, newlines
- Marathi–English mixed typing (common English words stay in English)
- Marathi / English mode toggle + Auto-convert ON/OFF switch
- On-screen Devanagari keyboard (व्यंजने / स्वर / मात्रा / अंक / चिन्हे) + English keyboard
- Undo, Redo, Clear, Select-all
- Copy all / Copy selected
- Download Unicode TXT (with BOM for Windows Notepad)
- Download Marathi PDF with correct glyph shaping (Noto Sans Devanagari via browser shaping + jsPDF)
- Word / character / paragraph / line counts
- Autosave drafts in `localStorage` (no server)
- Mobile-friendly responsive UI, accessible keyboard navigation, Unicode NFC normalization

## Tech & Licensing (verified)

| Component | License | Notes |
|---|---|---|
| Transliteration engine | Custom, MIT-style (this repo) | Rule-based syllable parser + dictionary overrides. No paid API, fully offline, browser-local. Inspired by Google Input Tools / Dakshina principles. |
| `jspdf` | MIT | PDF generation |
| `html2canvas` | MIT | Renders Devanagari with browser text shaping → correct conjuncts/matras in PDF |
| `lucide-react` | ISC | Icons |
| React + Vite + Tailwind CSS | MIT | UI |

No mandatory backend. No registration. No paid API dependency.

## Project Structure

```
.
├── index.html                  # Title, meta, Google Fonts (Inter + Noto Sans Devanagari)
├── package.json
├── README.md                   # This file
├── src/
│   ├── main.tsx                # React entry
│   ├── App.tsx                 # Main app: editor, toolbar, suggestions, stats, examples, FAQ
│   ├── index.css               # Tailwind + fonts + scrollbar + print styles
│   ├── lib/
│   │   └── transliteration.ts  # Engine: dictionary (~700 words), phonetic parser, candidates, English preserve list
│   └── components/
│       └── OnScreenKeyboard.tsx# Devanagari + English on-screen keyboard
└── dist/                       # Build output (static)
```

## Installation & Deployment

### Prerequisites
- Node.js 18+ and npm

### Local development
```bash
npm install
npm run dev        # http://localhost:5173
```

### Production build
```bash
npm run build      # outputs dist/index.html (single-file static site)
npm run preview    # preview the build locally
```

### Deployment (static hosting)
The build is a single static `dist/index.html` — deploy anywhere:
- **Vercel / Netlify:** import repo, build command `npm run build`, output `dist`
- **GitHub Pages:** `npm run build` then publish `dist/` (e.g. via `gh-pages` or Actions)
- **Any static server:** serve `dist/` with `npx serve dist`

No environment variables or backend required.

## How Transliteration Works (cursor-safe)

- The editor is a single `<textarea>`. On each keystroke, only the **current Roman word** around the cursor (contiguous `A–Z` letters) is converted — the whole document is never rewritten.
- After conversion, the cursor is restored to `start + devanagari.length` via `requestAnimationFrame`, so editing in the middle, backspace, and selections remain stable.
- The current word's Roman form, start index, Devanagari form, and candidate list are stored. `Tab/↓` cycles candidates by replacing only that word's segment; `Esc` restores the Roman form; `Space/Enter` commits.
- Paste of Roman text is converted via `transliterateText()` which replaces only `[A-Za-z]+` tokens, preserving punctuation/numbers/newlines.
- Common English words (`the, is, hello, computer, …`) are preserved via an allow-list check before conversion.
- History (Undo/Redo) uses debounced snapshots + explicit snapshots for Clear/keyboard/paste, capped at 100 entries.

### Engine details
1. **Dictionary first** (~700 common Marathi words with best candidate first) for highest accuracy.
2. **Phonetic parser** for unknown words: tokenizes into consonants (`kh, gh, ch, jh, th, dh, ph, bh, sh, chh, ksh, gy…`) and vowels (`aa, ai, au, ee, ii, oo, a, i, u, e, o`), groups consonant clusters with halant (`्`) for conjuncts (e.g. `namaskar` → न + म + स्क + र), applies matras and independent vowels.
3. **Candidates** add variants for final `-a` → `ा`, `ळ/ल`, `ण/न`, `ड/द`, anusvara `ं`.

## PDF Export (correct shaping)

jsPDF alone does not shape Devanagari (matras/conjuncts break). This app:
1. Loads `Noto Sans Devanagari` via `document.fonts.load()`.
2. Renders text in a hidden A4-width div (browser does shaping).
3. Captures with `html2canvas` (scale 2) and embeds as JPEG pages in jsPDF (paginated for long documents).

Result: `क्ष, ज्ञ, त्र`, वेलांटी, उकार, अनुस्वार, विसर्ग all render correctly.

## Test Cases

### Marathi words
| Roman | Expected Devanagari | Result |
|---|---|---|
| `namaskar` | नमस्कार | ✅ |
| `maza` | माझा | ✅ |
| `bharat` | भारत | ✅ |
| `tumhi` | तुम्ही | ✅ |
| `kase` | कसे | ✅ |
| `aahat` | आहात | ✅ |
| `mala` | मला | ✅ |
| `marathi` | मराठी | ✅ |
| `yete` | येते | ✅ |
| `dhanyavad` | धन्यवाद | ✅ |
| `aani` | आणि | ✅ |
| `khup` | खूप | ✅ |
| `changla` | चांगला | ✅ |
| `hava` | हवा | ✅ |
| `prashna` | प्रश्न | ✅ (candidate: प्रश्ना) |
| `shikshan` | शिक्षण | ✅ (rule) |
| `mahiti` | माहिती | ✅ (rule) |

### Sentences
| Roman input | Expected |
|---|---|
| `namaskar mala marathi yete` | नमस्कार मला मराठी येते |
| `tumhi kase aahat` | तुम्ही कसे आहात |
| `maza bharat` | माझा भारत |
| `aaj hava khup chhan ahe` | आज हवा खूप छान आहे |

### Mixed-language & punctuation
| Input | Expected | Notes |
|---|---|---|
| `hello mala computer hava ahe` | `hello मला computer हवा आहे` | English preserved |
| `namaskar, mala marathi yete! tumhi kase aahat? 123` | `नमस्कार, मला मराठी येते! तुम्ही कसे आहात? 123` | Punctuation/numbers preserved |
| `kala` | candidates: कळा / कला | Ambiguous — Tab to choose |
| `pani` | candidates: पाणी / पनी | Ambiguous — Tab to choose |

### Manual UI tests
- Type `namaskar`, press `Tab` → cycles candidates; `Esc` → restores `namaskar`; `Space` → commits + new word.
- Place cursor mid-text, type Roman word → only that word converts, cursor stays correct.
- Paste `mala marathi yete` → converts on paste.
- Toggle Auto-convert OFF → Roman stays as typed.
- Toggle English mode → no conversion.
- Undo/Redo, Clear, Select-all, Copy all/selected, TXT download, PDF download (check conjuncts).
- Reload page → draft restored from localStorage.
- Mobile: toolbar wraps, keyboard usable, editor large.

## Accessibility & Performance

- Semantic landmarks, `aria-label` on editor, `aria-expanded` on FAQ, focus-visible states.
- No unnecessary animations; fast initial load (single-file build, dynamic import for PDF libs).
- Handles long documents (history capped, PDF paginated, debounced autosave).
- Tested on Chrome, Edge, Android Chrome (responsive layout).

## License

MIT — free to use, modify, and distribute. See source files for details.
