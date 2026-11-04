import { useState } from "react";
import { Delete, CornerDownLeft, Space } from "lucide-react";

type Props = {
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onSpace: () => void;
  mode: "marathi" | "english";
};

const MARATHI_ROWS: string[][] = [
  ["क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ"],
  ["ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न"],
  ["प", "फ", "ब", "भ", "म", "य", "र", "ल", "व", "श"],
  ["ष", "स", "ह", "ळ", "क्ष", "ज्ञ", "त्र"],
];

const VOWELS = ["अ", "आ", "इ", "ई", "उ", "ऊ", "ऋ", "ए", "ऐ", "ओ", "औ", "अं", "अः", "ॲ", "ऑ"];
const MATRAS = ["ं", "ः", "ँ", "्", "ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ॅ", "ॉ"];
const NUMBERS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const PUNCT = ["।", ",", ".", "?", "!", ";", ":", "(", ")", '"', "'", "-", "—", "«", "»"];

const ENGLISH_ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

export default function OnScreenKeyboard({ onInsert, onBackspace, onEnter, onSpace, mode }: Props) {
  const [tab, setTab] = useState<"consonants" | "vowels" | "matras" | "numbers" | "punct">("consonants");

  const Key = ({ label, onClick, wide = false, accent = false }: { label: React.ReactNode; onClick: () => void; wide?: boolean; accent?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      className={`${wide ? "flex-[2]" : "flex-1"} min-w-0 select-none rounded-lg border px-1 py-2.5 sm:py-3 text-base sm:text-lg font-medium transition active:scale-95 ${
        accent
          ? "border-green-800 bg-green-800 text-white hover:bg-green-900"
          : "border-gray-200 bg-white text-gray-800 hover:border-green-300 hover:bg-green-50 active:bg-green-100"
      } font-devanagari`}
    >
      {label}
    </button>
  );

  if (mode === "english") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">English Keyboard</span>
          <span className="text-xs text-gray-400">Tap keys to type</span>
        </div>
        <div className="space-y-2">
          {ENGLISH_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1.5 sm:gap-2">
              {ri === 1 && <span className="w-2 sm:w-4" />}
              {row.map((k) => (
                <Key key={k} label={k.toUpperCase()} onClick={() => onInsert(k)} />
              ))}
              {ri === 1 && <span className="w-2 sm:w-4" />}
            </div>
          ))}
          <div className="flex gap-1.5 sm:gap-2">
            <Key label={<Space className="mx-auto h-5 w-5" />} onClick={onSpace} wide />
            <Key label={<Delete className="mx-auto h-5 w-5" />} onClick={onBackspace} />
            <Key label={<CornerDownLeft className="mx-auto h-5 w-5" />} onClick={onEnter} accent />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">मराठी कीबोर्ड • On-screen keyboard</span>
        <div className="flex rounded-full border border-gray-200 bg-white p-1">
          {(
            [
              ["consonants", "व्यंजने"],
              ["vowels", "स्वर"],
              ["matras", "मात्रा"],
              ["numbers", "अंक"],
              ["punct", "चिन्हे"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
                tab === id ? "bg-green-800 text-white" : "text-gray-600 hover:text-green-800"
              } font-devanagari`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "consonants" && (
        <div className="space-y-2">
          {MARATHI_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1.5 sm:gap-2">
              {row.map((k) => (
                <Key key={k} label={k} onClick={() => onInsert(k)} />
              ))}
            </div>
          ))}
        </div>
      )}
      {tab === "vowels" && (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 sm:gap-2">
          {VOWELS.map((k) => (
            <Key key={k} label={k} onClick={() => onInsert(k)} />
          ))}
        </div>
      )}
      {tab === "matras" && (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 sm:gap-2">
          {MATRAS.map((k) => (
            <Key key={k} label={k} onClick={() => onInsert(k)} />
          ))}
        </div>
      )}
      {tab === "numbers" && (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
          {NUMBERS.map((k) => (
            <Key key={k} label={k} onClick={() => onInsert(k)} />
          ))}
        </div>
      )}
      {tab === "punct" && (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 sm:gap-2">
          {PUNCT.map((k) => (
            <Key key={k} label={k} onClick={() => onInsert(k)} />
          ))}
        </div>
      )}

      {tab !== "matras" && (
        <div className="mt-2 flex flex-wrap gap-1 sm:gap-1.5 rounded-xl bg-white/80 p-1.5 border border-gray-200/80">
          {["ं", "ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "्", "ः", "ँ"].map((m) => (
            <Key key={m} label={m === "ं" ? "ं (अनुस्वार)" : m} onClick={() => onInsert(m)} />
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-1.5 sm:gap-2">
        <Key label={<Space className="mx-auto h-5 w-5" />} onClick={onSpace} wide />
        <Key label={<Delete className="mx-auto h-5 w-5" />} onClick={onBackspace} />
        <Key label={<CornerDownLeft className="mx-auto h-5 w-5" />} onClick={onEnter} accent />
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">
        Tip: Type in English letters (e.g. <span className="font-medium text-gray-600">namaskar</span>) — it converts live. Use this keyboard for direct Devanagari.
      </p>
    </div>
  );
}
