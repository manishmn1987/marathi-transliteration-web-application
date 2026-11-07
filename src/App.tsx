import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Undo2, Redo2, Trash2, Copy, FileText, FileDown, Keyboard, Check, X,
  BookOpen, ClipboardCopy, Type, Languages,
  ShieldCheck, Zap, Globe, Search, Volume2, VolumeX,
  Mic, MicOff, Plus, BookmarkPlus, Hash, ZoomIn, ZoomOut,
  FileType, PenTool, HelpCircle,
} from "lucide-react";
import {
  getCandidates, transliterateText, normalizeMarathi, MARATHI_DICT,
  getCustomDictionary, addCustomWord, removeCustomWord,
  convertNumbersToMarathi, convertNumbersToEnglish,
} from "./lib/transliteration";
import { PHONETIC_CHART } from "./lib/marathiData";
import OnScreenKeyboard from "./components/OnScreenKeyboard";

function AppLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} shrink-0 drop-shadow-xs`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="marathiAppGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#marathiAppGrad)" />
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="13"
        fill="none"
        stroke="#fbbf24"
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      <text
        x="29"
        y="46"
        textAnchor="middle"
        fontFamily="Noto Sans Devanagari, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill="#ffffff"
      >
        अ
      </text>
      <circle cx="50" cy="15" r="7.5" fill="#fbbf24" />
      <path
        d="M47 15h6M50 12v6"
        stroke="#14532d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Mode = "marathi" | "english";
type AppPage = "editor" | "guide";

type CandidateState = {
  roman: string;
  start: number;
  candidates: string[];
  index: number;
};

const EXAMPLES: { roman: string; devanagari: string; label: string }[] = [
  { roman: "namaskar", devanagari: "नमस्कार", label: "Greeting" },
  { roman: "maza bharat", devanagari: "माझा भारत", label: "My India" },
  { roman: "tumhi kase aahat", devanagari: "तुम्ही कसे आहात", label: "How are you?" },
  { roman: "mala marathi yete", devanagari: "मला मराठी येते", label: "I know Marathi" },
  { roman: "tumchya madatibaddal dhanyavad", devanagari: "तुमच्या मदतीबद्दल धन्यवाद", label: "Thank you" },
  { roman: "aaj hava khup chhan ahe", devanagari: "आज हवा खूप छान आहे", label: "Weather" },
  { roman: "mi shalet jato aani lihito", devanagari: "मी शाळेत जातो आणि लिहितो", label: "Daily routine" },
  { roman: "maharashtrachi sanskruti khup sundar ahe", devanagari: "महाराष्ट्राची संस्कृती खूप सुंदर आहे", label: "Culture" },
];

const SHORTCUTS = [
  { keys: "1–7", action: "क्रमांकाचा पर्याय थेट निवडा (Select candidate by number)" },
  { keys: "Tab / ↓", action: "पुढचा पर्याय निवडा (Next suggestion)" },
  { keys: "Shift+Tab / ↑", action: "मागचा पर्याय निवडा (Previous suggestion)" },
  { keys: "Space", action: "पर्याय निश्चित करा व नवीन शब्द सुरू करा (Accept & new word)" },
  { keys: "Esc", action: "रूपांतर रद्द करा — मूळ Roman शब्द ठेवा (Keep Roman)" },
  { keys: "Ctrl+Z / Ctrl+Y", action: "मागील बदल रद्द करा / पुन्हा करा (Undo / Redo)" },
  { keys: "Ctrl+F", action: "मजकुरात शब्द शोधा व बदला (Find & Replace)" },
  { keys: "Ctrl+C / Ctrl+V", action: "Copy / Paste (पेस्ट केलेला मजकूर आपोआप मराठीत होतो)" },
];

function parseHashToPage(): AppPage {
  if (typeof window === "undefined") return "editor";
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (h === "guide") return "guide";
  return "editor";
}

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>(() => parseHashToPage());

  const navigateTo = useCallback((page: AppPage) => {
    setActivePage(page);
    try {
      window.location.hash = page === "editor" ? "#/" : `#/${page}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }, []);

  useEffect(() => {
    const onHashChange = () => setActivePage(parseHashToPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [text, setText] = useState<string>(() => {
    try {
      return localStorage.getItem("marathi-typing-draft") ?? "";
    } catch {
      return "";
    }
  });
  const [mode, setMode] = useState<Mode>("marathi");
  const [autoConvert, setAutoConvert] = useState(true);
  const [candidate, setCandidate] = useState<CandidateState | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem("marathi-typing-fontsize"));
      return saved >= 16 && saved <= 34 ? saved : 22;
    } catch {
      return 22;
    }
  });
  const [toast, setToast] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");

  // Speech & Voice state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Custom Dictionary state (for user-saved words via "+ जतन करा")
  const [customDict, setCustomDict] = useState<Record<string, string>>(() => getCustomDictionary());
  const [newRomanWord, setNewRomanWord] = useState("");
  const [newMarathiWord, setNewMarathiWord] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const lastSnapshotRef = useRef<string>(text);
  const [historyVersion, setHistoryVersion] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("marathi-typing-fontsize", String(fontSize));
    } catch {}
  }, [fontSize]);

  // Autosave + history snapshot (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem("marathi-typing-draft", text);
        setSavedAt(new Date());
      } catch {}
      if (text !== lastSnapshotRef.current) {
        pastRef.current.push(lastSnapshotRef.current);
        if (pastRef.current.length > 100) pastRef.current.shift();
        futureRef.current = [];
        lastSnapshotRef.current = text;
        setHistoryVersion((v) => v + 1);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [text]);

  const recordHistory = useCallback((prev: string) => {
    if (prev === lastSnapshotRef.current && pastRef.current[pastRef.current.length - 1] === prev) return;
    pastRef.current.push(prev);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    lastSnapshotRef.current = prev;
    setHistoryVersion((v) => v + 1);
  }, []);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const setTextAndCursor = useCallback((newText: string, cursor: number) => {
    setText(newText);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        try {
          ta.setSelectionRange(cursor, cursor);
        } catch {}
      }
    });
  }, []);

  const commitCandidate = useCallback(
    (delimiter: string = " ", candidateIdx?: number) => {
      if (!candidate) return false;
      const ta = textareaRef.current;
      const curText = ta ? ta.value : text;

      const actualWord = curText.slice(candidate.start, candidate.start + candidate.roman.length);
      if (actualWord.toLowerCase() !== candidate.roman.toLowerCase()) {
        setCandidate(null);
        return false;
      }

      const idx = candidateIdx ?? candidate.index;
      const replacement = candidate.candidates[idx] ?? candidate.roman;

      const before = curText.slice(0, candidate.start);
      const after = curText.slice(candidate.start + candidate.roman.length);
      const newText = before + replacement + delimiter + after;
      const newCursor = candidate.start + replacement.length + delimiter.length;

      recordHistory(curText);
      setTextAndCursor(newText, newCursor);
      setCandidate(null);
      return true;
    },
    [candidate, text, recordHistory, setTextAndCursor]
  );

  const selectCandidate = useCallback(
    (idx: number) => {
      commitCandidate(" ", idx);
    },
    [commitCandidate]
  );

  const saveCurrentCandidateToDict = useCallback(() => {
    if (!candidate) return;
    const chosen = candidate.candidates[candidate.index] ?? candidate.roman;
    const updated = addCustomWord(candidate.roman, chosen);
    setCustomDict(updated);
    commitCandidate(" ", candidate.index);
    showToast(`वैयक्तिक शब्दकोशात जतन केले: ${candidate.roman} → ${chosen}`);
  }, [candidate, commitCandidate, showToast]);

  const cycleCandidate = useCallback(
    (delta: number) => {
      if (!candidate) return;
      const len = candidate.candidates.length;
      const next = (candidate.index + delta + len) % len;
      setCandidate({ ...candidate, index: next });
      focusEditor();
    },
    [candidate, focusEditor]
  );

  const revertToRoman = useCallback(() => {
    if (!candidate) return;
    const ta = textareaRef.current;
    const curText = ta ? ta.value : text;
    const end = candidate.start + candidate.roman.length;
    const newText = curText.slice(0, end) + " " + curText.slice(end);
    setCandidate(null);
    setTextAndCursor(newText, end + 1);
  }, [candidate, text, setTextAndCursor]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const cursor = e.target.selectionStart ?? newVal.length;

    if (mode !== "marathi" || !autoConvert) {
      setText(newVal);
      setCandidate(null);
      return;
    }

    if (cursor > 0) {
      const justTyped = newVal[cursor - 1];
      const isDelimiter = /[\s.,!?;:'"()\-—/\\[\]{}]/.test(justTyped);
      if (isDelimiter) {
        const beforeDelim = newVal.slice(0, cursor - 1);
        const m = beforeDelim.match(/([a-zA-Z]+)$/);
        if (m) {
          const romanWord = m[1];
          const wordStart = (cursor - 1) - romanWord.length;
          const cands = getCandidates(romanWord).candidates;
          const chosen =
            candidate && candidate.roman.toLowerCase() === romanWord.toLowerCase()
              ? (candidate.candidates[candidate.index] ?? cands[0] ?? romanWord)
              : (cands[0] ?? romanWord);

          const afterDelim = newVal.slice(cursor);
          const replaced = newVal.slice(0, wordStart) + chosen + justTyped + afterDelim;
          const newCursor = wordStart + chosen.length + 1;
          recordHistory(text);
          setTextAndCursor(replaced, newCursor);
          setCandidate(null);
          return;
        }
      }
    }

    setText(newVal);

    const before = newVal.slice(0, cursor);
    const match = before.match(/([a-zA-Z]+)$/);
    if (match) {
      const roman = match[1];
      const start = cursor - roman.length;
      const { candidates } = getCandidates(roman);
      setCandidate({ roman, start, candidates, index: 0 });
    } else {
      setCandidate(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        doRedo();
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowFindReplace((v) => !v);
        return;
      }
    }

    if (!candidate || mode !== "marathi" || !autoConvert) return;

    if (e.key === " ") {
      e.preventDefault();
      commitCandidate(" ");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitCandidate("\n");
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      cycleCandidate(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cycleCandidate(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      cycleCandidate(-1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      revertToRoman();
      return;
    }
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < candidate.candidates.length) {
        e.preventDefault();
        commitCandidate(" ", idx);
        return;
      }
    }
    if (/^[.,!?;:]$/.test(e.key)) {
      e.preventDefault();
      commitCandidate(e.key + " ");
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (mode !== "marathi" || !autoConvert) return;
    const pasted = e.clipboardData.getData("text/plain");
    if (!pasted) return;
    if (/[a-zA-Z]/.test(pasted)) {
      e.preventDefault();
      const converted = transliterateText(pasted);
      insertAtCursor(converted);
    }
  };

  const insertAtCursor = useCallback(
    (snippet: string) => {
      const ta = textareaRef.current;
      let baseText = ta ? ta.value : text;
      let start = ta ? (ta.selectionStart ?? baseText.length) : baseText.length;
      let end = ta ? (ta.selectionEnd ?? baseText.length) : baseText.length;

      if (candidate && mode === "marathi" && autoConvert) {
        const chosen = candidate.candidates[candidate.index] ?? candidate.roman;
        const cEnd = candidate.start + candidate.roman.length;
        if ( baseText.slice(candidate.start, cEnd).toLowerCase() === candidate.roman.toLowerCase() ) {
          const isCombiningMark = /^[ािीुूृेैोौंःँॅॉ्]/.test(snippet);
          const sep = isCombiningMark ? "" : " ";
          baseText = baseText.slice(0, candidate.start) + chosen + sep + baseText.slice(cEnd);
          const delta = (chosen.length + sep.length) - candidate.roman.length;
          start += delta;
          end += delta;
        }
        setCandidate(null);
      }

      const next = baseText.slice(0, start) + snippet + baseText.slice(end);
      recordHistory(text);
      setTextAndCursor(next, start + snippet.length);
    },
    [text, candidate, mode, autoConvert, recordHistory, setTextAndCursor]
  );

  const backspaceAtCursor = useCallback(() => {
    const ta = textareaRef.current;
    const baseText = ta ? ta.value : text;
    const start = ta ? (ta.selectionStart ?? baseText.length) : baseText.length;
    const end = ta ? (ta.selectionEnd ?? baseText.length) : baseText.length;
    if (start !== end) {
      const next = baseText.slice(0, start) + baseText.slice(end);
      setTextAndCursor(next, start);
      setCandidate(null);
      return;
    }
    if (start === 0) return;
    const next = baseText.slice(0, start - 1) + baseText.slice(end);
    setTextAndCursor(next, start - 1);
    setCandidate(null);
  }, [text, setTextAndCursor]);

  const doUndo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current.pop()!;
    futureRef.current.push(text);
    lastSnapshotRef.current = prev;
    setText(prev);
    setCandidate(null);
    setHistoryVersion((v) => v + 1);
    focusEditor();
  }, [text, focusEditor]);

  const doRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push(text);
    lastSnapshotRef.current = next;
    setText(next);
    setCandidate(null);
    setHistoryVersion((v) => v + 1);
    focusEditor();
  }, [text, focusEditor]);

  const doClear = useCallback(() => {
    if (!text) return;
    recordHistory(text);
    setText("");
    setCandidate(null);
    showToast("मजकूर साफ केला (Cleared)");
    focusEditor();
  }, [text, recordHistory, showToast, focusEditor]);

  const doSelectAll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  const getCommittedText = useCallback(() => {
    if (candidate && mode === "marathi" && autoConvert) {
      const cEnd = candidate.start + candidate.roman.length;
      if (text.slice(candidate.start, cEnd).toLowerCase() === candidate.roman.toLowerCase()) {
        const chosen = candidate.candidates[candidate.index] ?? candidate.roman;
        return text.slice(0, candidate.start) + chosen + text.slice(cEnd);
      }
    }
    return text;
  }, [text, candidate, mode, autoConvert]);

  // Convert numbers between English (123) and Marathi (१२३)
  const toggleMarathiNumbers = useCallback(() => {
    const full = getCommittedText();
    if (!full) {
      showToast("अंक बदलण्यासाठी आधी मजकूर लिहा");
      return;
    }
    const hasAsciiDigits = /[0-9]/.test(full);
    const converted = hasAsciiDigits ? convertNumbersToMarathi(full) : convertNumbersToEnglish(full);
    if (converted === full) {
      showToast("मजकुरात कोणतेही अंक (0-9 / ०-९) आढळले नाहीत");
      return;
    }
    recordHistory(text);
    setText(converted);
    setCandidate(null);
    showToast(hasAsciiDigits ? "सर्व अंक मराठीत (०-९) केले!" : "सर्व अंक इंग्रजीत (0-9) केले!");
  }, [getCommittedText, recordHistory, text, showToast]);

  // Find & Replace operations
  const matchCount = useMemo(() => {
    if (!findQuery) return 0;
    const full = getCommittedText();
    return full.split(findQuery).length - 1;
  }, [findQuery, getCommittedText]);

  const handleFindNext = useCallback(() => {
    if (!findQuery || !textareaRef.current) return;
    const ta = textareaRef.current;
    const curPos = ta.selectionEnd ?? 0;
    let idx = text.indexOf(findQuery, curPos);
    if (idx === -1) idx = text.indexOf(findQuery, 0);
    if (idx !== -1) {
      ta.focus();
      ta.setSelectionRange(idx, idx + findQuery.length);
    } else {
      showToast(`'${findQuery}' सापडले नाही`);
    }
  }, [findQuery, text, showToast]);

  const handleReplaceOne = useCallback(() => {
    if (!findQuery) return;
    const full = getCommittedText();
    const idx = full.indexOf(findQuery);
    if (idx === -1) {
      showToast(`'${findQuery}' सापडले नाही`);
      return;
    }
    const updated = full.slice(0, idx) + replaceQuery + full.slice(idx + findQuery.length);
    recordHistory(text);
    setTextAndCursor(updated, idx + replaceQuery.length);
    setCandidate(null);
    showToast("एक शब्द बदलला (Replaced 1 occurrence)");
  }, [findQuery, replaceQuery, getCommittedText, recordHistory, text, setTextAndCursor, showToast]);

  const handleReplaceAll = useCallback(() => {
    if (!findQuery) return;
    const full = getCommittedText();
    const count = full.split(findQuery).length - 1;
    if (count === 0) {
      showToast(`'${findQuery}' सापडले नाही`);
      return;
    }
    const updated = full.split(findQuery).join(replaceQuery);
    recordHistory(text);
    setText(updated);
    setCandidate(null);
    showToast(`एकूण ${count} ठिकाणी बदल केला (Replaced ${count})`);
  }, [findQuery, replaceQuery, getCommittedText, recordHistory, text, showToast]);

  // Text-to-Speech (Listen in Marathi)
  const speakMarathiText = useCallback(
    (customText?: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        showToast("तुमच्या ब्राउझरमध्ये आवाज सुविधा उपलब्ध नाही");
        return;
      }
      if (isSpeaking && !customText) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      const full = (customText ?? getCommittedText()).trim();
      if (!full) {
        showToast("ऐकण्यासाठी आधी मराठी मजकूर टाइप करा");
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(full);
      const voices = window.speechSynthesis.getVoices();
      const mrVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith("mr")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
        voices.find((v) => v.lang.toLowerCase().includes("in"));
      if (mrVoice) utter.voice = mrVoice;
      utter.lang = mrVoice?.lang || "mr-IN";
      utter.rate = 0.95;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    [isSpeaking, getCommittedText, showToast]
  );

  // Speech-to-Text (Marathi Voice Dictation)
  const toggleDictation = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast("आवाजाने टायपिंगसाठी कृपया Chrome किंवा Edge ब्राउझर वापरा");
      return;
    }
    const rec = new SpeechRec();
    rec.lang = mode === "marathi" ? "mr-IN" : "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => {
      setIsListening(true);
      showToast("आता मराठीत बोला… (Listening in Marathi)");
    };
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        const sep = text && !/\s$/.test(text) ? " " : "";
        const nextText = text + sep + transcript + " ";
        recordHistory(text);
        setTextAndCursor(nextText, nextText.length);
        showToast(`आवाजाने टाइप झाले: "${transcript}"`);
      }
    };
    rec.onerror = () => {
      setIsListening(false);
      showToast("आवाज ओळखता आला नाही — पुन्हा प्रयत्न करा");
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  }, [isListening, mode, text, recordHistory, setTextAndCursor, showToast]);

  const copyText = useCallback(
    async (value: string, label: string) => {
      if (!value) {
        showToast("कॉपी करण्यासाठी मजकूर नाही");
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        showToast(label);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(label);
      }
    },
    [showToast]
  );

  const copyAll = useCallback(() => copyText(getCommittedText(), "सर्व मजकूर कॉपी झाला (Copied all)"), [copyText, getCommittedText]);
  const copySelected = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? 0;
    const e = ta.selectionEnd ?? 0;
    const sel = text.slice(s, e);
    if (!sel) {
      showToast("आधी मजकूर निवडा (Select text first)");
      return;
    }
    copyText(sel, "निवडलेला मजकूर कॉपी झाला (Copied selected)");
  }, [copyText, text, showToast]);

  const downloadTXT = useCallback(
    (contentOverride?: string, filename: string = "marathi-lekhan.txt") => {
      const fullText = contentOverride ?? getCommittedText();
      if (!fullText.trim()) {
        showToast("डाउनलोड करण्यासाठी मजकूर नाही");
        return;
      }
      const normalized = normalizeMarathi(fullText);
      const blob = new Blob(["\uFEFF" + normalized], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("TXT फाइल डाउनलोड झाली (TXT downloaded)");
    },
    [getCommittedText, showToast]
  );

  const downloadDOC = useCallback(
    (contentOverride?: string, filename: string = "marathi-lekhan.doc") => {
      const fullText = contentOverride ?? getCommittedText();
      if (!fullText.trim()) {
        showToast("Word फाइलसाठी मजकूर नाही");
        return;
      }
      const escaped = normalizeMarathi(fullText)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:"Noto Sans Devanagari","Mangal","Nirmala UI",sans-serif;font-size:14pt;line-height:1.8;padding:24pt;}</style></head><body>${escaped}</body></html>`;
      const blob = new Blob(["\uFEFF", htmlDoc], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Word (.doc) फाइल डाउनलोड झाली");
    },
    [getCommittedText, showToast]
  );

  const downloadPDF = useCallback(
    async (contentOverride?: string) => {
      const fullText = contentOverride ?? getCommittedText();
      if (!fullText.trim()) {
        showToast("PDF साठी मजकूर नाही");
        return;
      }
      setPdfBusy(true);
      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: html2canvas } = await import("html2canvas");
        try {
          await document.fonts.load('16px "Noto Sans Devanagari"');
          await document.fonts.ready;
        } catch {}

        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "0";
        container.style.width = "794px";
        container.style.background = "#ffffff";
        container.style.padding = "48px";
        container.style.fontFamily = '"Noto Sans Devanagari", sans-serif';
        container.style.fontSize = "18px";
        container.style.lineHeight = "1.9";
        container.style.color = "#111827";
        container.style.whiteSpace = "pre-wrap";
        container.style.wordBreak = "break-word";
        container.textContent = normalizeMarathi(fullText);
        document.body.appendChild(container);

        const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
        document.body.removeChild(container);

        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgW = pageW;
        const imgH = (canvas.height * imgW) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (imgH <= pageH) {
          pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
        } else {
          const pageHeightPx = Math.floor((pageH * canvas.width) / pageW);
          let rendered = 0;
          let page = 0;
          while (rendered < canvas.height) {
            const h = Math.min(pageHeightPx, canvas.height - rendered);
            const pageCanvas = document.createElement("canvas");
            pageCanvas.width = canvas.width;
            pageCanvas.height = h;
            const ctx = pageCanvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
              ctx.drawImage(canvas, 0, rendered, canvas.width, h, 0, 0, canvas.width, h);
            }
            const pageImg = pageCanvas.toDataURL("image/jpeg", 0.92);
            if (page > 0) pdf.addPage();
            pdf.addImage(pageImg, "JPEG", 0, 0, imgW, (h * imgW) / canvas.width);
            rendered += h;
            page++;
          }
        }
        pdf.save("marathi-lekhan.pdf");
        showToast("PDF फाइल डाउनलोड झाली (PDF downloaded)");
      } catch (err) {
        console.error(err);
        showToast("PDF तयार करताना त्रुटी — TXT किंवा Word वापरून पहा");
      } finally {
        setPdfBusy(false);
      }
    },
    [getCommittedText, showToast]
  );

  const insertPhraseAndOpenEditor = useCallback(
    (devanagari: string, label?: string) => {
      const sep = text && !/\s$/.test(text) ? " " : "";
      const nextText = text + sep + devanagari;
      recordHistory(text);
      setText(nextText);
      setCandidate(null);
      navigateTo("editor");
      showToast(label ? `एडिटरमध्ये जोडले: ${label}` : `एडिटरमध्ये जोडले: ${devanagari}`);
      focusEditor();
    },
    [text, recordHistory, navigateTo, showToast, focusEditor]
  );

  const handleAddCustomWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rom = newRomanWord.trim().toLowerCase().replace(/[^a-z]/g, "");
    const mar = newMarathiWord.trim();
    if (!rom || !mar) {
      showToast("कृपया Roman शब्द आणि त्याचा मराठी शब्द दोन्ही भरा");
      return;
    }
    const next = addCustomWord(rom, mar);
    setCustomDict(next);
    setNewRomanWord("");
    setNewMarathiWord("");
    showToast(`वैयक्तिक शब्दकोशात जोडले: ${rom} → ${mar}`);
  };

  const handleDeleteCustomWord = (rom: string) => {
    const next = removeCustomWord(rom);
    setCustomDict(next);
    showToast(`शब्द हटवला: ${rom}`);
  };

  const stats = useMemo(() => {
    const fullText = getCommittedText();
    const trimmed = fullText.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = fullText.length;
    const charsNoSpace = fullText.replace(/\s/g, "").length;
    const paragraphs = fullText.trim() ? fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length : 0;
    const lines = fullText ? fullText.split("\n").length : 0;
    return { words, chars, charsNoSpace, paragraphs, lines };
  }, [getCommittedText]);

  const totalDictCount = useMemo(() => Object.keys(MARATHI_DICT).length + Object.keys(customDict).length, [customDict]);

  void historyVersion;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/40 text-gray-900">
      {/* Ultra-Clean, Lightweight Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => navigateTo("editor")}
            className="flex shrink-0 items-center gap-2.5 text-left"
          >
            <AppLogo className="h-9 w-9" />
            <span className="leading-tight">
              <span className="block text-base sm:text-lg font-extrabold tracking-tight text-gray-900 font-devanagari">
                मराठी टायपिंग
              </span>
              <span className="hidden sm:block text-[11px] text-gray-500">
                Smart Marathi Transliteration
              </span>
            </span>
          </button>

          {/* Minimal 2-Tab Navigation: लेखन | मदत */}
          <nav
            aria-label="Main Navigation"
            className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100/80 p-1 font-devanagari"
          >
            <button
              type="button"
              onClick={() => navigateTo("editor")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition ${
                activePage === "editor"
                  ? "bg-green-800 text-white shadow-xs"
                  : "text-gray-700 hover:bg-white hover:text-green-800"
              }`}
            >
              <PenTool className="h-4 w-4" />
              <span>लेखन</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo("guide")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition ${
                activePage === "guide"
                  ? "bg-green-800 text-white shadow-xs"
                  : "text-gray-700 hover:bg-white hover:text-green-800"
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              <span>मदत व तक्ता</span>
            </button>
          </nav>

          <div className="hidden sm:flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-800 font-devanagari">
              <ShieldCheck className="h-3.5 w-3.5" /> १००% ऑफलाइन
            </span>
          </div>
        </div>
      </header>

      {/* ==================== PAGE 1: CLEAN MARATHI EDITOR ==================== */}
      {activePage === "editor" && (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xs">
            {/* Toolbar */}
            <div className="flex flex-col gap-2.5 border-b border-gray-200 bg-gray-50/80 px-4 py-3 sm:px-5">
              {/* Row 1: Mode, Auto-convert, Font size, Digit convert, Find, Undo/Redo/Clear */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-full border border-gray-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setMode("marathi")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs sm:text-sm font-semibold transition font-devanagari ${
                      mode === "marathi" ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
                    }`}
                  >
                    <Languages className="h-3.5 w-3.5" /> मराठी
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("english")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs sm:text-sm font-semibold transition ${
                      mode === "english" ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
                    }`}
                  >
                    <Type className="h-3.5 w-3.5" /> English
                  </button>
                </div>

                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs sm:text-sm font-medium text-gray-700">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoConvert}
                    onClick={() => setAutoConvert((v) => !v)}
                    className={`relative h-5 w-9 rounded-full transition ${autoConvert ? "bg-green-800" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${autoConvert ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <span>Auto {autoConvert ? "ON" : "OFF"}</span>
                </label>

                {/* Font size controls */}
                <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-700">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(16, s - 2))}
                    title="फॉन्ट लहान करा (Decrease font size)"
                    className="rounded-full p-1 hover:bg-gray-100"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1.5 text-gray-600">{fontSize}px</span>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(34, s + 2))}
                    title="फॉन्ट मोठा करा (Increase font size)"
                    className="rounded-full p-1 hover:bg-gray-100"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 123 <-> १२३ Digit Converter */}
                <button
                  type="button"
                  onClick={toggleMarathiNumbers}
                  title="इंग्रजी व मराठी अंकांचे रूपांतर करा (Convert 123 ↔ १२३)"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs sm:text-sm font-semibold text-gray-700 hover:border-green-300 hover:text-green-800 font-devanagari"
                >
                  <Hash className="h-3.5 w-3.5" /> 123 ↔ १२३
                </button>

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowFindReplace((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs sm:text-sm font-medium transition font-devanagari ${
                      showFindReplace ? "border-green-800 bg-green-50 text-green-900" : "border-gray-200 bg-white text-gray-700 hover:border-green-300"
                    }`}
                  >
                    <Search className="h-3.5 w-3.5" /> शोधा
                  </button>
                  <button type="button" onClick={doUndo} disabled={pastRef.current.length === 0} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs sm:text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800 disabled:opacity-40">
                    <Undo2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Undo</span>
                  </button>
                  <button type="button" onClick={doRedo} disabled={futureRef.current.length === 0} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs sm:text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800 disabled:opacity-40">
                    <Redo2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Redo</span>
                  </button>
                  <button type="button" onClick={doSelectAll} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs sm:text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800">
                    <Copy className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Select all</span>
                  </button>
                  <button type="button" onClick={doClear} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs sm:text-sm font-medium text-red-700 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Copy, Export (TXT, Word, PDF), Speak, Dictate, Keyboard toggle */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-green-900">
                  <ClipboardCopy className="h-3.5 w-3.5" /> Copy all
                </button>
                <button type="button" onClick={copySelected} className="inline-flex items-center gap-1.5 rounded-full border border-green-800 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-green-800 hover:bg-green-50">
                  <Copy className="h-3.5 w-3.5" /> Copy selected
                </button>
                <button type="button" onClick={() => downloadTXT()} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800">
                  <FileText className="h-3.5 w-3.5" /> TXT
                </button>
                <button type="button" onClick={() => downloadDOC()} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800">
                  <FileType className="h-3.5 w-3.5" /> Word
                </button>
                <button type="button" onClick={() => downloadPDF()} disabled={pdfBusy} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800 disabled:opacity-50">
                  <FileDown className="h-3.5 w-3.5" /> {pdfBusy ? "PDF…" : "PDF"}
                </button>

                {/* Listen (Text-to-Speech) */}
                <button
                  type="button"
                  onClick={() => speakMarathiText()}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition font-devanagari ${
                    isSpeaking
                      ? "border-amber-600 bg-amber-500 text-white"
                      : "border-gray-300 bg-white text-gray-800 hover:border-green-300 hover:text-green-800"
                  }`}
                >
                  {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {isSpeaking ? "थांबवा" : "उच्चार ऐका"}
                </button>

                {/* Voice Dictation */}
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition font-devanagari ${
                    isListening
                      ? "border-red-600 bg-red-600 text-white animate-pulse"
                      : "border-gray-300 bg-white text-gray-800 hover:border-green-300 hover:text-green-800"
                  }`}
                >
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isListening ? "ऐकत आहे…" : "आवाज टायपिंग"}
                </button>

                {/* On-screen Keyboard toggle */}
                <button
                  type="button"
                  onClick={() => setShowKeyboard((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold font-devanagari ${
                    showKeyboard ? "border-green-800 bg-green-800 text-white" : "border-gray-300 bg-white text-gray-800 hover:border-green-300"
                  }`}
                >
                  <Keyboard className="h-3.5 w-3.5" /> कीबोर्ड {showKeyboard ? "ON" : "OFF"}
                </button>

                <span className="ml-auto hidden items-center gap-1 text-xs text-gray-400 xl:inline-flex font-devanagari">
                  <Zap className="h-3.5 w-3.5" /> स्वयंचलित जतन {savedAt ? `• ${savedAt.toLocaleTimeString("mr-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              </div>

              {/* Optional Find & Replace Bar */}
              {showFindReplace && (
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded-2xl border border-green-200 bg-white p-2.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={findQuery}
                      onChange={(e) => setFindQuery(e.target.value)}
                      placeholder="काय शोधायचे? (Find)"
                      className="w-36 sm:w-44 rounded-lg border border-gray-200 px-2.5 py-1 text-sm outline-none focus:border-green-600 font-devanagari"
                    />
                    {findQuery && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">
                        {matchCount} सापडले
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      placeholder="याने बदला (Replace with)"
                      className="w-36 sm:w-44 rounded-lg border border-gray-200 px-2.5 py-1 text-sm outline-none focus:border-green-600 font-devanagari"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 font-devanagari">
                    <button
                      type="button"
                      onClick={handleFindNext}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-800"
                    >
                      पुढील शोधा
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceOne}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-800"
                    >
                      एक बदला
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceAll}
                      className="rounded-lg bg-green-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-900"
                    >
                      सर्व बदला
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFindReplace(false)}
                      className="ml-1 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Textarea with Zero-Shift Floating Suggestions Bar */}
            <div className="relative">
              {candidate && (
                <div className="absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-2 border-b border-green-200 bg-green-50/95 px-4 sm:px-5 overflow-x-auto overflow-y-hidden whitespace-nowrap backdrop-blur">
                  <div className="flex shrink-0 items-center gap-1.5 text-sm">
                    <span className="rounded-full bg-white border border-green-300 px-2.5 py-0.5 font-mono text-xs font-bold text-green-900">
                      {candidate.roman}
                    </span>
                    <span className="text-gray-400">→</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {candidate.candidates.map((c, i) => (
                      <button
                        key={c + i}
                        type="button"
                        onClick={() => selectCandidate(i)}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm sm:text-base font-medium transition font-devanagari ${
                          i === candidate.index
                            ? "border-green-800 bg-green-800 text-white shadow-xs"
                            : "border-gray-200 bg-white text-gray-800 hover:border-green-300 hover:bg-green-50"
                        }`}
                        title={i < 9 ? `${i + 1} दाबा किंवा क्लिक करा` : "क्लिक करा"}
                      >
                        {i < 9 && (
                          <span className={`text-xs ${i === candidate.index ? "text-green-200" : "text-gray-400"}`}>
                            {i + 1}.
                          </span>
                        )}
                        <span>{c}</span>
                        {i === candidate.index && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={revertToRoman}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-red-200 hover:text-red-700"
                      title="Esc दाबा"
                    >
                      <X className="h-3 w-3" /> Roman (Esc)
                    </button>
                    <button
                      type="button"
                      onClick={saveCurrentCandidateToDict}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-300 bg-white px-2.5 py-1 text-xs font-semibold text-green-800 hover:bg-green-100 font-devanagari"
                      title="निवडलेला पर्याय तुमच्या शब्दकोशात कायमचा जतन करा"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" /> जतन करा
                    </button>
                  </div>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                style={{ fontSize: `${fontSize}px` }}
                placeholder={"इथे मराठीत टाइप करा (Type in English letters, e.g. namaskar, maharashtrachi sanskruti)…"}
                className="editor-scroll min-h-[380px] w-full resize-y bg-white px-5 pt-14 pb-5 leading-[1.9] text-gray-900 outline-none placeholder:text-base placeholder:leading-relaxed placeholder:text-gray-400 sm:min-h-[440px] font-devanagari"
                aria-label="Marathi typing editor"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs font-medium text-gray-600 sm:px-5 sm:text-sm font-devanagari">
              <span>शब्द: <strong className="text-gray-900">{stats.words}</strong></span>
              <span>अक्षरे: <strong className="text-gray-900">{stats.chars}</strong> <span className="text-gray-400">({stats.charsNoSpace} स्पेसशिवाय)</span></span>
              <span>परिच्छेद: <strong className="text-gray-900">{stats.paragraphs}</strong></span>
              <span>ओळी: <strong className="text-gray-900">{stats.lines}</strong></span>
              <span className="ml-auto hidden items-center gap-1 text-gray-400 sm:inline-flex">
                <Globe className="h-3.5 w-3.5" /> Space किंवा 1–7 पर्याय निवडण्यासाठी • Esc मूळ शब्दासाठी
              </span>
            </div>
          </div>

          {/* Toggleable On-Screen Keyboard */}
          {showKeyboard && (
            <div className="mt-4">
              <OnScreenKeyboard
                mode={mode}
                onInsert={(s) => insertAtCursor(s)}
                onBackspace={backspaceAtCursor}
                onEnter={() => {
                  if (candidate) commitCandidate("\n");
                  else insertAtCursor("\n");
                }}
                onSpace={() => {
                  if (candidate) commitCandidate(" ");
                  else insertAtCursor(" ");
                }}
              />
            </div>
          )}
        </main>
      )}

      {/* ==================== PAGE 2: TYPING GUIDE & PHONETIC REFERENCE ==================== */}
      {activePage === "guide" && (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 font-devanagari">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              मराठी फोनेटिक टायपिंग तक्ता व मदत (Typing Guide & Key Map)
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              इंग्रजी (Roman) अक्षरांतून अचूक देवनागरी मराठी कशी टाइप करावी याचा संपूर्ण तक्ता आणि कीबोर्ड शॉर्टकट्स.
            </p>
          </div>

          {/* Phonetic Chart Grid */}
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            {/* Vowels & Matras */}
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="text-lg font-bold text-gray-900">१. स्वर आणि मात्रा (Vowels & Matras)</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PHONETIC_CHART.vowels.map((v) => (
                  <div key={v.roman} className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2">
                    <span className="font-mono text-xs font-bold text-green-800">{v.roman}</span>
                    <p className="mt-0.5 text-base font-bold text-gray-900">{v.dev}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Consonants & Conjuncts */}
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="text-lg font-bold text-gray-900">२. व्यंजने आणि जोडाक्षरे (Consonants & Conjuncts)</h2>
              <div className="mt-3 space-y-2">
                {PHONETIC_CHART.consonants.map((c) => (
                  <div key={c.roman} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2">
                    <span className="font-mono text-xs font-bold text-green-800">{c.roman}</span>
                    <span className="text-base font-bold text-gray-900">{c.dev}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Special Words & Shortcuts */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <BookOpen className="h-5 w-5 text-green-800" /> महत्त्वाची उदाहरणे (Click to Try in Editor)
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {PHONETIC_CHART.specialExamples.map((ex) => (
                  <button
                    key={ex.roman}
                    type="button"
                    onClick={() => insertPhraseAndOpenEditor(ex.dev, `${ex.roman} → ${ex.dev}`)}
                    className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-left hover:border-green-300 hover:bg-green-50"
                  >
                    <span className="font-mono text-xs text-gray-500">{ex.roman}</span>
                    <p className="mt-0.5 text-base font-bold text-green-900">{ex.dev}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.roman}
                    type="button"
                    onClick={() => insertPhraseAndOpenEditor(ex.devanagari, ex.devanagari)}
                    className="rounded-xl border border-gray-200 bg-white p-2.5 text-left hover:border-green-300 hover:bg-green-50"
                  >
                    <p className="font-mono text-xs text-gray-500">{ex.roman}</p>
                    <p className="text-sm font-bold text-gray-900">{ex.devanagari}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <Keyboard className="h-5 w-5 text-green-800" /> कीबोर्ड शॉर्टकट्स (Keyboard Shortcuts)
              </h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full text-sm">
                  <tbody>
                    {SHORTCUTS.map((s, i) => (
                      <tr key={s.keys} className={i % 2 === 0 ? "bg-gray-50/60" : "bg-white"}>
                        <td className="px-3.5 py-2.5 font-mono text-xs font-semibold text-gray-800">{s.keys}</td>
                        <td className="px-3.5 py-2.5 text-xs sm:text-sm text-gray-600">{s.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Lightweight Custom Word Manager */}
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-2xs">
            <h2 className="text-lg font-bold text-gray-900">
              ३. तुमचे स्वतःचे शब्द जोडा (Custom Word Shortcuts)
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              तुमचे नाव, गाव किंवा वारंवार लागणारे शब्द खाली जोडा — मुख्य एडिटरमध्ये तो Roman शब्द टाइप करताच तुमचा मराठी शब्द पहिल्या पर्यायावर दिसेल.
            </p>
            <form onSubmit={handleAddCustomWordSubmit} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newRomanWord}
                onChange={(e) => setNewRomanWord(e.target.value)}
                placeholder="Roman शब्द (उदा. chhatrapati)"
                className="w-52 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-green-700 font-mono"
              />
              <span className="text-gray-400 font-bold">→</span>
              <input
                type="text"
                value={newMarathiWord}
                onChange={(e) => setNewMarathiWord(e.target.value)}
                placeholder="मराठी शब्द (उदा. छत्रपती)"
                className="w-56 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-green-700 font-devanagari"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900"
              >
                <Plus className="h-4 w-4" /> जोडा
              </button>
            </form>
            {Object.keys(customDict).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(customDict).map(([rom, mar]) => (
                  <span
                    key={rom}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-800"
                  >
                    <span className="font-mono text-gray-500">{rom}</span>
                    <span>→</span>
                    <span className="text-green-900 font-bold">{mar}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomWord(rom)}
                      className="text-gray-400 hover:text-red-600"
                      title="हटवा"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-3.5 text-xs text-gray-500 sm:flex-row sm:px-6">
          <p className="flex items-center gap-2 font-devanagari">
            <AppLogo className="h-5 w-5" />
            <span className="font-bold text-gray-800">मराठी टायपिंग</span> — जलद, अचूक आणि १००% ऑफलाइन मराठी लेखन
          </p>
          <p>MIT License • {totalDictCount.toLocaleString()}+ Built-in Lexicon • TXT, Word (.doc) & PDF</p>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-lg font-devanagari">
          <Check className="h-4 w-4 text-green-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
