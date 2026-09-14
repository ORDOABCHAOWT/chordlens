import { Guitar, ShieldCheck } from "lucide-react";
import { ChordLabWindow } from "../features/chord-lab/ChordLabWindow";

export function App() {
  return (
    <div className="unified-app">
      <header className="app-toolbar">
        <div className="app-brand">
          <span className="app-mark"><Guitar size={19} strokeWidth={1.7} /></span>
          <strong>ChordLens</strong>
          <span className="app-purpose">Chord Lab</span>
        </div>
        <div className="local-status"><ShieldCheck size={14} /><span>Local</span></div>
      </header>
      <main className="unified-workspace workspace-chord-lab">
        <ChordLabWindow />
      </main>
    </div>
  );
}
