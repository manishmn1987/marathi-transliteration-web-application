import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Undo2, Redo2, Trash2, Copy, FileText, FileDown, Keyboard, Check, X,
  Sparkles, BookOpen, ClipboardCopy, Type, Languages,
  ShieldCheck, Zap, Globe, Search, Volume2, VolumeX,
  Mic, MicOff, Plus, BookmarkPlus, FolderOpen, Save, Hash, ZoomIn, ZoomOut, FileType,
} from "lucide-react";
import {
  getCandidates, transliterateText, normalizeMarathi, MARATHI_DICT,
  getCustomDictionary, addCustomWord, removeCustomWord,
  convertNumbersToMarathi, convertNumbersToEnglish,
} from "./lib/transliteration";
import { VOCAB_CATEGORIES, DOCUMENT_TEMPLATES } from "./lib/marathiData";
import OnScreenKeyboard from "./components/OnScreenKeyboard";

function AppLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} shrink-0 drop-shadow-sm`}
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

type CandidateState = {
  roman: string;
  start: number; // start index of roman word in text
  candidates: string[];
  index: number;
};

type SavedDoc = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

const SAVED_DOCS_KEY = "marathi_typing_saved_docs_v1";

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

export default function App() {
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
  const [showKeyboard, setShowKeyboard] = useState(true);
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

  // Saved Documents state
  const [showSavedDocs, setShowSavedDocs] = useState(false);
  const [docTitleInput, setDocTitleInput] = useState("");
  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_DOCS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Speech & Voice state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Studio Hub Tabs ("vocab" | "templates" | "customDict" | "guide")
  const [studioTab, setStudioTab] = useState<"vocab" | "templates" | "customDict" | "guide">("vocab");
  const [activeVocabCat, setActiveVocabCat] = useState<string>("daily");
  const [vocabSearch, setVocabSearch] = useState<string>("");

  // Custom Dictionary state
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
    textareaRef.current?.focus();
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
    showToast(`शब्दकोशात जतन केले: ${candidate.roman} → ${chosen}`);
  }, [candidate, commitCandidate, showToast]);

  const cycleCandidate = useCallback(
    (dir: 1 | -1) => {
      if (!candidate) return;
      const n = candidate.candidates.length;
      if (n === 0) return;
      const nextIdx = (candidate.index + dir + n) % n;
      setCandidate({ ...candidate, index: nextIdx });
    },
    [candidate]
  );

  const revertToRoman = useCallback(() => {
    if (!candidate) return;
    setCandidate(null);
    showToast("Roman शब्द ठेवला (Kept Roman)");
  }, [candidate, showToast]);

  // Core live transliteration on change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.target;
    const newVal = ta.value;
    const selStart = ta.selectionStart ?? newVal.length;
    const selEnd = ta.selectionEnd ?? newVal.length;

    if (selStart !== selEnd || mode === "english" || !autoConvert) {
      setText(newVal);
      setCandidate(null);
      return;
    }

    const charBefore = selStart > 0 ? newVal[selStart - 1] : "";
    const isDelimiter = /[\s\.,\?!;:\-—\(\)"'\/\\|।]/.test(charBefore);

    if (isDelimiter) {
      const wordEnd = selStart - 1;
      let wordStart = wordEnd;
      while (wordStart > 0 && /[A-Za-z]/.test(newVal[wordStart - 1])) {
        wordStart--;
      }
      const romanWord = newVal.slice(wordStart, wordEnd);

      if (romanWord) {
        let replacement = romanWord;
        if (candidate && candidate.roman.toLowerCase() === romanWord.toLowerCase()) {
          replacement = candidate.candidates[candidate.index] ?? romanWord;
        } else {
          const { candidates, isEnglish } = getCandidates(romanWord);
          if (!isEnglish && candidates.length > 0) {
            replacement = candidates[0];
          }
        }

        const before = newVal.slice(0, wordStart);
        const after = newVal.slice(wordEnd);
        const converted = before + replacement + after;
        const newCursor = wordStart + replacement.length + (selStart - wordEnd);

        recordHistory(text);
        setTextAndCursor(converted, newCursor);
        setCandidate(null);
        return;
      }
    }

    let start = selStart;
    while (start > 0 && /[A-Za-z]/.test(newVal[start - 1])) start--;
    let end = selStart;
    while (end < newVal.length && /[A-Za-z]/.test(newVal[end])) end++;
    const roman = newVal.slice(start, end);

    setText(newVal);

    if (!roman) {
      setCandidate(null);
      return;
    }

    const { candidates, isEnglish } = getCandidates(roman);
    if (isEnglish) {
      setCandidate({ roman, start, candidates: [roman], index: 0 });
    } else {
      const list = [...candidates];
      if (!list.includes(roman)) list.push(roman);
      setCandidate({ roman, start, candidates: list, index: 0 });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      doUndo();
      return;
    }
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")) {
      e.preventDefault();
      doRedo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setShowFindReplace((v) => !v);
      return;
    }

    if (!candidate) return;

    if (e.key === "Tab") {
      e.preventDefault();
      cycleCandidate(e.shiftKey ? -1 : 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      cycleCandidate(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cycleCandidate(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      revertToRoman();
    } else if (/^[1-9]$/.test(e.key)) {
      const numIdx = parseInt(e.key, 10) - 1;
      if (numIdx < candidate.candidates.length) {
        e.preventDefault();
        commitCandidate(" ", numIdx);
      }
    } else if (e.key === " ") {
      e.preventDefault();
      commitCandidate(" ");
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitCandidate("\n");
    } else if ([".", ",", "?", "!", ";", ":", "-", "|", "।"].includes(e.key)) {
      e.preventDefault();
      commitCandidate(e.key);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (mode !== "marathi" || !autoConvert) return;
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;
    if (!/[A-Za-z]/.test(pasted)) return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const converted = transliterateText(pasted);
    const newText = text.slice(0, start) + converted + text.slice(end);
    recordHistory(text);
    setTextAndCursor(newText, start + converted.length);
    setCandidate(null);
    showToast("पेस्ट केलेला मजकूर रूपांतरित झाला (Pasted text converted)");
  };

  const insertAtCursor = useCallback(
    (insert: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      let start = ta.selectionStart ?? text.length;
      let end = ta.selectionEnd ?? text.length;
      const isCombiningMark = /^[ा-ौृॄॅॉ्ंःँ]$/.test(insert);
      if (candidate) {
        start = candidate.start;
        end = candidate.start + candidate.roman.length;
        const committed = candidate.candidates[candidate.index] ?? candidate.roman;
        const combined = committed + insert;
        const newText = text.slice(0, start) + combined + text.slice(end);
        setCandidate(null);
        recordHistory(text);
        setTextAndCursor(newText, start + combined.length);
        return;
      }
      if (isCombiningMark && start === end && start > 1 && text[start - 1] === " " && /\S/.test(text[start - 2])) {
        const newText = text.slice(0, start - 1) + insert + " " + text.slice(end);
        recordHistory(text);
        setTextAndCursor(newText, start + insert.length);
        return;
      }
      const newText = text.slice(0, start) + insert + text.slice(end);
      recordHistory(text);
      setTextAndCursor(newText, start + insert.length);
    },
    [text, candidate, recordHistory, setTextAndCursor]
  );

  const backspaceAtCursor = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    if (start === 0 && end === 0) return;
    let delStart = start;
    let delEnd = end;
    if (start === end) {
      delStart = Math.max(0, start - 1);
      const prev = text[delStart];
      if (prev && /[ािीुूेैोौृॄ्ंःँ]/.test(prev) && delStart > 0) {
        delStart = delStart - 1;
      }
    }
    const newText = text.slice(0, delStart) + text.slice(delEnd);
    recordHistory(text);
    setTextAndCursor(newText, delStart);
    setCandidate(null);
  }, [text, recordHistory, setTextAndCursor]);

  const doUndo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (prev === undefined) return;
    futureRef.current.push(text);
    lastSnapshotRef.current = prev;
    setText(prev);
    setCandidate(null);
    setHistoryVersion((v) => v + 1);
    showToast("मागील बदल रद्द केला (Undo)");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [text, showToast]);

  const doRedo = useCallback(() => {
    const next = futureRef.current.pop();
    if (next === undefined) return;
    pastRef.current.push(text);
    lastSnapshotRef.current = next;
    setText(next);
    setCandidate(null);
    setHistoryVersion((v) => v + 1);
    showToast("बदल पुन्हा लागू केला (Redo)");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [text, showToast]);

  const doClear = useCallback(() => {
    if (!text) return;
    recordHistory(text);
    setText("");
    setCandidate(null);
    showToast("सर्व मजकूर साफ झाला (Cleared)");
    focusEditor();
  }, [text, recordHistory, showToast, focusEditor]);

  const doSelectAll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  const getCommittedText = useCallback(() => {
    if (candidate) {
      const actualWord = text.slice(candidate.start, candidate.start + candidate.roman.length);
      if (actualWord.toLowerCase() === candidate.roman.toLowerCase()) {
        const replacement = candidate.candidates[candidate.index] ?? candidate.roman;
        return text.slice(0, candidate.start) + replacement + text.slice(candidate.start + candidate.roman.length);
      }
    }
    return text;
  }, [candidate, text]);

  // Convert Numbers (123 <-> १२३)
  const toggleMarathiNumbers = useCallback(() => {
    const full = getCommittedText();
    if (!full) {
      showToast("आधी मजकूर किंवा अंक टाइप करा");
      return;
    }
    const hasEnglishDigits = /[0-9]/.test(full);
    const converted = hasEnglishDigits ? convertNumbersToMarathi(full) : convertNumbersToEnglish(full);
    if (converted === full) {
      showToast("मजकुरात कोणतेही अंक (0-9 / ०-९) आढळले नाहीत");
      return;
    }
    recordHistory(text);
    setText(converted);
    setCandidate(null);
    showToast(hasEnglishDigits ? "अंक मराठीत रूपांतरित झाले (१२३)" : "अंक इंग्रजीत रूपांतरित झाले (123)");
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
  const toggleSpeak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast("तुमच्या ब्राउझरमध्ये आवाज सुविधा उपलब्ध नाही");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const full = getCommittedText().trim();
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
  }, [isSpeaking, getCommittedText, showToast]);

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

  // Saved Documents operations
  const saveCurrentDoc = useCallback(() => {
    const full = getCommittedText().trim();
    if (!full) {
      showToast("जतन करण्यासाठी आधी मजकूर लिहा");
      return;
    }
    const title = docTitleInput.trim() || full.split("\n")[0].slice(0, 36) || "मराठी लेख";
    const newDoc: SavedDoc = {
      id: String(Date.now()),
      title,
      content: full,
      updatedAt: new Date().toLocaleString("mr-IN", { dateStyle: "medium", timeStyle: "short" }),
    };
    const next = [newDoc, ...savedDocs];
    setSavedDocs(next);
    setDocTitleInput("");
    try {
      localStorage.setItem(SAVED_DOCS_KEY, JSON.stringify(next));
    } catch {}
    showToast(`लेख जतन झाला: "${title}"`);
  }, [getCommittedText, docTitleInput, savedDocs, showToast]);

  const loadSavedDoc = useCallback(
    (doc: SavedDoc) => {
      recordHistory(text);
      setText(doc.content);
      setCandidate(null);
      showToast(`लेख उघडला: "${doc.title}"`);
      focusEditor();
    },
    [recordHistory, text, showToast, focusEditor]
  );

  const deleteSavedDoc = useCallback(
    (id: string) => {
      const next = savedDocs.filter((d) => d.id !== id);
      setSavedDocs(next);
      try {
        localStorage.setItem(SAVED_DOCS_KEY, JSON.stringify(next));
      } catch {}
      showToast("लेख हटवला (Deleted)");
    },
    [savedDocs, showToast]
  );

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

  const downloadTXT = useCallback(() => {
    const fullText = getCommittedText();
    if (!fullText.trim()) {
      showToast("डाउनलोड करण्यासाठी मजकूर नाही");
      return;
    }
    const normalized = normalizeMarathi(fullText);
    const blob = new Blob(["\uFEFF" + normalized], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marathi-lekhan.txt";
    a.click();
    URL.revokeObjectURL(url);
    showToast("TXT फाइल डाउनलोड झाली (TXT downloaded)");
  }, [getCommittedText, showToast]);

  const downloadDOC = useCallback(() => {
    const fullText = getCommittedText();
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
    a.download = "marathi-lekhan.doc";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Word (.doc) फाइल डाउनलोड झाली");
  }, [getCommittedText, showToast]);

  const downloadPDF = useCallback(async () => {
    const fullText = getCommittedText();
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
  }, [getCommittedText, showToast]);

  const insertPhrase = useCallback(
    (devanagari: string, label?: string) => {
      const ta = textareaRef.current;
      const sep = text && !/\s$/.test(text) ? " " : "";
      const toInsert = sep + devanagari;
      if (ta) {
        const start = ta.selectionStart ?? text.length;
        const end = ta.selectionEnd ?? text.length;
        const newText = text.slice(0, start) + toInsert + text.slice(end);
        recordHistory(text);
        setTextAndCursor(newText, start + toInsert.length);
      } else {
        recordHistory(text);
        setText(text + toInsert);
      }
      showToast(label ? `जोडले: ${label}` : `जोडले: ${devanagari}`);
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [text, recordHistory, setTextAndCursor, showToast]
  );

  // Filtered vocabulary items + dictionary search results
  const filteredVocabItems = useMemo(() => {
    const q = vocabSearch.trim().toLowerCase();
    const activeCategory = VOCAB_CATEGORIES.find((c) => c.id === activeVocabCat) ?? VOCAB_CATEGORIES[0];
    if (!q) return activeCategory.items;

    const results: { roman: string; marathi: string; meaning: string }[] = [];
    const seen = new Set<string>();
    for (const cat of VOCAB_CATEGORIES) {
      for (const item of cat.items) {
        if (
          item.roman.toLowerCase().includes(q) ||
          item.marathi.includes(q) ||
          item.meaning.toLowerCase().includes(q)
        ) {
          const key = item.roman + ":" + item.marathi;
          if (!seen.has(key)) {
            seen.add(key);
            results.push(item);
          }
        }
      }
    }
    // Also search the full MARATHI_DICT for matching words
    for (const [rom, vals] of Object.entries(MARATHI_DICT)) {
      if (results.length >= 36) break;
      if (rom.includes(q) || vals.some((v) => v.includes(q))) {
        const mar = vals.join(" / ");
        const key = rom + ":" + mar;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ roman: rom, marathi: vals[0], meaning: vals.length > 1 ? `पर्याय: ${vals.join(", ")}` : "शब्दकोश (Dictionary word)" });
        }
      }
    }
    return results;
  }, [vocabSearch, activeVocabCat]);

  const handleAddCustomWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rom = newRomanWord.trim().toLowerCase().replace(/[^a-z]/g, "");
    const mar = newMarathiWord.trim();
    if (!rom || !mar) {
      showToast("कृपया Roman शब्द आणि त्याचा मराठी अर्थ दोन्ही भरा");
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
    showToast(`शब्दकोशातून हटवले: ${rom}`);
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
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <AppLogo className="h-10 w-10" />
            <span className="leading-tight">
              <span className="block text-lg font-bold tracking-tight text-gray-900 font-devanagari">मराठी टायपिंग स्टुडिओ</span>
              <span className="block text-xs text-gray-500">Smart Marathi Transliteration & Writing Suite</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium text-gray-600 md:flex font-devanagari">
            <a href="#editor" className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">एडिटर (Editor)</a>
            <a href="#keyboard" className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">कीबोर्ड (Keyboard)</a>
            <a href="#studio" onClick={() => setStudioTab("vocab")} className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">शब्दकोश व म्हणी</a>
            <a href="#studio" onClick={() => setStudioTab("templates")} className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">तयार मसुदे (Templates)</a>
            <a href="#studio" onClick={() => setStudioTab("customDict")} className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">माझा शब्दकोश</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" /> {totalDictCount.toLocaleString()}+ मूळ शब्द • 100% Offline
            </span>
            <a href="#editor" className="rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900 font-devanagari">
              लिहायला सुरुवात करा
            </a>
          </div>
        </div>
      </header>

      {/* Compact Hero */}
      <section id="top" className="border-b border-gray-100 bg-gradient-to-b from-green-50/60 to-white">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-800">
              <Sparkles className="h-3.5 w-3.5" /> स्मार्ट शुद्धलेखन • प्रत्यय व सामान्यरूप विश्लेषण • आवाज टायपिंग व वाचन
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl font-devanagari">
              English मध्ये टाइप करा, <span className="text-green-800">अस्खलित मराठीत लिहा!</span>
            </h1>
            <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base font-devanagari">
              <span className="font-semibold text-gray-900 font-mono">sanskruti</span> टाइप करताच{" "}
              <span className="font-semibold text-green-800">संस्कृती</span> होते. समृद्ध शब्दकोश, तयार अर्ज व पत्रे, म्हणी, उच्चार वाचन, आवाज टायपिंग आणि TXT / Word / PDF एक्सपोर्ट.
            </p>
          </div>
        </div>
      </section>

      {/* Main Editor */}
      <main id="editor" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-2.5 border-b border-gray-200 bg-gray-50/80 px-4 py-3 sm:px-5">
            {/* Row 1: Mode, Auto-convert, Font size, Digit convert, Undo/Redo/Clear */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setMode("marathi")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition font-devanagari ${
                    mode === "marathi" ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
                  }`}
                >
                  <Languages className="h-4 w-4" /> मराठी
                </button>
                <button
                  type="button"
                  onClick={() => setMode("english")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "english" ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
                  }`}
                >
                  <Type className="h-4 w-4" /> English
                </button>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoConvert}
                  onClick={() => setAutoConvert((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition ${autoConvert ? "bg-green-800" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${autoConvert ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <span className="text-xs sm:text-sm">Auto-convert {autoConvert ? "ON" : "OFF"}</span>
              </label>

              {/* Font size controls */}
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-1 text-xs font-semibold text-gray-700">
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
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 hover:border-green-300 hover:text-green-800 font-devanagari"
              >
                <Hash className="h-3.5 w-3.5" /> 123 ↔ १२३
              </button>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFindReplace((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium transition font-devanagari ${
                    showFindReplace ? "border-green-800 bg-green-50 text-green-900" : "border-gray-200 bg-white text-gray-700 hover:border-green-300"
                  }`}
                >
                  <Search className="h-3.5 w-3.5" /> शोधा
                </button>
                <button type="button" onClick={doUndo} disabled={pastRef.current.length === 0} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800 disabled:opacity-40">
                  <Undo2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Undo</span>
                </button>
                <button type="button" onClick={doRedo} disabled={futureRef.current.length === 0} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800 disabled:opacity-40">
                  <Redo2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Redo</span>
                </button>
                <button type="button" onClick={doSelectAll} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800">
                  <Copy className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Select all</span>
                </button>
                <button type="button" onClick={doClear} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-red-700 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* Row 2: Copy, Export (TXT, Word, PDF), Speak, Dictate, Saved Drafts, Keyboard toggle */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-green-900">
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy all
              </button>
              <button type="button" onClick={copySelected} className="inline-flex items-center gap-1.5 rounded-full border border-green-800 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-green-800 hover:bg-green-50">
                <Copy className="h-3.5 w-3.5" /> Copy selected
              </button>
              <button type="button" onClick={downloadTXT} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800">
                <FileText className="h-3.5 w-3.5" /> TXT
              </button>
              <button type="button" onClick={downloadDOC} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800">
                <FileType className="h-3.5 w-3.5" /> Word (.doc)
              </button>
              <button type="button" onClick={downloadPDF} disabled={pdfBusy} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800 disabled:opacity-50">
                <FileDown className="h-3.5 w-3.5" /> {pdfBusy ? "PDF…" : "PDF"}
              </button>

              {/* Listen (Text-to-Speech) */}
              <button
                type="button"
                onClick={toggleSpeak}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition font-devanagari ${
                  isSpeaking
                    ? "border-amber-600 bg-amber-500 text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-green-300 hover:text-green-800"
                }`}
              >
                {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {isSpeaking ? "वाचन थांबवा" : "उच्चार ऐका"}
              </button>

              {/* Voice Dictation (Speech-to-Text) */}
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

              {/* Saved Drafts toggle */}
              <button
                type="button"
                onClick={() => setShowSavedDocs((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition font-devanagari ${
                  showSavedDocs
                    ? "border-green-800 bg-green-800 text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-green-300"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" /> माझे लेख ({savedDocs.length})
              </button>

              {/* On-screen Keyboard toggle */}
              <button
                type="button"
                onClick={() => setShowKeyboard((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold ${
                  showKeyboard ? "border-green-800 bg-green-800 text-white" : "border-gray-300 bg-white text-gray-800 hover:border-green-300"
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" /> Keyboard {showKeyboard ? "ON" : "OFF"}
              </button>

              <span className="ml-auto hidden items-center gap-1 text-xs text-gray-400 xl:inline-flex">
                <Zap className="h-3.5 w-3.5" /> जतन केले {savedAt ? `• ${savedAt.toLocaleTimeString("mr-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
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

            {/* Optional Saved Documents Panel */}
            {showSavedDocs && (
              <div className="mt-1 rounded-2xl border border-green-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                  <span className="font-bold text-gray-800 font-devanagari flex items-center gap-1.5">
                    <FolderOpen className="h-4 w-4 text-green-800" /> माझे जतन केलेले लेख (Saved Documents)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={docTitleInput}
                      onChange={(e) => setDocTitleInput(e.target.value)}
                      placeholder="लेखाचे शीर्षक (उदा. रजेचा अर्ज)..."
                      className="w-48 sm:w-64 rounded-lg border border-gray-200 px-2.5 py-1 text-xs sm:text-sm outline-none focus:border-green-700 font-devanagari"
                    />
                    <button
                      type="button"
                      onClick={saveCurrentDoc}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-900 font-devanagari"
                    >
                      <Save className="h-3.5 w-3.5" /> सध्याचा मजकूर जतन करा
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSavedDocs(false)}
                      className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {savedDocs.length === 0 ? (
                  <p className="py-3 text-xs text-gray-500 font-devanagari">
                    अद्याप कोणताही लेख जतन केलेला नाही. वरील &apos;सध्याचा मजकूर जतन करा&apos; बटनावर क्लिक करून तुमचे लेख जतन करा.
                  </p>
                ) : (
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {savedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/60 p-2.5 hover:border-green-300"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-gray-900 font-devanagari line-clamp-1">{doc.title}</h4>
                            <span className="shrink-0 text-[11px] text-gray-400">{doc.updatedAt}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-600 font-devanagari line-clamp-2">{doc.content}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-gray-200/70 font-devanagari">
                          <button
                            type="button"
                            onClick={() => loadSavedDoc(doc)}
                            className="rounded-md bg-green-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-900"
                          >
                            एडिटरमध्ये उघडा
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(doc.content, `"${doc.title}" कॉपी झाले`)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:border-green-300"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedDoc(doc.id)}
                            className="ml-auto rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            हटवा
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Textarea with zero-shift floating suggestions bar at top */}
          <div className="relative">
            {candidate && (
              <div className="
                absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-2
                border-b border-green-200 bg-green-50/95 px-4 sm:px-5
                overflow-x-auto overflow-y-hidden whitespace-nowrap backdrop-blur
              ">
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
                          ? "border-green-800 bg-green-800 text-white shadow-sm"
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
                    <BookmarkPlus className="h-3.5 w-3.5" /> शब्दकोशात जतन करा
                  </button>
                </div>
                <div className="ml-auto hidden shrink-0 items-center gap-2 text-xs text-gray-500 xl:flex">
                  <span className="font-semibold text-green-900 bg-white px-2.5 py-1 rounded-full border border-green-200 font-devanagari">
                    Space: {candidate.candidates[candidate.index] ?? candidate.roman}
                  </span>
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
              placeholder={"इथे टाइप करा…\n\nउदा. namaskar, maharashtrachi sanskruti khup sundar aahe"}
              className="editor-scroll min-h-[280px] w-full resize-y bg-white px-5 pt-14 pb-5 leading-[1.9] text-gray-900 outline-none placeholder:text-base placeholder:leading-relaxed placeholder:text-gray-400 sm:min-h-[340px] font-devanagari"
              aria-label="Marathi typing editor"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs font-medium text-gray-600 sm:px-5 sm:text-sm font-devanagari">
            <span>शब्द (Words): <strong className="text-gray-900">{stats.words}</strong></span>
            <span>अक्षरे (Chars): <strong className="text-gray-900">{stats.chars}</strong> <span className="text-gray-400">({stats.charsNoSpace} स्पेसशिवाय)</span></span>
            <span>परिच्छेद (Paragraphs): <strong className="text-gray-900">{stats.paragraphs}</strong></span>
            <span>ओळी (Lines): <strong className="text-gray-900">{stats.lines}</strong></span>
            <span className="ml-auto hidden items-center gap-1 text-gray-400 sm:inline-flex font-sans">
              <Globe className="h-3.5 w-3.5" /> {totalDictCount.toLocaleString()}+ Lexicon + प्रत्यय विश्लेषक
            </span>
          </div>
        </div>

        {/* On-Screen Keyboard */}
        {showKeyboard && (
          <div id="keyboard" className="mt-4 scroll-mt-24">
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

        {/* Interactive Marathi Studio Hub: Vocabulary, Templates, Personal Dictionary & Guide */}
        <section id="studio" className="mt-8 scroll-mt-20 rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 font-devanagari">
                मराठी लेखन आणि शब्दभांडार केंद्र (Marathi Writing & Vocabulary Hub)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-devanagari">
                कोणत्याही शब्दावर, म्हणीवर किंवा तयार मसुद्यावर क्लिक करून थेट एडिटरमध्ये जोडा.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-gray-100 p-1 font-devanagari">
              <button
                type="button"
                onClick={() => setStudioTab("vocab")}
                className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                  studioTab === "vocab" ? "bg-green-800 text-white shadow-sm" : "text-gray-700 hover:text-green-800"
                }`}
              >
                शब्दकोश व म्हणी
              </button>
              <button
                type="button"
                onClick={() => setStudioTab("templates")}
                className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                  studioTab === "templates" ? "bg-green-800 text-white shadow-sm" : "text-gray-700 hover:text-green-800"
                }`}
              >
                तयार मसुदे (Templates)
              </button>
              <button
                type="button"
                onClick={() => setStudioTab("customDict")}
                className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                  studioTab === "customDict" ? "bg-green-800 text-white shadow-sm" : "text-gray-700 hover:text-green-800"
                }`}
              >
                माझा शब्दकोश ({Object.keys(customDict).length})
              </button>
              <button
                type="button"
                onClick={() => setStudioTab("guide")}
                className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                  studioTab === "guide" ? "bg-green-800 text-white shadow-sm" : "text-gray-700 hover:text-green-800"
                }`}
              >
                मार्गदर्शक व शॉर्टकट्स
              </button>
            </div>
          </div>

          {/* TAB 1: Vocabulary, Phrases & Proverbs Explorer */}
          {studioTab === "vocab" && (
            <div className="mt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5 font-devanagari">
                  {VOCAB_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveVocabCat(cat.id);
                        setVocabSearch("");
                      }}
                      className={`rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
                        activeVocabCat === cat.id && !vocabSearch
                          ? "border-green-800 bg-green-50 text-green-900"
                          : "border-gray-200 bg-white text-gray-700 hover:border-green-300"
                      }`}
                    >
                      {cat.title} <span className="text-xs font-normal text-gray-400">({cat.subtitle})</span>
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={vocabSearch}
                    onChange={(e) => setVocabSearch(e.target.value)}
                    placeholder="शब्द, म्हण किंवा Roman शोधा..."
                    className="w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-8 py-1.5 text-sm outline-none focus:border-green-700 focus:bg-white font-devanagari"
                  />
                  {vocabSearch && (
                    <button
                      type="button"
                      onClick={() => setVocabSearch("")}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVocabItems.map((item, idx) => (
                  <div
                    key={item.roman + idx}
                    className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50/40 p-3.5 transition hover:border-green-300 hover:bg-green-50/30"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-semibold text-green-800 border border-gray-200">
                          {item.roman}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(item.marathi, `कॉपी झाले: ${item.marathi}`)}
                          className="text-xs text-gray-400 hover:text-green-800"
                          title="Copy"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="mt-2 text-lg font-bold text-gray-900 font-devanagari">{item.marathi}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{item.meaning}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertPhrase(item.marathi, item.marathi)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-800 group-hover:underline font-devanagari"
                    >
                      <Plus className="h-3.5 w-3.5" /> एडिटरमध्ये जोडा (Insert)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Ready-to-Use Document Templates */}
          {studioTab === "templates" && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {DOCUMENT_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50/40 p-4 hover:border-green-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900 font-devanagari">
                        {tpl.category}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-gray-900 font-devanagari">{tpl.title}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 font-devanagari">{tpl.description}</p>
                    <pre className="mt-3 max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 whitespace-pre-wrap font-devanagari">
                      {tpl.content}
                    </pre>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 font-devanagari">
                    <button
                      type="button"
                      onClick={() => {
                        recordHistory(text);
                        setText(tpl.content);
                        setCandidate(null);
                        showToast(`मसुदा उघडला: ${tpl.title}`);
                        document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="rounded-xl bg-green-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-green-900"
                    >
                      एडिटरमध्ये उघडा (Replace)
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPhrase("\n\n" + tpl.content, tpl.title)}
                      className="rounded-xl border border-green-800 bg-white px-3.5 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-50"
                    >
                      शेवटी जोडा (Append)
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(tpl.content, `मसुदा कॉपी झाला: ${tpl.title}`)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-green-300"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Personal Dictionary Manager */}
          {studioTab === "customDict" && (
            <div className="mt-5">
              <div className="rounded-2xl border border-green-200 bg-green-50/40 p-4">
                <h3 className="text-base font-bold text-gray-900 font-devanagari">
                  नवीन शब्द जोडा (Add Custom Roman → Marathi Word)
                </h3>
                <p className="mt-1 text-xs text-gray-600 font-devanagari">
                  तुमचे आडनाव, गावाचे नाव किंवा विशेष तांत्रिक शब्द इथे जोडा. पुढच्या वेळी तो Roman शब्द टाइप करताच तुमचा मराठी शब्द पहिल्या क्रमांकावर दिसेल!
                </p>
                <form onSubmit={handleAddCustomWordSubmit} className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newRomanWord}
                    onChange={(e) => setNewRomanWord(e.target.value)}
                    placeholder="Roman शब्द (उदा. chhatrapati)"
                    className="w-52 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-700 font-mono"
                  />
                  <span className="text-gray-400 font-bold">→</span>
                  <input
                    type="text"
                    value={newMarathiWord}
                    onChange={(e) => setNewMarathiWord(e.target.value)}
                    placeholder="मराठी शब्द (उदा. छत्रपती)"
                    className="w-56 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-700 font-devanagari"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900 font-devanagari"
                  >
                    <Plus className="h-4 w-4" /> शब्दकोशात जोडा
                  </button>
                </form>
              </div>

              <div className="mt-4">
                {Object.keys(customDict).length === 0 ? (
                  <p className="py-4 text-sm text-gray-500 font-devanagari">
                    तुमच्या वैयक्तिक शब्दकोशात अद्याप कोणताही शब्द नाही. वरील फॉर्म वापरून किंवा टाइप करताना &apos;शब्दकोशात जतन करा&apos; बटनावर क्लिक करून शब्द जोडा.
                  </p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {Object.entries(customDict).map(([rom, mar]) => (
                      <div
                        key={rom}
                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 shadow-xs"
                      >
                        <div>
                          <span className="font-mono text-xs font-semibold text-gray-500">{rom}</span>
                          <p className="text-base font-bold text-green-900 font-devanagari">{mar}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => insertPhrase(mar)}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-50 font-devanagari"
                          >
                            जोडा
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomWord(rom)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="हटवा"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Typing Guide, Shortcuts & Quick Examples */}
          {studioTab === "guide" && (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 font-devanagari">
                  <BookOpen className="h-5 w-5 text-green-800" /> कसे टाइप करावे? (How to type)
                </h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700 font-devanagari">
                  <li>वरील बॉक्समध्ये <strong>इंग्रजी अक्षरांत (Roman)</strong> टाइप करा — उदा. <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">sanskruti</code> → <strong>संस्कृती</strong>.</li>
                  <li>टाइप करताना वरच्या स्थिर पट्टीत (Fixed Suggestion Bar) पर्याय दिसतात — त्यामुळे खालील एडिटर अजिबात हलत नाही.</li>
                  <li><strong>Space</strong> किंवा <strong>1–7</strong> अंक दाबून हवा तो पर्याय निवडा. मूळ इंग्रजी शब्द ठेवण्यासाठी <strong>Esc</strong> दाबा.</li>
                  <li>मराठी विभक्ती प्रत्यय (उदा. <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">mitrasobat → मित्रासोबत</code>, <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">deshasathi → देशासाठी</code>, <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">mulanna → मुलांना</code>) आपोआप ओळखले जातात.</li>
                </ol>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.roman}
                      type="button"
                      onClick={() => insertPhrase(ex.devanagari, ex.devanagari)}
                      className="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 text-left hover:border-green-300 hover:bg-green-50"
                    >
                      <p className="font-mono text-xs text-gray-500">{ex.roman}</p>
                      <p className="text-sm font-bold text-gray-900 font-devanagari">{ex.devanagari}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <Keyboard className="h-5 w-5 text-green-800" /> Keyboard Shortcuts
                </h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody>
                      {SHORTCUTS.map((s, i) => (
                        <tr key={s.keys} className={i % 2 === 0 ? "bg-gray-50/60" : "bg-white"}>
                          <td className="px-3.5 py-2 font-mono text-xs font-semibold text-gray-800">{s.keys}</td>
                          <td className="px-3.5 py-2 text-xs sm:text-sm text-gray-600 font-devanagari">{s.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* About Section */}
        <section className="mt-8 rounded-3xl bg-green-800 p-6 text-white sm:p-8">
          <h2 className="text-xl font-bold font-devanagari">मराठी टायपिंगबद्दल — About Marathi Typing Studio</h2>
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-green-50 sm:text-base md:grid-cols-2 font-devanagari">
            <p>
              मराठी टायपिंग स्टुडिओ हे मराठी भाषेत अचूक आणि वेगवान लिहिण्यासाठी अत्यंत परिपूर्ण साधन आहे. यात समृद्ध मराठी शब्दकोश, विभक्ती प्रत्यय व सामान्यरूप विश्लेषक, तयार अर्ज व पत्रे, मराठी म्हणी, आवाज टायपिंग आणि उच्चार वाचन यांसारख्या सर्व सुविधा एकत्रित दिल्या आहेत.
            </p>
            <p>
              हे साधन कोणत्याही नोंदणीशिवाय पूर्णपणे विनामूल्य आणि १००% ऑफलाइन चालते. सर्व प्रक्रिया तुमच्या ब्राउझरमध्येच होत असल्यामुळे तुमचा मजकूर सुरक्षित राहतो आणि तुम्ही तो TXT, Word (.doc) किंवा PDF स्वरूपात लगेच डाउनलोड करू शकता.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:px-6">
          <p className="flex items-center gap-2 font-devanagari">
            <AppLogo className="h-6 w-6" />
            <span className="font-bold text-gray-800">मराठी टायपिंग स्टुडिओ</span> — English मध्ये टाइप करा, मराठीत लिहा!
          </p>
          <p className="text-xs">MIT License • Offline Morphological Engine • TXT, Word (.doc) & PDF Export</p>
        </div>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg font-devanagari">
          {toast}
        </div>
      )}
    </div>
  );
}
