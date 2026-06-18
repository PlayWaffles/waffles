/**
 * Waffles v3 sample — "World Cup Format Lab".
 *
 * A showcase of every trivia format we're exploring for World Cup games.
 * Content lives here as plain data; the runners in ./components render it
 * with the real app's primitives (PixelButton, QuestionCardHeader, tension).
 *
 * 12 "core" formats run cleanly on the existing question engine
 * (content + options + correctIndex + durationSec, plus media/sound slots).
 * 5 "expansion" formats need bespoke UI and are flagged accordingly.
 */

export type VMedia =
  | { kind: "jersey"; nation: "argentina" }
  | { kind: "trophy" }
  | { kind: "audio"; line: string };

export type VQuestion = {
  /** Small overline label, e.g. "MISSING WORD". */
  kicker?: string;
  content: string;
  category?: string;
  options: string[];
  correctIndex: number;
  durationSec: number;
  /** Who Am I? — clues revealed above the prompt. */
  clues?: string[];
  /** Optional visual / audio clue rendered above the question. */
  media?: VMedia;
};

export type Engine =
  | "choice"
  | "set"
  | "map"
  | "ordering"
  | "bingo";

export type Accent = "gold" | "purple" | "cyan" | "green";

export type FormatDef = {
  num: number;
  id: string;
  name: string;
  tagline: string;
  tier: "core" | "expansion";
  engine: Engine;
  accent: Accent;
  /** Marks formats whose clue lives in an image/audio rather than text. */
  mediaNote?: string;
  /** Whole-question RISK behaviour — wrong answer kills the streak, 0 points. */
  minefield?: boolean;
  /** For choice/set engines. */
  questions?: VQuestion[];
};

// ---------------------------------------------------------------------------
// CORE FORMATS (1–12) — run on the existing engine
// ---------------------------------------------------------------------------

export const FORMATS: FormatDef[] = [
  {
    num: 1,
    id: "multiple-choice",
    name: "Standard Multiple Choice",
    tagline: "Question + 4 options.",
    tier: "core",
    engine: "choice",
    accent: "gold",
    questions: [
      {
        content: "Which nation won the 2022 World Cup in Qatar?",
        category: "FINALS",
        options: ["France", "Argentina", "Brazil", "Croatia"],
        correctIndex: 1,
        durationSec: 12,
      },
    ],
  },
  {
    num: 2,
    id: "true-false",
    name: "True / False",
    tagline: "Two options: true or false.",
    tier: "core",
    engine: "choice",
    accent: "cyan",
    questions: [
      {
        kicker: "TRUE OR FALSE",
        content: "Lionel Messi won the Golden Ball at the 2022 World Cup.",
        category: "AWARDS",
        options: ["TRUE", "FALSE"],
        correctIndex: 0,
        durationSec: 10,
      },
    ],
  },
  {
    num: 3,
    id: "quickfire",
    name: "Quickfire",
    tagline: "Multiple choice, very short timer.",
    tier: "core",
    engine: "choice",
    accent: "purple",
    questions: [
      {
        kicker: "QUICKFIRE · 5s",
        content: "How many players per side are on the pitch?",
        category: "LAWS",
        options: ["9", "10", "11", "12"],
        correctIndex: 2,
        durationSec: 5,
      },
    ],
  },
  {
    num: 4,
    id: "mini-trivia",
    name: "Mini Trivia",
    tagline: "A short set of simple factual questions.",
    tier: "core",
    engine: "set",
    accent: "green",
    questions: [
      {
        content: "Which country has won the most World Cups?",
        category: "RECORDS",
        options: ["Germany", "Brazil", "Italy", "Argentina"],
        correctIndex: 1,
        durationSec: 10,
      },
      {
        content: "Where was the 2022 World Cup final played?",
        category: "VENUES",
        options: ["Lusail Stadium", "Khalifa International", "Al Bayt", "974 Stadium"],
        correctIndex: 0,
        durationSec: 10,
      },
      {
        content: "Who scored the winning goal in the 2014 final?",
        category: "MOMENTS",
        options: ["Mario Götze", "Thomas Müller", "Miroslav Klose", "André Schürrle"],
        correctIndex: 0,
        durationSec: 10,
      },
      {
        content: "How often is the World Cup held?",
        category: "BASICS",
        options: ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"],
        correctIndex: 2,
        durationSec: 8,
      },
      {
        content: "Which body organizes the World Cup?",
        category: "BASICS",
        options: ["UEFA", "FIFA", "CONMEBOL", "IOC"],
        correctIndex: 1,
        durationSec: 8,
      },
    ],
  },
  {
    num: 5,
    id: "big-trivia",
    name: "Big Trivia",
    tagline: "A longer, harder quiz set.",
    tier: "core",
    engine: "set",
    accent: "gold",
    questions: [
      {
        content: "Who is the all-time top scorer in World Cup history?",
        category: "RECORDS",
        options: ["Ronaldo", "Miroslav Klose", "Gerd Müller", "Pelé"],
        correctIndex: 1,
        durationSec: 14,
      },
      {
        content: "Who scored a record 13 goals at a single World Cup (1958)?",
        category: "RECORDS",
        options: ["Just Fontaine", "Pelé", "Sándor Kocsis", "Gerd Müller"],
        correctIndex: 0,
        durationSec: 14,
      },
      {
        content: "Which country hosted — and won — the first World Cup in 1930?",
        category: "HISTORY",
        options: ["Brazil", "Italy", "Uruguay", "France"],
        correctIndex: 2,
        durationSec: 12,
      },
      {
        content: "Who won the Golden Boot at the 2018 World Cup?",
        category: "AWARDS",
        options: ["Harry Kane", "Kylian Mbappé", "Antoine Griezmann", "Romelu Lukaku"],
        correctIndex: 0,
        durationSec: 12,
      },
      {
        content: "Which nation did Spain beat in the 2010 final?",
        category: "FINALS",
        options: ["Germany", "Netherlands", "Italy", "Portugal"],
        correctIndex: 1,
        durationSec: 12,
      },
      {
        content: "Germany thrashed Brazil in the 2014 semifinal by what score?",
        category: "MOMENTS",
        options: ["5–0", "7–1", "6–1", "4–0"],
        correctIndex: 1,
        durationSec: 12,
      },
    ],
  },
  {
    num: 6,
    id: "missing-word",
    name: "Missing Word",
    tagline: "A sentence with a blank, answered by options.",
    tier: "core",
    engine: "choice",
    accent: "cyan",
    questions: [
      {
        kicker: "MISSING WORD",
        content: "Argentina beat France on ______ after a 3–3 draw in the 2022 final.",
        category: "FINALS",
        options: ["penalties", "away goals", "a replay", "golden goal"],
        correctIndex: 0,
        durationSec: 12,
      },
    ],
  },
  {
    num: 7,
    id: "which-of-these",
    name: "Which of These",
    tagline: "Pick the one option that matches the clue.",
    tier: "core",
    engine: "choice",
    accent: "green",
    questions: [
      {
        kicker: "WHICH OF THESE",
        content: "Which of these players has won the FIFA World Cup?",
        category: "WINNERS",
        options: ["Cristiano Ronaldo", "Kylian Mbappé", "Robert Lewandowski", "Mohamed Salah"],
        correctIndex: 1,
        durationSec: 12,
      },
    ],
  },
  {
    num: 8,
    id: "who-am-i",
    name: "Who Am I?",
    tagline: "Clues point to a player, country, coach, or moment.",
    tier: "core",
    engine: "choice",
    accent: "purple",
    questions: [
      {
        kicker: "WHO AM I?",
        content: "Name the player.",
        category: "GUESS",
        clues: [
          "I captained my country to the 2022 title.",
          "I wear the number 10.",
          "I've won the Golden Ball twice.",
          "I now play my club football for Inter Miami.",
        ],
        options: ["Ángel Di María", "Lionel Messi", "Kylian Mbappé", "Neymar"],
        correctIndex: 1,
        durationSec: 15,
      },
    ],
  },
  {
    num: 9,
    id: "visual-id",
    name: "Visual Identification",
    tagline: "Image shown, user identifies it.",
    tier: "core",
    engine: "choice",
    accent: "cyan",
    mediaNote: "uses mediaUrl",
    questions: [
      {
        kicker: "IDENTIFY THE KIT",
        content: "Which nation wears this iconic home kit?",
        category: "KITS",
        media: { kind: "jersey", nation: "argentina" },
        options: ["Italy", "Argentina", "Uruguay", "Greece"],
        correctIndex: 1,
        durationSec: 12,
      },
    ],
  },
  {
    num: 10,
    id: "get-the-picture",
    name: "Get the Picture",
    tagline: "The image is the main clue, not decoration.",
    tier: "core",
    engine: "choice",
    accent: "gold",
    mediaNote: "uses mediaUrl",
    questions: [
      {
        kicker: "GET THE PICTURE",
        content: "Lift this trophy and you've won the…?",
        category: "SILVERWARE",
        media: { kind: "trophy" },
        options: ["Champions League", "FIFA World Cup", "European Championship", "Copa América"],
        correctIndex: 1,
        durationSec: 12,
      },
    ],
  },
  {
    num: 11,
    id: "audio-id",
    name: "Audio Identification",
    tagline: "Audio clip plays, user identifies the moment.",
    tier: "core",
    engine: "choice",
    accent: "purple",
    mediaNote: "uses soundUrl",
    questions: [
      {
        kicker: "NAME THAT MOMENT",
        content: "Whose extra-time goal does this commentary call?",
        category: "AUDIO",
        media: {
          kind: "audio",
          line: "“…he's done it! Deep into extra time — and the World Cup is decided!”",
        },
        options: ["Iniesta '10", "Götze '14", "Mbappé '18", "Messi '22"],
        correctIndex: 1,
        durationSec: 12,
      },
    ],
  },
  {
    num: 12,
    id: "minefield",
    name: "Minefield-Style",
    tagline: "High-risk: a wrong answer kills your streak.",
    tier: "core",
    engine: "choice",
    accent: "gold",
    minefield: true,
    questions: [
      {
        kicker: "⚠ MINEFIELD · HIGH RISK",
        content: "Only ONE player has won three World Cups. Who?",
        category: "DANGER",
        options: ["Diego Maradona", "Pelé", "Cafu", "Franz Beckenbauer"],
        correctIndex: 1,
        durationSec: 10,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // EXPANSION FORMATS (13–17) — need new UI / logic
  // -------------------------------------------------------------------------

  {
    num: 13,
    id: "map-click",
    name: "Map Click",
    tagline: "Tap a country / city / stadium on a map.",
    tier: "expansion",
    engine: "map",
    accent: "cyan",
  },
  {
    num: 14,
    id: "ordering",
    name: "Ordering",
    tagline: "Put events in the right sequence.",
    tier: "expansion",
    engine: "ordering",
    accent: "purple",
  },
  {
    num: 15,
    id: "bingo",
    name: "Trivia Bingo",
    tagline: "Tap the true answers on a board.",
    tier: "expansion",
    engine: "bingo",
    accent: "gold",
  },
];

export const CORE_FORMATS = FORMATS.filter((f) => f.tier === "core");
export const EXPANSION_FORMATS = FORMATS.filter((f) => f.tier === "expansion");

export function getFormat(id: string): FormatDef | undefined {
  return FORMATS.find((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// EXPANSION CONTENT
// ---------------------------------------------------------------------------

export const MAP_CLICK = {
  prompt: "Tap the country that HOSTED the 2022 World Cup",
  durationSec: 15,
  answerId: "qatar",
  tiles: [
    { id: "russia", label: "Russia", flag: "🇷🇺", col: 3, row: 1 },
    { id: "germany", label: "Germany", flag: "🇩🇪", col: 2, row: 1 },
    { id: "usa", label: "USA", flag: "🇺🇸", col: 1, row: 1 },
    { id: "japan", label: "Japan", flag: "🇯🇵", col: 4, row: 2 },
    { id: "qatar", label: "Qatar", flag: "🇶🇦", col: 3, row: 2 },
    { id: "mexico", label: "Mexico", flag: "🇲🇽", col: 1, row: 2 },
    { id: "brazil", label: "Brazil", flag: "🇧🇷", col: 2, row: 3 },
    { id: "south-africa", label: "South Africa", flag: "🇿🇦", col: 3, row: 3 },
  ],
};

export const ORDERING = {
  prompt: "Order these World Cup winners — oldest to newest",
  durationSec: 25,
  /** Stored in correct order; shuffled for display. */
  items: [
    { id: "esp", label: "Spain", year: 2010, flag: "🇪🇸" },
    { id: "ger", label: "Germany", year: 2014, flag: "🇩🇪" },
    { id: "fra", label: "France", year: 2018, flag: "🇫🇷" },
    { id: "arg", label: "Argentina", year: 2022, flag: "🇦🇷" },
  ],
};

export const BINGO = {
  prompt: "Tap every TRUE statement. Complete a line for BINGO.",
  durationSec: 30,
  cells: [
    { text: "Brazil has 5 World Cup titles", truth: true },
    { text: "Messi won the 2022 final", truth: true },
    { text: "The World Cup is held every 2 years", truth: false },
    { text: "Italy has 4 World Cup titles", truth: true },
    { text: "Qatar hosted in 2022", truth: true },
    { text: "Cristiano Ronaldo has won a World Cup", truth: false },
    { text: "France won in 2018", truth: true },
    { text: "Pelé won three World Cups", truth: true },
    { text: "The USA won the 1994 World Cup", truth: false },
  ],
};

