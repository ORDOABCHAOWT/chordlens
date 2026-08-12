import { useEffect, useState } from "react";
import { AudioLines, BookOpen, FlaskConical, ShieldCheck } from "lucide-react";
import { ChordLabWindow } from "../features/chord-lab/ChordLabWindow";
import { LibraryWindow } from "../features/library/LibraryWindow";
import { TranscribeWindow } from "../features/transcribe/TranscribeWindow";

type Workspace = "library" | "transcribe" | "chord-lab";

const workspaces = [
  { id: "library" as const, label: "Library", icon: BookOpen, shortcut: "⌘1" },
  { id: "transcribe" as const, label: "Transcribe", icon: AudioLines, shortcut: "⌘2" },
  { id: "chord-lab" as const, label: "Chord Lab", icon: FlaskConical, shortcut: "⌘3" },
];

function initialWorkspace(): Workspace {
  const saved = localStorage.getItem("chordlens-workspace");
  return saved === "library" || saved === "chord-lab" ? saved : "transcribe";
}

export function UnifiedApp() {
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);

  const selectWorkspace = (next: Workspace) => {
    setWorkspace(next);
    localStorage.setItem("chordlens-workspace", next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const next = event.key === "1" ? "library" : event.key === "2" ? "transcribe" : event.key === "3" || event.key.toLowerCase() === "k" ? "chord-lab" : null;
      if (!next) return;
      event.preventDefault();
      selectWorkspace(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="unified-app">
      <header className="app-toolbar">
        <div className="app-brand">
          <span className="app-mark"><AudioLines size={17} strokeWidth={1.7} /></span>
          <strong>ChordLens</strong>
        </div>
        <nav className="workspace-switcher" aria-label="Workspaces">
          {workspaces.map(({ id, label, icon: Icon, shortcut }) => (
            <button key={id} className={workspace === id ? "active" : ""} onClick={() => selectWorkspace(id)} aria-current={workspace === id ? "page" : undefined}>
              <Icon size={15} strokeWidth={1.6} />
              <span>{label}</span>
              <kbd>{shortcut}</kbd>
            </button>
          ))}
        </nav>
        <div className="local-status"><ShieldCheck size={14} /><span>Local</span></div>
      </header>
      <main className={`unified-workspace workspace-${workspace}`}>
        {workspace === "library" && <LibraryWindow />}
        {workspace === "transcribe" && <TranscribeWindow />}
        {workspace === "chord-lab" && <ChordLabWindow />}
      </main>
    </div>
  );
}
