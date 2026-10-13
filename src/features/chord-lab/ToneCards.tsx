import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { prettyAccidentals } from "../../music/analysis";
import type { Tone } from "../../music/analysis";
import { T } from "./strings";

interface ToneCardsProps {
  /** Root first. */
  tones: Tone[];
  hotPc: number | null;
  onTone: (pc: number) => void;
  /** Shows the notes read on this root while a card is held over the first place; null puts the real chord back. */
  onRootPreview: (pc: number | null) => void;
  onRoot: (pc: number) => void;
}

interface Drag {
  pc: number;
  pointer: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  /** Card order when the drag began; its first entry is the root to return to. */
  order: number[];
  candidate: number;
  active: boolean;
  places: Array<{ x: number; y: number }>;
}

const GLIDE = "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * The chord tones as cards. Clicking one plays it; dragging one to the front makes it the root.
 * While a card is held there the whole window previews the result, and letting go keeps it.
 */
export function ToneCards({ tones, hotPc, onTone, onRootPreview, onRoot }: ToneCardsProps) {
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const stop = useRef<() => void>(() => {});
  const movedFrom = useRef<Map<number, DOMRect> | null>(null);
  const dropped = useRef<{ pc: number; from: DOMRect } | null>(null);
  const settleTimer = useRef(0);
  const skipClick = useRef(false);
  const handlers = useRef({ onRootPreview, onRoot });
  const [held, setHeld] = useState<{ pc: number; target: boolean } | null>(null);

  useEffect(() => { handlers.current = { onRootPreview, onRoot }; });

  const slotOf = (pc: number) => row.current?.querySelector<HTMLElement>(`[data-slot="${pc}"]`) ?? null;

  /** Keeps the held card under the pointer, wherever its slot currently sits in the row. */
  const follow = () => {
    const state = drag.current;
    const box = row.current;
    const slot = state?.active ? slotOf(state.pc) : null;
    const card = slot?.firstElementChild as HTMLElement | null;
    if (!state || !box || !slot || !card) return;
    const origin = box.getBoundingClientRect();
    card.style.transform = `translate(${state.x - state.grabX - origin.left - slot.offsetLeft}px, ${state.y - state.grabY - origin.top - slot.offsetTop}px) scale(1.04)`;
  };

  /** Remembers where the other cards are, so they can slide to their new places after the next render. */
  const remember = (except: number) => {
    const rects = new Map<number, DOMRect>();
    row.current?.querySelectorAll<HTMLElement>("[data-slot]").forEach((slot) => {
      const pc = Number(slot.dataset.slot);
      if (pc !== except) rects.set(pc, slot.getBoundingClientRect());
    });
    movedFrom.current = rects;
  };

  useLayoutEffect(() => {
    const from = movedFrom.current;
    movedFrom.current = null;
    from?.forEach((before, pc) => {
      const slot = slotOf(pc);
      if (!slot) return;
      slot.style.transition = "none";
      slot.style.transform = "";
      const now = slot.getBoundingClientRect();
      if (before.left !== now.left || before.top !== now.top) {
        slot.style.transform = `translate(${before.left - now.left}px, ${before.top - now.top}px)`;
        slot.getBoundingClientRect();
      }
      slot.style.transition = "";
      slot.style.transform = "";
    });
    follow();

    const drop = dropped.current;
    dropped.current = null;
    const card = drop ? slotOf(drop.pc)?.firstElementChild as HTMLElement | null : null;
    if (!drop || !card) return;
    // The card glides from where it was let go to its place in the row.
    const to = card.getBoundingClientRect();
    card.style.transition = "none";
    card.style.zIndex = "5";
    card.style.transform = `translate(${drop.from.left - to.left}px, ${drop.from.top - to.top}px)`;
    card.getBoundingClientRect();
    card.style.transition = GLIDE;
    card.style.transform = "";
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => { card.style.transition = ""; card.style.zIndex = ""; }, 220);
  });

  useEffect(() => () => {
    stop.current();
    window.clearTimeout(settleTimer.current);
    document.body.classList.remove("is-dragging");
  }, []);

  const finish = (keep: boolean) => {
    const state = drag.current;
    drag.current = null;
    stop.current();
    if (!state?.active) return;
    document.body.classList.remove("is-dragging");
    skipClick.current = true;
    window.setTimeout(() => { skipClick.current = false; }, 0);
    const card = slotOf(state.pc)?.firstElementChild as HTMLElement | null;
    remember(state.pc);
    if (card) {
      dropped.current = { pc: state.pc, from: card.getBoundingClientRect() };
      card.style.transform = "";
    }
    setHeld(null);
    if (keep && state.candidate !== state.order[0]) handlers.current.onRoot(state.candidate);
    else handlers.current.onRootPreview(null);
  };

  const move = (event: PointerEvent) => {
    const state = drag.current;
    const box = row.current;
    if (!state || !box || event.pointerId !== state.pointer) return;
    state.x = event.clientX;
    state.y = event.clientY;
    if (!state.active) {
      if (Math.hypot(state.x - state.startX, state.y - state.startY) < 5) return;
      state.active = true;
      // A drag can begin while the last one is still gliding home: put every card where it belongs first.
      window.clearTimeout(settleTimer.current);
      box.querySelectorAll<HTMLElement>("[data-slot]").forEach((slot) => {
        const card = slot.firstElementChild as HTMLElement;
        slot.style.transition = "none";
        card.style.transition = "";
        card.style.zIndex = "";
        card.style.transform = "";
        slot.getBoundingClientRect();
        slot.style.transition = "";
      });
      state.places = Array.from(box.querySelectorAll<HTMLElement>("[data-slot]"), (slot) => ({ x: slot.offsetLeft, y: slot.offsetTop }));
      document.body.classList.add("is-dragging");
      setHeld({ pc: state.pc, target: false });
    }
    const origin = box.getBoundingClientRect();
    const left = state.x - state.grabX - origin.left;
    const top = state.y - state.grabY - origin.top;
    let nearest = 0;
    state.places.forEach((place, index) => {
      if (Math.hypot(left - place.x, top - place.y) < Math.hypot(left - state.places[nearest].x, top - state.places[nearest].y)) nearest = index;
    });
    // Only the first place matters: the card that ends up there becomes the root.
    const candidate = nearest === 0 ? state.pc : state.order[0] === state.pc ? state.order[1] : state.order[0];
    if (candidate !== state.candidate) {
      state.candidate = candidate;
      remember(state.pc);
      setHeld({ pc: state.pc, target: candidate === state.pc && candidate !== state.order[0] });
      handlers.current.onRootPreview(candidate === state.order[0] ? null : candidate);
    }
    follow();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current || tones.length < 2) return;
    const card = (event.target as Element).closest<HTMLElement>(".tone");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const order = tones.map((tone) => tone.pc);
    const pointer = event.pointerId;
    drag.current = {
      pc: Number(card.dataset.pc), pointer, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, order, candidate: order[0], active: false, places: [],
    };
    const up = (released: PointerEvent) => { if (released.pointerId === pointer) finish(true); };
    const cancel = (cancelled: PointerEvent) => { if (cancelled.pointerId === pointer) finish(false); };
    const escape = (pressed: KeyboardEvent) => {
      if (pressed.key !== "Escape" || !drag.current?.active) return;
      pressed.stopPropagation();
      finish(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape, true);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape, true);
      stop.current = () => {};
    };
  };

  return (
    <div ref={row} className={`tones${tones.length > 1 ? " can-drag" : ""}`} role="group" aria-label={T.chordTones} onPointerDown={onPointerDown}>
      {tones.map((tone) => {
        const holding = held?.pc === tone.pc;
        return (
          <div key={tone.pc} data-slot={tone.pc} className={`tone-slot${holding ? " is-source" : ""}${holding && held?.target ? " is-target" : ""}`}>
            <button
              type="button"
              className={`tone s-${tone.slot}${tone.isRoot ? " is-root" : ""}${hotPc === tone.pc ? " hot" : ""}${holding ? " dragging" : ""}`}
              data-pc={tone.pc}
              aria-label={T.playTone(prettyAccidentals(tone.name), tone.intervalName)}
              aria-description={tones.length > 1 ? T.dragTone : undefined}
              onClick={() => { if (!skipClick.current) onTone(tone.pc); }}
            >
              <span className="tone-deg">{tone.degree}</span>
              <span className="tone-note">{prettyAccidentals(tone.name)}</span>
              <span className="tone-name">{tone.intervalName}</span>
              {tone.isBass && tones.length > 1 && <span className="tone-tag">{T.bass}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
