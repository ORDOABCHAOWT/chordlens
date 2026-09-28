import { prettyAccidentals, spellPitchClass } from "./analysis";
import type { LensChord, Spelling, Tone } from "./analysis";

/** Plain-language notes shown under the chord: how it is built, how it sounds, how it is used. */
export interface ChordExplanation {
  build: string;
  sound?: string;
  usage?: string;
  inversion?: string;
}

interface Context {
  /** Root-position symbol, e.g. "F♯dim". */
  sym: string;
  root: string;
  /** Root name a number of semitones above this chord's root. */
  at: (semitones: number) => string;
}

// Keys are the canonical suffixes produced by analysis.ts (preferredSuffix).
const STRUCTURE: Record<string, string> = {
  "": "大三度上叠一个小三度，根音到五音是纯五度。",
  m: "小三度上叠一个大三度，和大三和弦只差一个三音。",
  dim: "两个小三度叠在一起；根音到五音是减五度（三全音），这是它不稳定的来源。",
  aug: "两个大三度叠在一起；根音到五音是增五度，整个和弦是对称的。",
  sus4: "用纯四度代替三音，所以没有大小调的色彩。",
  sus2: "用大二度代替三音，所以没有大小调的色彩。",
  "5": "只有根音和纯五度，没有三音。",
  "7": "大三和弦上再加一个小七度；三音和七音之间是三全音，张力就来自这里。",
  maj7: "大三和弦上再加一个大七度，七音和高八度的根音只差半音。",
  m7: "小三和弦上再加一个小七度。",
  m7b5: "减三和弦上再加一个小七度，也叫半减七和弦。",
  dim7: "三个小三度等距叠起，四个音把八度平均分成四份。",
  mMaj7: "小三和弦上加一个大七度。",
  "6": "大三和弦上加一个大六度。",
  m6: "小三和弦上加一个大六度。",
  "69": "大三和弦上同时加大六度和九音，不含七度。",
  m69: "小三和弦上同时加大六度和九音，不含七度。",
  add9: "大三和弦上加一个九音（高八度的二度），不含七度。",
  madd9: "小三和弦上加一个九音，不含七度。",
  "9": "属七和弦上再加一个大九度。",
  maj9: "大七和弦上再加一个大九度。",
  m9: "小七和弦上再加一个大九度。",
  "7sus4": "挂四和弦上再加一个小七度。",
  "9sus4": "挂四和弦上加小七度和九音。",
  "7b9": "属七和弦上加一个降九音，和根音只差半音。",
  "7#9": "属七和弦上加一个升九音，听起来像大三度和小三度同时出现。",
  "11": "根音、五音、小七度、九音和十一音叠成，省略了三音。",
  m11: "小九和弦上再加一个十一音。",
  "13": "属九和弦上再加一个十三音（高八度的六度）。",
  maj13: "大九和弦上再加一个十三音。",
  m13: "小十一和弦上再加一个十三音。",
  "maj7#11": "大七和弦上加一个升十一音，这是利底亚音阶的特征音。",
  "7#11": "属七和弦上加一个升十一音。",
  "7b5": "属七和弦把五音降半音。",
  "7#5": "属七和弦把五音升半音，也叫增属七和弦。",
  "maj7#5": "增三和弦上加一个大七度。",
  "m7#5": "小七和弦把五音升半音。",
  "7b13": "属七和弦上加一个降十三音。",
  alt7: "属七和弦加上降九、升九、升十一、降十三等变化音。",
  "7no5": "属七和弦省略了五音，功能不变。",
};

const SOUND: Record<string, string> = {
  "": "明亮、稳定、开阔，是最有「结束感」的和弦。",
  m: "柔和、忧郁、内敛，比大三和弦暗一些。",
  dim: "紧张、悬而未决，带点悬疑感，像一句没说完的话，耳朵会期待它往前走。",
  aug: "飘忽、失重、梦境般，既不稳定也不阴暗。",
  sus4: "悬空、中性、在等待，三音一出现就「落地」了。",
  sus2: "开阔、清新、空灵，没有明显的大小调情绪。",
  "5": "厚实、有力、中性，没有大小调色彩。",
  "7": "有明显的张力和「想往前走」的倾向，带一点蓝调味。",
  maj7: "温暖、梦幻、慵懒，有城市夜晚的氛围。",
  m7: "柔和、放松、圆润，比小三和弦少一分哀伤、多一分松弛。",
  m7b5: "暗淡、忧伤、带着不安，比减七和弦柔和。",
  dim7: "强烈的紧张和戏剧感，让人联想到老电影里的危急时刻。",
  mMaj7: "阴暗、神秘、带点不安，很有电影感。",
  "6": "甜美、复古、轻松，带点老电影和摇摆乐的味道。",
  m6: "暗中带亮，神秘、有异域感。",
  "69": "明亮、开阔、圆满。",
  m69: "暗而柔和，带波萨诺瓦的氛围。",
  add9: "明亮又带点清新和空气感。",
  madd9: "忧郁中带一点透明感，清冷而细腻。",
  "9": "饱满、带律动感，比属七更 funky。",
  maj9: "柔和、华丽、开阔，很「高级」。",
  m9: "温柔、深邃，带点夜晚的慵懒。",
  "7sus4": "有张力但不刺耳，悬着、等待解决。",
  "9sus4": "开阔、漂浮，属和弦的张力被柔化了。",
  "7b9": "紧张、偏暗，带点异域和戏剧色彩。",
  "7#9": "又脏又酷，大小三度同时出现带来冲突感。",
  "11": "开阔、漂浮，属和弦的张力被柔化了。",
  m11: "开阔、朦胧，像雾里的光。",
  "13": "饱满、明亮，带爵士和放克的味道。",
  maj13: "非常饱满、柔和，爵士感很强。",
  m13: "深邃、丰富，有爵士和灵魂乐的质感。",
  "maj7#11": "明亮、飘逸、梦幻（利底亚色彩）。",
  "7#11": "明亮又带张力，有一种「异色」感。",
  "7b5": "紧张、扭曲，带点爵士的不稳定感。",
  "7#5": "紧张、上扬，五音急着往上走。",
  "maj7#5": "梦幻、飘忽、略带不安。",
  "m7#5": "暗淡、朦胧，带一点不安。",
  "7b13": "紧张中带着忧郁，常把人带向小调。",
  alt7: "极度紧张、冲突强烈，迫切需要解决。",
  "7no5": "有明显的张力和「想往前走」的倾向，带一点蓝调味。",
};

const USAGE: Record<string, (c: Context) => string> = {
  "": (c) => `流行、民谣里最常见的主和弦和落脚点，常和 ${c.at(5)}、${c.at(7)} 组成 I–IV–V（${c.root} – ${c.at(5)} – ${c.at(7)}）。`,
  m: (c) => `小调歌曲的主和弦；它和 ${c.at(3)} 是一对关系大小调，在 ${c.at(3)} 大调的歌里常作第六级（vi）出现。`,
  dim: (c) => `常作经过和弦，向上半音解决到 ${c.at(1)} 或 ${c.at(1)}m（${c.at(-1)} → ${c.sym} → ${c.at(1)}）；也是 ${c.at(1)} 大调的第七级和弦。`,
  aug: (c) => `常作过渡，把五音往上推半音：${c.root} → ${c.sym} → ${c.at(5)}（或 ${c.root}6）。`,
  sus4: (c) => `挂留的四音通常回落到三音：${c.sym} → ${c.root}，流行和摇滚里常用来制造「欲扬先抑」。`,
  sus2: (c) => `常直接当作开阔的色彩和弦，也可以回到 ${c.root} 或 ${c.root}m；吉他扫弦里很常见。`,
  "5": () => "摇滚、金属的主力：失真音色下三度容易发浑，只弹根音和五度最干净有力。",
  "7": (c) => `最有推动力的和弦：通常解决到下方纯五度的 ${c.at(5)}（${c.sym} → ${c.at(5)}）；布鲁斯里也常直接当主和弦用。`,
  maj7: (c) => `爵士、City Pop、R&B 里常用来替代 ${c.root}，让主和弦或结尾更有氛围感。`,
  m7: (c) => `常作 ii–V–I 里的 ii 级：${c.sym} → ${c.at(5)}7 → ${c.at(10)}maj7。`,
  m7b5: (c) => `小调 ii–V–i 里的 ii 级：${c.sym} → ${c.at(5)}7 → ${c.at(10)}m。`,
  dim7: (c) => `常作经过和弦或代替属七，向上半音解决到 ${c.at(1)} 或 ${c.at(1)}m；四个音等距，同一个指型每移三品还是同一组音。`,
  mMaj7: (c) => `常出现在小调的下行线条里（${c.root}m → ${c.sym} → ${c.root}m7 → ${c.root}m6），也是影视配乐里的悬疑色彩。`,
  "6": () => "摇摆乐、老歌和爵士常用它结尾，比大七和弦更甜、更复古。",
  m6: (c) => `波萨诺瓦、探戈和爵士小调里常见，常代替 ${c.root}m 作主和弦。`,
  "69": (c) => `爵士和波萨诺瓦里常用的结束和弦，比 ${c.root}6 更开阔。`,
  m69: () => "爵士、波萨诺瓦里的小调主和弦，常作乐曲结尾。",
  add9: (c) => `流行、民谣吉他里常用来替代 ${c.root}，让同一个和弦更有空气感。`,
  madd9: (c) => `流行抒情曲里常代替 ${c.root}m，多一层清冷的色彩。`,
  "9": (c) => `放克、灵魂乐、布鲁斯常用的属和弦，功能和 ${c.root}7 相同，也解决到 ${c.at(5)}。`,
  maj9: (c) => `爵士、R&B、Neo-Soul 的常用主和弦，比 ${c.root}maj7 更柔和饱满。`,
  m9: (c) => `R&B、Neo-Soul、Lo-fi 里常见，比 ${c.root}m7 更有层次。`,
  "7sus4": (c) => `属七的挂留版本：常先停在 ${c.sym}，再到 ${c.root}7，最后解决到 ${c.at(5)}。`,
  "9sus4": (c) => `福音、Neo-Soul 里常用的属和弦形态，解决到 ${c.at(5)}。`,
  "7b9": (c) => `小调里 V 级的常用形态：${c.sym} → ${c.at(5)}m。`,
  "7#9": () => "著名的「亨德里克斯和弦」，布鲁斯摇滚和放克里很常见。",
  "11": (c) => `和 ${c.root}9sus4 是同一组音，福音、Neo-Soul 里常用，解决到 ${c.at(5)}。`,
  m11: () => "爵士、Neo-Soul 里常见的小和弦，常用四度叠置的弹法。",
  "13": (c) => `爵士、放克里饱满的属和弦，功能和 ${c.root}7 相同，解决到 ${c.at(5)}。`,
  maj13: () => "爵士里饱满的主和弦，常作乐曲结尾。",
  m13: () => "爵士、灵魂乐里饱满的小和弦，常作 ii 级或小调主和弦。",
  "maj7#11": () => "利底亚色彩的代表和弦，影视配乐和爵士里用来营造明亮的漂浮感。",
  "7#11": (c) => `常作不解决的属和弦色彩（利底亚属七），也可以代替 ${c.root}7。`,
  "7b5": (c) => `爵士里常作属和弦的变体，解决到 ${c.at(5)}。`,
  "7#5": (c) => `属和弦的变体，五音向上推进，解决到 ${c.at(5)}。`,
  "7b13": (c) => `常作小调里的 V 级，解决到 ${c.at(5)}m。`,
  alt7: (c) => `爵士里紧张度最高的属和弦，强烈要求解决到 ${c.at(5)} 或 ${c.at(5)}m。`,
  "7no5": (c) => `和 ${c.root}7 用法相同，通常解决到 ${c.at(5)}。`,
};

function inversionNote(chord: LensChord, tones: Tone[], c: Context): string | undefined {
  if (!chord.slash) return undefined;
  const bass = prettyAccidentals(chord.bassName);
  const tone = tones.find((item) => item.pc === chord.bassPc);
  if (!tone || !chord.pcs.includes(chord.bassPc)) return `低音 ${bass} 不属于和弦本身，额外带来一层色彩和张力。`;
  const number = Number(tone.degree.replace(/\D/g, ""));
  if (number === 3) return `第一转位（低音 ${bass} 是三音）：比原位更轻、更有流动感，常用来让低音线平滑地级进。`;
  if (number === 5) return `第二转位（低音 ${bass} 是五音）：稳定感较弱，常作经过，或出现在终止前（如 ${c.root}/${c.at(7)} → ${c.at(7)}7 → ${c.root}）。`;
  if (number === 7) return `第三转位（低音 ${bass} 是七音）：张力集中在低音上，低音通常会向下级进解决。`;
  return `低音 ${bass} 是和弦里的${tone.intervalName}，让和弦多了一层色彩。`;
}

export function explainChord(chord: LensChord, tones: Tone[], spelling: Spelling): ChordExplanation {
  const context: Context = {
    sym: prettyAccidentals(chord.rootName + chord.suffix),
    root: prettyAccidentals(chord.rootName),
    at: (semitones) => prettyAccidentals(spellPitchClass((((chord.rootPc + semitones) % 12) + 12) % 12, spelling)),
  };
  const added = tones.filter((tone) => !tone.isRoot && chord.pcs.includes(tone.pc)).map((tone) => tone.intervalName);
  return {
    build: STRUCTURE[chord.suffix] ?? `以 ${context.root} 为根音，叠加${added.join("、")}。`,
    sound: SOUND[chord.suffix],
    usage: USAGE[chord.suffix]?.(context),
    inversion: inversionNote(chord, tones, context),
  };
}
