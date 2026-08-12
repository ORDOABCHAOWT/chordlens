import { useEffect, useMemo, useState } from "react";
import { ChordLabWindow } from "../features/chord-lab/ChordLabWindow";
import { LibraryWindow } from "../features/library/LibraryWindow";
import { TranscribeWindow } from "../features/transcribe/TranscribeWindow";
import { useAppStore } from "./store";
import { loadSongs } from "../services/database";
import { UnifiedApp } from "./UnifiedApp";

type View = "app" | "design-preview" | "library" | "transcribe" | "chord-lab";

function readView(): View {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "library" || view === "transcribe" || view === "chord-lab") return view;
  if (view === "design-preview") return view;
  return "app";
}

export function App() {
  const view = useMemo(readView, []);
  const [browserLabOpen, setBrowserLabOpen] = useState(false);
  const hydrateSongs = useAppStore((state) => state.hydrateSongs);

  useEffect(() => {
    document.body.dataset.view = view;
    const handler = (event: KeyboardEvent) => {
      if (view === "transcribe" && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setBrowserLabOpen((value) => !value);
      }
      if (event.key === "Escape") setBrowserLabOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  useEffect(() => {
    void loadSongs().then(hydrateSongs).catch(() => undefined);
  }, [hydrateSongs]);

  if (view === "library") return <div className="single-view"><LibraryWindow /></div>;
  if (view === "chord-lab") return <div className="single-view"><ChordLabWindow /></div>;
  if (view === "transcribe") return <div className="single-view"><TranscribeWindow />{browserLabOpen && <div className="browser-lab-overlay"><ChordLabWindow /></div>}</div>;
  if (view === "app") return <UnifiedApp />;

  return (
    <div className="design-stage">
      <LibraryWindow />
      <TranscribeWindow />
      <ChordLabWindow />
    </div>
  );
}
