import type { EventType, Team } from "./stats";

// Voice and quick-entry: turns a sentence such as "Daniel scores 2 assisted by Joe" into plays.
// Pure text-in, plays-out logic (the browser's speech recognition supplies the text), so it can be
// tested without a microphone. Nothing is recorded here: the screen shows what was understood and
// the scorekeeper confirms it.

export type VoicePlayer = {
  id: number;
  name: string;
  team: Team;
  onCourt: boolean;
};
export type VoiceContext = {
  players: VoicePlayer[];
  /** Nicknames people use out loud ("Chibikes" for Daniel Okoye). */
  aliases?: { alias: string; id: number }[];
  /** Team of the last shooter whose miss has no rebound yet; lets "Joe rebounds" be offensive or defensive. */
  lastMissTeam?: Team | null;
};

/** A player mentioned in the sentence. `id` is null when it couldn't be settled (pick from `options`). */
export type Ref = { heard: string; id: number | null; options: number[] };
/** 1 = free throw, 2 = two-pointer, 3 = three-pointer. */
export type Shot = 1 | 2 | 3;

export type Play =
  | { kind: "make"; shooter: Ref; shot: Shot | null; assist?: Ref }
  | { kind: "miss"; shooter: Ref; shot: Shot | null; rebound?: Ref }
  | { kind: "rebound"; player: Ref; off: boolean | null }
  | { kind: "assist"; player: Ref }
  | { kind: "steal"; player: Ref; from?: Ref }
  | {
      kind: "block";
      blocker: Ref;
      shooter?: Ref;
      shot: Shot | null;
      rebound?: Ref;
    }
  | { kind: "turnover"; player: Ref }
  | { kind: "foul"; player: Ref }
  | { kind: "deflection"; player: Ref }
  | { kind: "sub"; out: Ref; in: Ref }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "timeout"; team: Team | null; player?: Ref }
  | { kind: "undo" };

export type Draft = { playerId: number; type: EventType; team?: Team };

// ---- name matching ---------------------------------------------------------------------------

const STOP = new Set(
  (
    "a an the and then also next after that this it its his her their he she they by from for on in out of to with at as is are was " +
    "score scores scored make makes made hit hits sink sinks drain drains nail nails bucket buckets basket shot shots point points " +
    "miss misses missed brick bricks airball clank clanks rim no good assist assists assisted dime dimes dished pass passed " +
    "rebound rebounds board boards offensive defensive offense defense off def steal steals stole block blocks blocked swat swats reject rejects " +
    "turnover turnovers turns over loses lost ball foul fouls fouled commits deflect deflects deflection tip tips " +
    "sub subs subbing substitution comes come coming checks check into timeout time call calls called team pause stop clock resume play " +
    "undo scratch cancel remove last one two three free throw throws layup dunk jumper triple pointer three"
  ).split(/\s+/),
);

/** Words the sentence parser treats as basketball vocabulary, so they can't be someone's nickname. */
export const isReservedWord = (word: string) => STOP.has(word.toLowerCase());

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}
const ratio = (a: string, b: string) =>
  a || b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 1;

/** Rough "sounds like" form: consonant skeleton, so Utibe/Utebe and Daniel/Danielle line up. */
function skeleton(s: string): string {
  return s
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/ch/g, "c")
    .replace(/sh/g, "s")
    .replace(/th/g, "t")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/[aeiouyw]/g, "")
    .replace(/(.)\1+/g, "$1");
}

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** 0..1: how well what was heard matches a name. Very short words must match exactly. */
function similarity(heard: string, name: string): number {
  if (!heard || !name) return 0;
  if (heard === name) return 1;
  if (heard.length < 3 || name.length < 3) return 0;
  if (name.startsWith(heard) && heard.length >= 3) return 0.86; // "dani" for Daniel, "eph" for Ephraim
  const sh = skeleton(heard);
  const sn = skeleton(name);
  const phonetic =
    sh && sh === sn && Math.min(heard.length, name.length) >= 4
      ? 0.9
      : ratio(sh, sn) * 0.8;
  return Math.max(ratio(heard, name), phonetic);
}

const MATCH_MIN = 0.8;
const TIE_BAND = 0.06;

type Candidate = { start: number; end: number; score: number; ref: Ref };

/** Words in the sentence that name players, with who they probably are. */
function findMentions(words: string[], ctx: VoiceContext): Candidate[] {
  const names = ctx.players.map((p) => {
    const parts = p.name.toLowerCase().split(/\s+/).map(clean).filter(Boolean);
    const nick = (ctx.aliases ?? [])
      .filter((a) => a.id === p.id)
      .map((a) => clean(a.alias))
      .filter(Boolean);
    return { p, forms: [...new Set([parts.join(""), ...parts, ...nick])] };
  });

  const found: Candidate[] = [];
  for (let i = 0; i < words.length; i++) {
    if (STOP.has(words[i]) || !/^[a-z]/.test(words[i])) continue;
    for (let len = Math.min(3, words.length - i); len >= 1; len--) {
      const span = words.slice(i, i + len);
      if (len > 1 && span.some((w) => STOP.has(w))) continue;
      const heard = clean(span.join(""));
      const scored = names
        .map((n) => ({
          p: n.p,
          score: Math.max(...n.forms.map((f) => similarity(heard, f))),
        }))
        .filter((x) => x.score >= MATCH_MIN)
        .sort((a, b) => b.score - a.score);
      if (scored.length === 0) continue;

      const near = scored.filter((x) => x.score >= scored[0].score - TIE_BAND);
      let id: number | null = near.length === 1 ? near[0].p.id : null;
      if (id === null) {
        // Several players fit: prefer the one on court when exactly one is.
        const onCourt = near.filter((x) => x.p.onCourt);
        if (onCourt.length === 1) id = onCourt[0].p.id;
      }
      const options = [...near]
        .sort((a, b) => Number(b.p.onCourt) - Number(a.p.onCourt))
        .map((x) => x.p.id);
      found.push({
        start: i,
        end: i + len,
        score: scored[0].score,
        ref: { heard: span.join(" "), id, options },
      });
      break; // longest span that matches wins for this start
    }
  }

  // Keep the strongest, longest, non-overlapping mentions.
  found.sort(
    (a, b) =>
      b.score - a.score ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  );
  const taken: Candidate[] = [];
  for (const c of found) {
    if (!taken.some((t) => c.start < t.end && t.start < c.end)) taken.push(c);
  }
  return taken.sort((a, b) => a.start - b.start);
}

// ---- understanding the sentence ---------------------------------------------------------------

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const mark = (n: number) => `mention${LETTERS[n]}`;
const MENTION = /\bmention([a-z])\b/g;
const idxOf = (letter: string) => LETTERS.indexOf(letter);

const WORD_FIXES: [RegExp, string][] = [
  [/\b(3|three) ?-? ?(pointers?|pt|pts|point)\b/g, "three"],
  [/\b(2|two) ?-? ?(pointers?|pt|pts|point)\b/g, "two"],
  [/\bfree[- ]throws?\b/g, "freethrow"],
  [/\bfoul shots?\b/g, "freethrow"],
  [/\btime[- ]?outs?\b/g, "timeout"],
  [/\bun ?do\b/g, "undo"],
  // Commands that speech engines commonly mishear.
  [
    /\b(?:cause|pass|pose|paws|fause|laws|pas) the (?:clock|club|glock)\b/g,
    "pause the clock",
  ],
  [/\b(?:fowl|follow|foal|file|fall|full|fell)\s+on\b/g, "foul on"],
  [/\btime (?:of|off|up) (?=team\b)/g, "timeout "],
  [/\bre[- ]?bounds?\b/g, "rebound"],
  [/\bturn[- ]?overs?\b/g, "turnover"],
];

function detectShot(c: string): Shot | null {
  if (/\b(freethrow|charity|ft)\b/.test(c)) return 1;
  if (/\b(3|three|triple|trey|downtown|deep)\b/.test(c)) return 3;
  if (
    /\b(2|two|layup|lay up|dunk|jumper|mid ?range|floater|bucket|basket)\b/.test(
      c,
    )
  )
    return 2;
  if (/\b(1|one)\b/.test(c)) return 1;
  return null;
}

const refs = (c: string, ments: Ref[]): Ref[] =>
  [...c.matchAll(MENTION)].map((m) => ments[idxOf(m[1])]).filter(Boolean);

const copy = (r: Ref): Ref => ({ ...r, options: [...r.options] });

const R = {
  undo: /\b(undo|scratch that|cancel that|take that back|remove that|remove last)\b/,
  resume:
    /\b(resume|play on|start the clock|start clock|unpause|restart the clock|clock on)\b/,
  pause: /\b(pause|stop the clock|stop clock|hold the clock|clock off)\b/,
  timeout: /\btimeout\b/,
  sub: /\b(sub|subs|subbing|substitution|substitutes?|comes? in|coming in|checks? in|in for|out for|subs? out)\b/,
  steal:
    /\b(steal|steals|stole|stolen|picks? (?:his|her|their) pocket|takes? the ball)\b/,
  block: /\b(block|blocks|blocked|swat|swats|swatted|rejects?|rejected)\b/,
  rebound:
    /\b(rebound|rebounds|rebounded|board|boards|boarded|grabs? the (?:board|rebound)|gets? the (?:board|rebound)|putback|put back)\b/,
  miss: /\b(miss|misses|missed|brick|bricks|bricked|airball|air ball|clank|clanks|no good|rim out|off the rim)\b/,
  make: /\b(score|scores|scored|make|makes|made|hit|hits|sink|sinks|sank|drain|drains|drained|knock down|knocks down|nail|nails|nailed|bucket|buckets|splash|splashes)\b/,
  assist:
    /\b(assist|assists|assisted|dime|dimes|dimed|dished|feeds?|sets? up)\b/,
  turnover:
    /\b(turnover|turns? it over|turns? the ball over|loses? the ball|lost the ball|travel|travels|traveled|travelled|travelling|fumbles?|bad pass|throws? it away|gives? it away|carries|double dribble)\b/,
  foul: /\b(foul|fouls|fouled|commits? a foul)\b/,
  deflection: /\b(deflect|deflects|deflected|deflection|tipped|batted)\b/,
};

function parseClause(c: string, ments: Ref[]): Play | null {
  const rs = refs(c, ments).map(copy);
  const first = rs[0];
  const offOrDef = (): boolean | null =>
    /\b(offensive|offence|oreb|o reb|off reb|putback|put back)\b/.test(c)
      ? true
      : /\b(defensive|defence|dreb|d reb|def reb)\b/.test(c)
        ? false
        : null;

  if (R.undo.test(c)) return { kind: "undo" };
  if (R.timeout.test(c)) {
    const team = /\bteam a\b|\ba team\b/.test(c)
      ? "A"
      : /\bteam b\b|\bb team\b/.test(c)
        ? "B"
        : null;
    return { kind: "timeout", team, ...(first ? { player: first } : {}) };
  }
  if (R.resume.test(c)) return { kind: "resume" };
  if (R.pause.test(c)) return { kind: "pause" };

  // Substitution: "A comes in for B", "A subs out for B", "sub A for B", "A out B in".
  if (R.sub.test(c) || /\bmention[a-z] out mention[a-z] in\b/.test(c)) {
    if (rs.length >= 2) {
      const outFirst =
        /\bmention[a-z] (subs? out|out for|going out|out)\b/.test(c) &&
        !/\bin for\b/.test(c);
      return outFirst
        ? { kind: "sub", out: rs[0], in: rs[1] }
        : { kind: "sub", in: rs[0], out: rs[1] };
    }
    return null;
  }

  if (R.steal.test(c) && first) {
    // "A steals from B" or "steal by A from B"
    return { kind: "steal", player: rs[0], ...(rs[1] ? { from: rs[1] } : {}) };
  }

  // A rebounder named in the same sentence as a miss or block: "misses a three, rebound William".
  const rebM =
    c.match(
      /\b(?:rebound|rebounded|board|boarded|putback)(?: by)?\s+mention([a-z])\b/,
    ) ??
    c.match(
      /\bmention([a-z]) (?:rebounds|rebounded|boards|boarded|grabs the (?:board|rebound)|gets the (?:board|rebound))\b/,
    );
  const rebRef = rebM ? copy(ments[idxOf(rebM[1])]) : undefined;
  const others = rebM
    ? [...c.matchAll(MENTION)]
        .filter((m) => m[1] !== rebM[1])
        .map((m) => copy(ments[idxOf(m[1])]))
    : rs;

  if (R.block.test(c) && first) {
    const shot = detectShot(c.replace(R.block, " "));
    const passive = /\bblocked by\b/.test(c); // "B blocked by A"
    const rebound = rebRef ? { rebound: rebRef } : {};
    if (others.length >= 2)
      return passive
        ? {
            kind: "block",
            blocker: others[1],
            shooter: others[0],
            shot,
            ...rebound,
          }
        : {
            kind: "block",
            blocker: others[0],
            shooter: others[1],
            shot,
            ...rebound,
          };
    return { kind: "block", blocker: others[0] ?? rs[0], shot, ...rebound };
  }

  if (R.miss.test(c) && others[0])
    return {
      kind: "miss",
      shooter: others[0],
      shot: detectShot(c) ?? 2,
      ...(rebRef ? { rebound: rebRef } : {}),
    };

  if (R.rebound.test(c) && first)
    return { kind: "rebound", player: rs[0], off: offOrDef() };

  // "A assists B (for 2)": the passer comes first.
  const passerFirst =
    rs.length >= 2 &&
    /\bmention[a-z] (assists|dimes|dimed|feeds?|sets? up|finds?)\b/.test(c);
  if (passerFirst)
    return { kind: "make", shooter: rs[1], shot: detectShot(c), assist: rs[0] };

  if (R.make.test(c) && first) {
    // "assisted by B", "assist from B", "off a pass from B", "dime from B"
    const m =
      c.match(
        /\b(?:assist(?:ed)?|dime[sd]?|dished|passed|pass|set up|feed|feeds)\s+(?:by|from)\s+mention([a-z])\b/,
      ) ??
      c.match(/\boff (?:a |the )?(?:pass|dime|feed) from mention([a-z])\b/);
    const assister = m ? copy(ments[idxOf(m[1])]) : undefined;
    const shooter = rs.find((r) => r.heard !== assister?.heard) ?? rs[0];
    return {
      kind: "make",
      shooter,
      shot: detectShot(c),
      ...(assister ? { assist: assister } : {}),
    };
  }

  if (R.assist.test(c) && first) return { kind: "assist", player: rs[0] };
  if (R.turnover.test(c) && first) return { kind: "turnover", player: rs[0] };
  if (R.foul.test(c) && first) return { kind: "foul", player: rs[0] };
  if (R.deflection.test(c) && first)
    return { kind: "deflection", player: rs[0] };

  // Shorthand: "Daniel three", "Joe two", "Whyte free throw".
  const shot = detectShot(c);
  if (first && shot !== null && rs.length === 1)
    return { kind: "make", shooter: rs[0], shot };
  return null;
}

/** Splits a masked sentence into clauses at punctuation, "then", and "and" before a new name. */
function clauses(masked: string): string[] {
  const keepSubPair = masked.replace(
    /\b(mention[a-z] out),\s*(mention[a-z] in)\b/g,
    "$1 $2",
  );
  return keepSubPair
    .split(
      /\s*[,.;!?]\s*|\s+\b(?:and then|then|also|next|after that)\b\s+|\s+and\s+(?=mention|undo|pause|resume|timeout)/,
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

export type Parsed = { plays: Play[]; unparsed: string[]; heard: string };

export function parseVoice(text: string, ctx: VoiceContext): Parsed {
  let s = text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9\s,.;!?-]/g, " ")
    .replace(/-/g, " ");
  for (const [re, to] of WORD_FIXES) s = s.replace(re, to);
  // Speech engines often put a comma after a linking word ("assisted by, Joe"); it isn't a break.
  s = s.replace(/\b(by|from|for|to|of|with)\s*[,;]/g, "$1");

  const tokens = s.match(/[a-z0-9]+|[,.;!?]/g) ?? [];
  const wordIdx: number[] = [];
  tokens.forEach((t, i) => /[a-z0-9]/.test(t) && wordIdx.push(i));
  const words = wordIdx.map((i) => tokens[i]);

  const ments = findMentions(words, ctx);
  const byStart = new Map(ments.map((m, k) => [m.start, { m, k }]));
  const out: string[] = [];
  for (let w = 0, ti = 0; ti < tokens.length; ti++) {
    if (!/[a-z0-9]/.test(tokens[ti])) {
      out.push(tokens[ti]);
      continue;
    }
    const hit = byStart.get(w);
    if (hit) {
      out.push(mark(hit.k));
      ti += hit.m.end - hit.m.start - 1;
      w = hit.m.end;
    } else {
      out.push(tokens[ti]);
      w++;
    }
  }

  const plays: Play[] = [];
  const unparsed: string[] = [];
  const refList = ments.map((m) => m.ref);
  for (const c of clauses(out.join(" "))) {
    const play = parseClause(c, refList);
    if (play) plays.push(play);
    else
      unparsed.push(
        c.replace(MENTION, (_, l) => refList[idxOf(l)]?.heard ?? ""),
      );
  }

  // Follow-up clauses that belong to the play before them.
  const merged: Play[] = [];
  for (const p of plays) {
    const prev = merged[merged.length - 1];
    if (
      prev?.kind === "make" &&
      !prev.assist &&
      p.kind === "assist" &&
      prev.shot !== 1
    )
      prev.assist = p.player;
    else if (
      (prev?.kind === "miss" || prev?.kind === "block") &&
      !prev.rebound &&
      p.kind === "rebound" &&
      !(prev.kind === "miss" && prev.shot === 1)
    )
      prev.rebound = p.player;
    else merged.push(p);
  }
  return { plays: merged, unparsed, heard: text.trim() };
}

// ---- turning a play into recorded events ------------------------------------------------------

export type Need = {
  id: string;
  label: string;
  options: { value: number; label: string }[];
};

const REF_FIELDS = [
  "shooter",
  "assist",
  "rebound",
  "player",
  "from",
  "blocker",
  "out",
  "in",
] as const;
type RefField = (typeof REF_FIELDS)[number];

const refOf = (p: Play, f: RefField): Ref | undefined =>
  (p as unknown as Record<string, Ref | undefined>)[f];

export const short = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
    : name;
};

/** What still has to be chosen before this play can be recorded. */
export function playNeeds(p: Play, ctx: VoiceContext): Need[] {
  const needs: Need[] = [];
  const label: Record<RefField, string> = {
    shooter: "Who shot?",
    assist: "Who assisted?",
    rebound: "Who rebounded?",
    player: "Which player?",
    from: "Whose ball?",
    blocker: "Who blocked it?",
    out: "Who came out?",
    in: "Who came in?",
  };
  for (const f of REF_FIELDS) {
    const r = refOf(p, f);
    if (r && r.id === null) {
      const pool = r.options.length
        ? r.options
        : ctx.players.filter((x) => x.onCourt).map((x) => x.id);
      needs.push({
        id: `ref:${f}`,
        label: `${label[f]} (heard "${r.heard}")`,
        options: pool.map((id) => ({
          value: id,
          label: short(ctx.players.find((x) => x.id === id)?.name ?? "?"),
        })),
      });
    }
  }
  if (p.kind === "make" && p.shot === null)
    needs.push({
      id: "shot",
      label: "How many points?",
      options: [
        { value: 1, label: "1 (free throw)" },
        { value: 2, label: "2" },
        { value: 3, label: "3" },
      ],
    });
  if (p.kind === "rebound" && p.off === null && !ctx.lastMissTeam)
    needs.push({
      id: "off",
      label: "Offensive or defensive?",
      options: [
        { value: 1, label: "Offensive" },
        { value: 0, label: "Defensive" },
      ],
    });
  if (p.kind === "timeout" && !p.team && !p.player)
    needs.push({
      id: "team",
      label: "Which team?",
      options: [
        { value: 1, label: "Team A" },
        { value: 2, label: "Team B" },
      ],
    });
  return needs;
}

/** Applies a choice (player id, points, etc.) and returns the updated play. */
export function setNeed(p: Play, needId: string, value: number): Play {
  const next = structuredClone(p) as Play;
  if (needId.startsWith("ref:")) {
    const r = refOf(next, needId.slice(4) as RefField);
    if (r) r.id = value;
  } else if (needId === "shot" && "shot" in next)
    (next as { shot: Shot | null }).shot = value as Shot;
  else if (needId === "off" && next.kind === "rebound") next.off = value === 1;
  else if (needId === "team" && next.kind === "timeout")
    next.team = value === 1 ? "A" : "B";
  return next;
}

export type Built = {
  events: Draft[];
  summary: string;
  warnings: string[];
  errors: string[];
};

/** The events a play would record, in the same shapes the tap flows use. Null if choices are still missing. */
export function buildPlay(p: Play, ctx: VoiceContext): Built | null {
  if (playNeeds(p, ctx).length > 0) return null;
  const by = new Map(ctx.players.map((x) => [x.id, x]));
  const get = (r?: Ref) => (r && r.id !== null ? by.get(r.id) : undefined);
  const nm = (r?: Ref) => short(get(r)?.name ?? "?");
  const warnings: string[] = [];
  const errors: string[] = [];
  const benchCheck = (r?: Ref) => {
    const pl = get(r);
    if (pl && !pl.onCourt) warnings.push(`${short(pl.name)} is on the bench.`);
  };
  const reb = (shooterTeam: Team | undefined, r?: Ref): Draft[] => {
    const pl = get(r);
    if (!pl) return [];
    benchCheck(r);
    return [
      {
        playerId: pl.id,
        type: shooterTeam && shooterTeam === pl.team ? "OREB" : "DREB",
      },
    ];
  };
  const shotWord = (s: Shot | null) =>
    s === 3 ? "three" : s === 1 ? "free throw" : "two";

  switch (p.kind) {
    case "make": {
      const sh = get(p.shooter)!;
      benchCheck(p.shooter);
      const shot = p.shot ?? 2;
      const events: Draft[] = [
        {
          playerId: sh.id,
          type: shot === 3 ? "MAKE3" : shot === 1 ? "MAKE_FT" : "MAKE2",
        },
      ];
      let summary = `${nm(p.shooter)} made ${shot === 1 ? "a free throw" : `a ${shotWord(shot)}`}`;
      const a = get(p.assist);
      if (p.assist && a) {
        if (shot === 1)
          warnings.push(
            "Free throws can't be assisted, so the assist was left out.",
          );
        else if (a.team !== sh.team)
          errors.push(
            `${short(a.name)} is on the other team, so they can't assist ${short(sh.name)}.`,
          );
        else if (a.id === sh.id)
          errors.push("A player can't assist their own basket.");
        else {
          events.push({ playerId: a.id, type: "AST" });
          summary += `, assist ${nm(p.assist)}`;
          benchCheck(p.assist);
        }
      }
      return { events, summary, warnings, errors };
    }
    case "miss": {
      const sh = get(p.shooter)!;
      benchCheck(p.shooter);
      const shot = p.shot ?? 2;
      const events: Draft[] = [
        {
          playerId: sh.id,
          type: shot === 3 ? "MISS3" : shot === 1 ? "MISS_FT" : "MISS2",
        },
      ];
      let summary = `${nm(p.shooter)} missed ${shot === 1 ? "a free throw" : `a ${shotWord(shot)}`}`;
      if (p.rebound && shot !== 1) {
        const r = reb(sh.team, p.rebound);
        events.push(...r);
        if (r[0])
          summary += `, ${r[0].type === "OREB" ? "offensive" : "defensive"} rebound ${nm(p.rebound)}`;
      }
      return { events, summary, warnings, errors };
    }
    case "rebound": {
      const pl = get(p.player)!;
      benchCheck(p.player);
      const off =
        p.off ?? (ctx.lastMissTeam ? ctx.lastMissTeam === pl.team : false);
      return {
        events: [{ playerId: pl.id, type: off ? "OREB" : "DREB" }],
        summary: `${nm(p.player)} ${off ? "offensive" : "defensive"} rebound`,
        warnings,
        errors,
      };
    }
    case "assist": {
      benchCheck(p.player);
      return {
        events: [{ playerId: get(p.player)!.id, type: "AST" }],
        summary: `${nm(p.player)} assist`,
        warnings,
        errors,
      };
    }
    case "steal": {
      const pl = get(p.player)!;
      benchCheck(p.player);
      const events: Draft[] = [{ playerId: pl.id, type: "STL" }];
      let summary = `${nm(p.player)} steal`;
      const v = get(p.from);
      if (p.from && v) {
        if (v.team === pl.team)
          errors.push(
            `${short(v.name)} is on the same team, so they can't have lost the ball to ${short(pl.name)}.`,
          );
        else {
          events.push({ playerId: v.id, type: "TOV" });
          summary += ` from ${nm(p.from)}`;
        }
      }
      return { events, summary, warnings, errors };
    }
    case "block": {
      const b = get(p.blocker)!;
      benchCheck(p.blocker);
      const events: Draft[] = [{ playerId: b.id, type: "BLK" }];
      let summary = `${nm(p.blocker)} block`;
      const sh = get(p.shooter);
      if (p.shooter && sh) {
        if (sh.team === b.team)
          errors.push(`${short(sh.name)} is on the same team as the blocker.`);
        else {
          const shot = p.shot ?? 2;
          events.push({
            playerId: sh.id,
            type: shot === 3 ? "MISS3" : "MISS2",
          });
          summary += ` on ${nm(p.shooter)}'s ${shotWord(shot)}`;
          if (p.rebound) {
            const r = reb(sh.team, p.rebound);
            events.push(...r);
            if (r[0])
              summary += `, ${r[0].type === "OREB" ? "offensive" : "defensive"} rebound ${nm(p.rebound)}`;
          }
        }
      } else
        warnings.push("No shooter was named, so only the block is recorded.");
      return { events, summary, warnings, errors };
    }
    case "turnover":
    case "foul":
    case "deflection": {
      const type: EventType =
        p.kind === "turnover" ? "TOV" : p.kind === "foul" ? "FOUL" : "DEFL";
      benchCheck(p.player);
      return {
        events: [{ playerId: get(p.player)!.id, type }],
        summary: `${nm(p.player)} ${p.kind}`,
        warnings,
        errors,
      };
    }
    case "sub": {
      const o = get(p.out)!;
      const i = get(p.in)!;
      if (o.team !== i.team)
        errors.push(
          "A substitution has to be between players on the same team.",
        );
      if (!o.onCourt) warnings.push(`${short(o.name)} isn't on the court.`);
      if (i.onCourt) warnings.push(`${short(i.name)} is already on the court.`);
      return {
        events: [
          { playerId: o.id, type: "SUB_OUT" },
          { playerId: i.id, type: "SUB_IN" },
        ],
        summary: `${short(i.name)} in for ${short(o.name)}`,
        warnings,
        errors,
      };
    }
    case "pause":
      return {
        events: [{ playerId: 0, type: "PAUSE" }],
        summary: "Pause the clock",
        warnings,
        errors,
      };
    case "resume":
      return {
        events: [{ playerId: 0, type: "RESUME" }],
        summary: "Resume play",
        warnings,
        errors,
      };
    case "timeout": {
      const pl = get(p.player);
      const team = pl?.team ?? p.team ?? undefined;
      if (!team) errors.push("Which team called the timeout?");
      return {
        events: [
          { playerId: pl?.id ?? 0, type: "TIMEOUT", ...(team ? { team } : {}) },
        ],
        summary: `Timeout: Team ${team ?? "?"}${pl ? `, called by ${short(pl.name)}` : ""}`,
        warnings,
        errors,
      };
    }
    case "undo":
      return { events: [], summary: "Undo the last play", warnings, errors };
  }
}
