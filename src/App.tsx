import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Undo2, Redo2, Trash2, Copy, FileText, FileDown, Keyboard, Check, X,
  Sparkles, BookOpen, ClipboardCopy, Type, Languages,
  Lightbulb, ShieldCheck, Zap, Globe,
} from "lucide-react";
import { getCandidates, transliterateText, normalizeMarathi } from "./lib/transliteration";
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

const EXAMPLES: { roman: string; devanagari: string; label: string }[] = [
  { roman: "namaskar", devanagari: "नमस्कार", label: "Greeting" },
  { roman: "maza bharat", devanagari: "माझा भारत", label: "My India" },
  { roman: "tumhi kase aahat", devanagari: "तुम्ही कसे आहात", label: "How are you?" },
  { roman: "mala marathi yete", devanagari: "मला मराठी येते", label: "I know Marathi" },
  { roman: "tumchya madatibaddal dhanyavad", devanagari: "तुमच्या मदतीबद्दल धन्यवाद", label: "Thank you" },
  { roman: "aaj hava khup chhan ahe", devanagari: "आज हवा खूप छान आहे", label: "Weather" },
  { roman: "mi shalet jato aani lihito", devanagari: "मी शाळेत जातो आणि लिहितो", label: "Daily routine" },
  { roman: "maharashtrachi sanskriti khup sundar ahe", devanagari: "महाराष्ट्राची संस्कृती खूप सुंदर आहे", label: "Culture" },
];

const SHORTCUTS = [
  { keys: "1–9", action: "क्रमांकाचा पर्याय थेट निवडा (Select candidate by number)" },
  { keys: "Tab / ↓", action: "पुढचा पर्याय निवडा (Next suggestion)" },
  { keys: "Shift+Tab / ↑", action: "मागचा पर्याय निवडा (Previous suggestion)" },
  { keys: "Space", action: "पर्याय निश्चित करा व नवीन शब्द सुरू करा (Accept & new word)" },
  { keys: "Esc", action: "रूपांतर रद्द करा — मूळ Roman शब्द ठेवा (Keep Roman)" },
  { keys: "Ctrl+Z / Ctrl+Y", action: "मागील बदल रद्द करा / पुन्हा करा (Undo / Redo)" },
  { keys: "Ctrl+A", action: "सर्व मजकूर निवडा (Select all)" },
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
  const [toast, setToast] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const lastSnapshotRef = useRef<string>(text);
  const [historyVersion, setHistoryVersion] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

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

      // Verify that candidate.roman is at candidate.start
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
    showToast("Roman ठेवले (Kept Roman)");
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

    // Check if the character just typed is a delimiter (space, newline, punctuation)
    const charBefore = selStart > 0 ? newVal[selStart - 1] : "";
    const isDelimiter = /[\s\.,\?!;:\-—\(\)"'\/\\|।]/.test(charBefore);

    if (isDelimiter) {
      // Find Roman word immediately before delimiter
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
        const after = newVal.slice(wordEnd); // contains delimiter and subsequent text
        const converted = before + replacement + after;
        const newCursor = wordStart + replacement.length + (selStart - wordEnd);

        recordHistory(text);
        setTextAndCursor(converted, newCursor);
        setCandidate(null);
        return;
      }
    }

    // Normal typing of Roman characters
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
    // Undo / Redo
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
    // Only convert if pasted contains roman letters
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
      // If inserting an anusvara/matra right after a space (from committing a word), attach it to the word before the space
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
      // Delete one grapheme-ish unit: try to delete last code point (handle surrogate)
      delStart = Math.max(0, start - 1);
      // If previous char is a combining mark, include base? Keep simple: delete 1 code unit, but handle Devanagari matra combos by deleting up to 2 if needed
      // Delete full akshara: if char before is matra/halant, delete 2
      const prev = text[delStart];
      if (prev && /[ाािीुूेैोौृॄ्ंः]/.test(prev) && delStart > 0) {
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
    showToast("Undo झाले");
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
    showToast("Redo झाले");
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
        // Fallback
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
    a.download = "marathi-text.txt";
    a.click();
    URL.revokeObjectURL(url);
    showToast("TXT फाइल डाउनलोड झाली (TXT downloaded)");
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
      // Ensure Devanagari font loaded for canvas shaping
      try {
        await document.fonts.load('16px "Noto Sans Devanagari"');
        await document.fonts.ready;
      } catch {}

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "794px"; // A4 @96dpi
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
        // Paginate by slicing canvas
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
      pdf.save("marathi-text.pdf");
      showToast("PDF फाइल डाउनलोड झाली (PDF downloaded)");
    } catch (err) {
      console.error(err);
      showToast("PDF तयार करताना त्रुटी — TXT वापरून पहा");
    } finally {
      setPdfBusy(false);
    }
  }, [text, showToast]);

  const insertExample = useCallback(
    (roman: string, devanagari: string) => {
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
      showToast(`उदाहरण जोडले: ${roman} → ${devanagari}`);
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [text, recordHistory, setTextAndCursor, showToast]
  );

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

  // Keep history version referenced to avoid unused warning
  void historyVersion;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <AppLogo className="h-10 w-10" />
            <span className="leading-tight">
              <span className="block text-lg font-bold tracking-tight text-gray-900 font-devanagari">मराठी टायपिंग</span>
              <span className="block text-xs text-gray-500">Smart Marathi Keyboard</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium text-gray-600 md:flex">
            <a href="#editor" className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">Editor</a>
            <a href="#keyboard" className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">Keyboard</a>
            <a href="#examples" className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">Examples</a>
            <a href="#how" className="rounded-full px-3 py-1.5 hover:bg-green-50 hover:text-green-800">How to type</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Free • Offline
            </span>
            <a href="#editor" className="rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900">
              Start typing
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="border-b border-gray-100 bg-gradient-to-b from-green-50/60 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-800">
              <Sparkles className="h-3.5 w-3.5" /> Live transliteration • No sign-up • No API
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl font-devanagari">
              English मध्ये टाइप करा, <span className="text-green-800">मराठीत लिहा!</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
              Type Marathi using English letters — <span className="font-semibold text-gray-900">namaskar</span> becomes{" "}
              <span className="font-semibold text-green-800 font-devanagari">नमस्कार</span> instantly. Accurate suggestions, mixed Marathi-English typing, on-screen keyboard, TXT & PDF export — all in your browser.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="rounded-full bg-white px-3 py-1.5 font-medium text-gray-700 border border-gray-200 font-devanagari">नमस्कार → namaskar</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-medium text-gray-700 border border-gray-200 font-devanagari">माझा भारत → maza bharat</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-medium text-gray-700 border border-gray-200 font-devanagari">तुम्ही कसे आहात → tumhi kase aahat</span>
            </div>
          </div>
        </div>
      </section>

      {/* Editor */}
      <main id="editor" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Mode selector */}
              <div className="flex rounded-full border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setMode("marathi")}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    mode === "marathi" ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
                  }`}
                >
                  <Languages className="h-4 w-4" /> मराठी (Marathi)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("english")}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    mode === "english" ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
                  }`}
                >
                  <Type className="h-4 w-4" /> English
                </button>
              </div>

              {/* Auto-convert toggle */}
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoConvert}
                  onClick={() => setAutoConvert((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition ${autoConvert ? "bg-green-800" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${autoConvert ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span>Auto-convert {autoConvert ? "ON" : "OFF"}</span>
              </label>

              <span className="hidden text-xs text-gray-400 sm:inline">
                {mode === "marathi" ? "Type Roman → Devanagari live" : "English mode — no conversion"}
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={doUndo} disabled={pastRef.current.length === 0} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800 disabled:opacity-40">
                  <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Undo</span>
                </button>
                <button type="button" onClick={doRedo} disabled={futureRef.current.length === 0} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800 disabled:opacity-40">
                  <Redo2 className="h-4 w-4" /> <span className="hidden sm:inline">Redo</span>
                </button>
                <button type="button" onClick={doSelectAll} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-800">
                  <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Select all</span>
                </button>
                <button type="button" onClick={doClear} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-900">
                <ClipboardCopy className="h-4 w-4" /> Copy all
              </button>
              <button type="button" onClick={copySelected} className="inline-flex items-center gap-1.5 rounded-full border border-green-800 bg-white px-3.5 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">
                <Copy className="h-4 w-4" /> Copy selected
              </button>
              <button type="button" onClick={downloadTXT} className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800">
                <FileText className="h-4 w-4" /> TXT
              </button>
              <button type="button" onClick={downloadPDF} disabled={pdfBusy} className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 hover:border-green-300 hover:text-green-800 disabled:opacity-50">
                <FileDown className="h-4 w-4" /> {pdfBusy ? "PDF…" : "PDF"}
              </button>
              <button
                type="button"
                onClick={() => setShowKeyboard((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold ${
                  showKeyboard ? "border-green-800 bg-green-800 text-white" : "border-gray-300 bg-white text-gray-800 hover:border-green-300"
                }`}
              >
                <Keyboard className="h-4 w-4" /> Keyboard {showKeyboard ? "ON" : "OFF"}
              </button>
              <span className="ml-auto hidden items-center gap-1.5 text-xs text-gray-400 md:inline-flex">
                <Zap className="h-3.5 w-3.5" /> Autosaved locally {savedAt ? `• ${savedAt.toLocaleTimeString("mr-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            </div>
          </div>

          {/* Suggestions bar (positioned directly above the editor area for instant visibility) */}
          <div className="border-b border-gray-200 bg-green-50/35 px-4 py-3 sm:px-5">
            {candidate ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-white border border-gray-200 px-2.5 py-1 font-mono text-xs font-semibold text-gray-700">{candidate.roman}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-xs font-medium text-gray-500">Suggestions:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {candidate.candidates.map((c, i) => (
                    <button
                      key={c + i}
                      type="button"
                      onClick={() => selectCandidate(i)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-base font-medium transition font-devanagari ${
                        i === candidate.index
                          ? "border-green-800 bg-green-800 text-white shadow-sm ring-2 ring-green-600/30"
                          : "border-gray-200 bg-white text-gray-800 hover:border-green-300 hover:bg-green-50"
                      }`}
                      title={i < 9 ? `${i + 1} दाबा किंवा Space दाबा` : "Space दाबा"}
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
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-200 hover:text-red-700"
                  >
                    <X className="h-3.5 w-3.5" /> Roman ठेवा (Esc)
                  </button>
                </div>
                <div className="text-xs text-gray-500 sm:ml-auto flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-green-800 bg-white px-2.5 py-1 rounded-full border border-green-200 font-devanagari">
                    Space दाबा: {candidate.candidates[candidate.index] ?? candidate.roman}
                  </span>
                  <span className="text-gray-400 hidden lg:inline">1-9 किंवा Space निवडण्यासाठी • Tab पुढील पर्याय • Esc Roman ठेवा</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-gray-600 font-devanagari">
                  <Lightbulb className="h-4 w-4 shrink-0 text-green-700" />
                  {mode === "english"
                    ? "सध्या English मोड सुरू आहे. मराठीत टाइप करण्यासाठी 'मराठी' मोड निवडा."
                    : autoConvert
                      ? "इंग्रजी अक्षरांत शब्द टाइप करा — इथे लगेच मराठी पर्याय दिसतील. शब्द निवडण्यासाठी Space किंवा 1–9 दाबा."
                      : "Auto-convert बंद आहे — शब्द इंग्रजीतच राहतील. मराठी रूपांतरासाठी Auto-convert सुरू (ON) करा."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.slice(0, 4).map((ex) => (
                    <button
                      key={ex.roman}
                      type="button"
                      onClick={() => insertExample(ex.roman, ex.devanagari)}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-800"
                    >
                      {ex.roman} → <span className="font-devanagari">{ex.devanagari}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={"इथे टाइप करा…\n\nType in English letters, e.g.:\nnamaskar, mala marathi yete, tumhi kase aahat\n\nOr type directly in Marathi. English words like 'computer' stay in English."}
              className="editor-scroll min-h-[260px] w-full resize-y bg-white px-5 py-5 text-xl leading-[1.9] text-gray-900 outline-none placeholder:text-base placeholder:leading-relaxed placeholder:text-gray-400 sm:min-h-[320px] sm:text-2xl font-devanagari"
              aria-label="Marathi typing editor"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            {text.length === 0 && (
              <div className="pointer-events-none absolute right-4 top-4 hidden rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800 sm:block">
                Live preview: Roman → Devanagari
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs font-medium text-gray-600 sm:px-5 sm:text-sm">
            <span>शब्द (Words): <strong className="text-gray-900">{stats.words}</strong></span>
            <span>अक्षरे (Chars): <strong className="text-gray-900">{stats.chars}</strong> <span className="text-gray-400">({stats.charsNoSpace} without spaces)</span></span>
            <span>परिच्छेद (Paragraphs): <strong className="text-gray-900">{stats.paragraphs}</strong></span>
            <span>ओळी (Lines): <strong className="text-gray-900">{stats.lines}</strong></span>
            <span className="ml-auto hidden items-center gap-1 text-gray-400 sm:inline-flex">
              <Globe className="h-3.5 w-3.5" /> Unicode NFC • Cursor-safe editing
            </span>
          </div>
        </div>

        {/* Keyboard */}
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

        {/* How to type + shortcuts */}
        <div id="how" className="mt-10 grid gap-6 scroll-mt-24 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 font-devanagari">
              <BookOpen className="h-5 w-5 text-green-800" /> कसे टाइप करावे? How to type
            </h2>
            <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-gray-700 sm:text-base font-devanagari">
              <li>वरील मोठ्या बॉक्समध्ये <strong>इंग्रजी अक्षरांत (Roman)</strong> टाइप करा — उदा. <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm">namaskar</code>, <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm">mala marathi yete</code>.</li>
              <li>शब्द टाइप करताना बॉक्सच्या वर <strong>मराठी पर्याय (Suggestions)</strong> दिसतील. <strong>Space</strong> दाबताच पहिला पर्याय निवडला जातो आणि पुढचा शब्द सुरू होतो.</li>
              <li>इतर पर्याय निवडण्यासाठी <strong>1 ते 9</strong> अंक दाबा, <strong>Tab</strong> वापरा किंवा थेट पर्यायावर क्लिक करा. मूळ Roman शब्द ठेवण्यासाठी <strong>Esc</strong> दाबा.</li>
              <li>नेहमीचे इंग्रजी शब्द (<em>computer, hello, download</em>) आपोआप इंग्रजीतच राहतात — त्यामुळे मराठी-इंग्रजी मिश्रित वाक्ये सहज लिहिता येतात.</li>
              <li>वाक्याच्या मध्ये जाऊन संपादन (Edit) करा किंवा Backspace वापरा. तसेच बाहेरून पेस्ट (Paste) केलेला Roman मजकूरही आपोआप मराठीत रूपांतरित होतो.</li>
              <li>लिहून झाल्यावर मजकूर <strong>Copy</strong> करा किंवा <strong>TXT / PDF</strong> स्वरूपात डाउनलोड करा. तुमचा मसुदा ब्राउझरमध्ये आपोआप जतन होतो.</li>
            </ol>
            <div className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold font-devanagari">उदाहरणे (Examples):</p>
              <ul className="mt-1 space-y-1 font-devanagari">
                <li>namaskar → नमस्कार</li>
                <li>maza bharat → माझा भारत</li>
                <li>tumhi kase aahat → तुम्ही कसे आहात</li>
                <li>aaj hava khup chhan ahe → आज हवा खूप छान आहे</li>
              </ul>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Keyboard className="h-5 w-5 text-green-800" /> Keyboard shortcuts
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <tbody>
                  {SHORTCUTS.map((s, i) => (
                    <tr key={s.keys} className={i % 2 === 0 ? "bg-gray-50/60" : "bg-white"}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800 sm:text-sm">{s.keys}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-devanagari">{s.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 p-3 text-center">
                <p className="text-2xl font-extrabold text-green-800">800+</p>
                <p className="text-xs text-gray-500">Dictionary words</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-3 text-center">
                <p className="text-2xl font-extrabold text-green-800">100%</p>
                <p className="text-xs text-gray-500">Free & offline</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-3 text-center">
                <p className="text-2xl font-extrabold text-green-800">0</p>
                <p className="text-xs text-gray-500">Sign-up needed</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Engine: custom rule-based transliterator (MIT) + dictionary overrides. No paid API. All processing is local in your browser. PDF uses Noto Sans Devanagari with browser text shaping for correct conjuncts & matras.
            </p>
          </div>
        </div>

        {/* Examples */}
        <section id="examples" className="mt-10 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-devanagari">उदाहरणे — Examples</h2>
              <p className="mt-1 text-sm text-gray-500">Click any example to insert it into the editor.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.roman}
                type="button"
                onClick={() => insertExample(ex.roman, ex.devanagari)}
                className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-green-300 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{ex.label}</p>
                <p className="mt-2 font-mono text-sm text-gray-500">{ex.roman}</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 font-devanagari group-hover:text-green-800">{ex.devanagari}</p>
                <p className="mt-2 text-xs font-medium text-green-700">+ Insert into editor →</p>
              </button>
            ))}
          </div>
        </section>

        {/* SEO / about */}
        <section className="mt-10 rounded-3xl bg-green-800 p-6 text-white sm:p-8">
          <h2 className="text-xl font-bold font-devanagari">मराठी टायपिंगबद्दल — About Marathi Typing</h2>
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-green-50 sm:text-base md:grid-cols-2 font-devanagari">
            <p>
              मराठी टायपिंग हे मराठी भाषेत अचूक आणि वेगवान लिहिण्यासाठी अत्यंत सोपे ऑनलाइन साधन आहे. अनेकांना पारंपरिक देवनागरी कीबोर्ड वापरणे कठीण जाते; म्हणूनच इंग्रजी (Roman) अक्षरांतून थेट देवनागरी मराठीत रूपांतर करणारा हा स्मार्ट कीबोर्ड तयार केला आहे. तुम्ही फक्त नेहमीप्रमाणे इंग्रजी अक्षरांत टाइप करा — तुमचे शब्द, वाक्ये आणि संपूर्ण परिच्छेद लगेच मराठीत तयार होतील.
            </p>
            <p>
              हे साधन कोणत्याही नोंदणीशिवाय, पूर्णपणे विनामूल्य आणि कोणतेही ॲप डाउनलोड न करता वापरता येते. सर्व प्रक्रिया तुमच्या ब्राउझरमध्येच होत असल्यामुळे तुमचा मजकूर १००% सुरक्षित राहतो. विद्यार्थी निबंध, शासकीय अर्ज, पत्रव्यवहार, कथा, कविता आणि सोशल मीडिया पोस्ट लिहिण्यासाठी हे साधन मोबाईल व डेस्कटॉप दोन्हीवर उत्तम चालते.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#editor" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-green-900 hover:bg-green-50 font-devanagari">आताच टायपिंग सुरू करा →</a>
            <span className="rounded-full border border-green-600 px-4 py-2 text-sm font-medium text-green-100">MIT License • No API • Offline-ready</span>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:px-6">
          <p className="flex items-center gap-2 font-devanagari">
            <AppLogo className="h-6 w-6" />
            <span className="font-bold text-gray-800">मराठी टायपिंग</span> — English मध्ये टाइप करा, मराठीत लिहा!
          </p>
          <p className="text-xs">MIT License • Transliteration engine: custom rule-based (offline) • PDF: jsPDF + html2canvas (MIT) • Icons: Lucide (ISC)</p>
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
