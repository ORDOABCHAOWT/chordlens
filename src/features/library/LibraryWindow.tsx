import {
  AudioLines, Clock3, FolderLock, FolderPlus, MoreHorizontal, Search, Settings,
  Sparkles, Star, Sun, Trash2,
} from "lucide-react";
import { demoSongs } from "../../data/demo";
import { WindowShell } from "../../components/WindowShell";

const nav = [
  { label: "All Songs", icon: AudioLines, active: true },
  { label: "Recent", icon: Clock3 },
  { label: "Favorites", icon: Star },
  { label: "Trash", icon: Trash2 },
];

const collections = [
  ["Acoustic Set", "24"], ["Band Repertoire", "42"], ["Song Ideas", "15"], ["Practice", "9"],
];

export function LibraryWindow() {
  return (
    <WindowShell className="library-window" title="Library">
      <div className="library-search">
        <Search size={14} />
        <span>Search Library</span>
        <kbd>⌘F</kbd>
      </div>
      <div className="library-layout">
        <aside className="library-sidebar">
          <nav>
            {nav.map(({ label, icon: Icon, active }) => (
              <button key={label} className={active ? "active" : ""}><Icon size={13} strokeWidth={1.55} /><span>{label}</span></button>
            ))}
          </nav>
          <div className="sidebar-heading">COLLECTIONS</div>
          <div className="collections-list">
            {collections.map(([name, count], index) => (
              <button key={name}><span className={`collection-dot dot-${index}`}><FolderLock size={10} /></span><span>{name}</span><small>{count}</small></button>
            ))}
            <button className="new-collection"><FolderPlus size={12} /><span>New Collection</span></button>
          </div>
          <div className="sidebar-footer"><button><Settings size={14} /></button><button><Sun size={14} /></button></div>
        </aside>
        <main className="library-content">
          <div className="section-title"><strong>Recent</strong><button>See All</button></div>
          <div className="recent-list">
            {demoSongs.map((song, index) => (
              <button className="recent-song" key={song.id}>
                <span className={`artwork artwork-${index}`} />
                <span className="song-meta"><strong>{song.title}</strong><small>{song.artist}</small></span>
                <span className="duration">{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, "0")}</span>
                <MoreHorizontal size={13} />
              </button>
            ))}
          </div>
          <div className="section-title projects-title"><strong>Projects</strong></div>
          <button className="new-project-card"><span><Sparkles size={14} /></span>New Project</button>
          <div className="project-grid">
            <button><span className="project-art project-a" /><strong>Acoustic Set</strong><small>24 songs</small></button>
            <button><span className="project-art project-b" /><strong>Band Repertoire</strong><small>42 songs</small></button>
          </div>
          <div className="section-title favorites-title"><strong>Favorites</strong><button>See All</button></div>
          <div className="favorite-row">
            <button><span className="favorite-art artwork-2" /><span><strong>Bloom</strong><small>Paper Lanterns</small></span></button>
            <button><span className="favorite-art artwork-0" /><span><strong>Home Again</strong><small>Jade Hollow</small></span></button>
          </div>
        </main>
      </div>
    </WindowShell>
  );
}
