import { Fragment } from "react";

function Accidentals({ text }: { text: string }) {
  if (!text) return null;
  return <span className="acc">{text.replace(/#/g, "♯").replace(/b/g, "♭")}</span>;
}

/** Lead-sheet style symbol: root letter full size, extensions raised, slash bass smaller. */
export function ChordSymbol({ symbol }: { symbol: string }) {
  const match = symbol.match(/^([A-G])([#b]{0,2})([^/]*)(?:\/([A-G])([#b]{0,2}))?$/);
  if (!match) return <span className="cs">{symbol}</span>;
  const [, letter, accidental, suffix, bassLetter, bassAccidental] = match;
  const minor = /^m(?!aj)/.test(suffix);
  const raised = minor ? suffix.slice(1) : suffix;
  return (
    <span className="cs">
      {letter}
      <Accidentals text={accidental} />
      {minor && <span className="q">m</span>}
      {raised && (
        <span className="sfx">
          {raised.split(/([#b])/).map((part, index) => part === "#" || part === "b"
            ? <Accidentals key={index} text={part} />
            : <Fragment key={index}>{part}</Fragment>)}
        </span>
      )}
      {bassLetter && <span className="slash">/{bassLetter}<Accidentals text={bassAccidental} /></span>}
    </span>
  );
}
