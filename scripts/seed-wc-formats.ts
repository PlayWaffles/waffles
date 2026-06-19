/**
 * Seed: World Cup multi-format question pack — 10 formats × 20 = 200 questions.
 *
 * Adds the renderable formats the question screen supports (clues / kicker /
 * minefield / flags / correctSet+pick / correctOrder / real image), so a round
 * mixes styles instead of only plain multiple-choice.
 *
 * FIELD RULES (QuestionTemplate):
 *   SINGLE  options + correctIndex (0-based) + kicker. clues[] = Who Am I.
 *           minefield:true = high-risk. mediaUrl = real image (Visual ID / Picture).
 *   SPATIAL options + flags[] (one emoji per option) + correctIndex → tap.
 *   ORDER   options in DISPLAY order + correctOrder[] = option indices in the
 *           correct sequence (options[correctOrder[0]] is 1st, etc.).
 *   MULTI   options (often 6) + correctSet[] (all correct) + pick.
 *
 * IMAGES: served from flagcdn.com (reliable, free, real flag images).
 * IDEMPOTENT + ADDITIVE: tagged by category prefix "WC: "; the seed deletes only
 * that prefix then re-inserts. NEVER clears the base bank.
 */
import { prisma } from "@/lib/db";
import { GameTheme, Difficulty, QuestionKind } from "@prisma";

const flag = (iso: string) => `https://flagcdn.com/w320/${iso}.png`;
type D = "EASY" | "MEDIUM" | "HARD";

type Row = {
  content: string;
  options: string[];
  correctIndex: number;
  kind?: QuestionKind;
  correctSet?: number[];
  pick?: number;
  correctOrder?: number[];
  clues?: string[];
  flags?: string[];
  minefield?: boolean;
  kicker?: string;
  mediaUrl?: string;
  durationSec?: number;
  category: string;
  difficulty: D;
};

// ── 1. WHO AM I? (SINGLE + clues) ───────────────────────────────────────────
const K1 = "WHO AM I?";
const wai = (clues: string[], options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K1, content: "Name the answer from the clues.", clues, options, correctIndex, durationSec: 16, category: "WC: Who Am I", difficulty });
const whoAmI: Row[] = [
  wai(["I won the Golden Ball at the 2022 World Cup.", "I captained Argentina to the title in Qatar.", "I also reached the 2014 final."], ["Mbappé", "Messi", "Di María", "Álvarez"], 1, "EASY"),
  wai(["I scored a hat-trick in the 2022 final.", "I still finished on the losing side.", "I won the Golden Boot."], ["Messi", "Giroud", "Mbappé", "Griezmann"], 2, "MEDIUM"),
  wai(["I scored the 'Hand of God'.", "Minutes later, the 'Goal of the Century'.", "It was 1986 vs England."], ["Maradona", "Valdano", "Pelé", "Kempes"], 0, "EASY"),
  wai(["I'm the all-time top scorer at World Cups, with 16.", "I scored across 2002–2014.", "I'm German."], ["G. Müller", "Klose", "T. Müller", "Klinsmann"], 1, "MEDIUM"),
  wai(["I won the World Cup three times as a player.", "I scored in the 1958, 1962 and 1970 sides.", "I'm Brazilian."], ["Garrincha", "Pelé", "Zico", "Ronaldo"], 1, "EASY"),
  wai(["I was sent off for a headbutt in a final.", "It happened in 2006.", "I still won the Golden Ball."], ["Materazzi", "Zidane", "Vieira", "Henry"], 1, "MEDIUM"),
  wai(["I scored a famous solo goal vs England in 1998, aged 18.", "I later captained my country.", "I'm English."], ["Batistuta", "Owen", "Beckham", "Shearer"], 1, "HARD"),
  wai(["I scored a hat-trick in the 1966 final.", "It's still the only one in a final.", "I played for England."], ["B. Charlton", "Hurst", "Peters", "Hunt"], 1, "MEDIUM"),
  wai(["I scored 13 goals at a single World Cup.", "It was 1958 — still the record.", "I'm French."], ["Fontaine", "Platini", "Henry", "Kopa"], 0, "HARD"),
  wai(["I scored the winner in the 2010 final.", "It came in extra time for Spain.", "I played for Barcelona."], ["Iniesta", "Villa", "Torres", "Xavi"], 0, "MEDIUM"),
  wai(["I scored 5 goals in one World Cup match.", "It was vs Cameroon in 1994.", "I'm Russian."], ["Salenko", "Stoichkov", "Baggio", "Batistuta"], 0, "HARD"),
  wai(["I missed the decisive penalty in the 1994 final.", "I ballooned it over for Italy.", "I'd carried Italy to the final."], ["Baresi", "Baggio", "Massaro", "Maldini"], 1, "MEDIUM"),
  wai(["I'm the youngest scorer in World Cup history.", "I scored at 17 in 1958.", "I'm Brazilian."], ["Ronaldo", "Pelé", "Rivaldo", "Romário"], 1, "MEDIUM"),
  wai(["I won the 2002 Golden Boot with 8 goals.", "Brazil won that year.", "I had the famous haircut."], ["Rivaldo", "Ronaldinho", "Ronaldo", "Cafu"], 2, "MEDIUM"),
  wai(["I coached Argentina to the 2022 title.", "My surname is Scaloni.", "I'm Argentine."], ["Simeone", "Scaloni", "Sampaoli", "Bielsa"], 1, "MEDIUM"),
  wai(["I scored a 30-yard free kick over Seaman in 2002.", "Brazil knocked England out.", "I'm a Brazilian playmaker."], ["Kaká", "Rivaldo", "Ronaldinho", "Juninho"], 2, "MEDIUM"),
  wai(["I reached the semi-finals in 2002 as co-host.", "An Asian first.", "Guus Hiddink coached me."], ["Japan", "South Korea", "Turkey", "Senegal"], 1, "MEDIUM"),
  wai(["I reached the 2022 semi-finals.", "An African first.", "I beat Spain and Portugal en route."], ["Tunisia", "Morocco", "Senegal", "Ghana"], 1, "HARD"),
  wai(["I won the 2018 Golden Boot with 6 goals.", "I captain England.", "I'm a striker."], ["Sterling", "Kane", "Alli", "Lingard"], 1, "EASY"),
  wai(["I won the World Cup as captain in 1974 and managed the 1990 winners.", "I'm German, nicknamed 'Der Kaiser'.", "I'm a defender."], ["Matthäus", "Beckenbauer", "Müller", "Maier"], 1, "HARD"),
];

// ── 2. MAP CLICK (SPATIAL + flags) ──────────────────────────────────────────
const K2 = "TAP THE MAP";
const mc = (content: string, opts: [string, string][], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K2, kind: QuestionKind.SPATIAL, content, options: opts.map((o) => o[0]), flags: opts.map((o) => o[1]), correctIndex, durationSec: 12, category: "WC: Map Click", difficulty });
const mapClick: Row[] = [
  mc("Tap the host of the 2022 World Cup.", [["Russia", "🇷🇺"], ["Qatar", "🇶🇦"], ["Brazil", "🇧🇷"], ["Japan", "🇯🇵"]], 1, "EASY"),
  mc("Tap the host of the FIRST World Cup (1930).", [["Brazil", "🇧🇷"], ["Italy", "🇮🇹"], ["Uruguay", "🇺🇾"], ["France", "🇫🇷"]], 2, "MEDIUM"),
  mc("Tap the nation that won on home soil in 1998.", [["France", "🇫🇷"], ["Germany", "🇩🇪"], ["Spain", "🇪🇸"], ["Italy", "🇮🇹"]], 0, "MEDIUM"),
  mc("Tap the 2014 World Cup winners.", [["Argentina", "🇦🇷"], ["Brazil", "🇧🇷"], ["Germany", "🇩🇪"], ["Netherlands", "🇳🇱"]], 2, "EASY"),
  mc("Tap the African 2022 semi-finalist.", [["Senegal", "🇸🇳"], ["Morocco", "🇲🇦"], ["Ghana", "🇬🇭"], ["Cameroon", "🇨🇲"]], 1, "MEDIUM"),
  mc("Tap South Korea's 2002 co-host.", [["China", "🇨🇳"], ["Japan", "🇯🇵"], ["Thailand", "🇹🇭"], ["Australia", "🇦🇺"]], 1, "MEDIUM"),
  mc("Tap the 2010 World Cup host.", [["Nigeria", "🇳🇬"], ["Egypt", "🇪🇬"], ["South Africa", "🇿🇦"], ["Morocco", "🇲🇦"]], 2, "EASY"),
  mc("Tap the 2010 final winners.", [["Netherlands", "🇳🇱"], ["Spain", "🇪🇸"], ["Germany", "🇩🇪"], ["Uruguay", "🇺🇾"]], 1, "EASY"),
  mc("Tap the team eliminated by the 'Hand of God' in 1986.", [["England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"], ["Argentina", "🇦🇷"], ["Belgium", "🇧🇪"], ["Germany", "🇩🇪"]], 0, "MEDIUM"),
  mc("Tap the third 2026 co-host (with USA & Mexico).", [["Canada", "🇨🇦"], ["Brazil", "🇧🇷"], ["Costa Rica", "🇨🇷"], ["Cuba", "🇨🇺"]], 0, "EASY"),
  mc("Tap the European nation with 4 World Cup titles.", [["Italy", "🇮🇹"], ["Germany", "🇩🇪"], ["France", "🇫🇷"], ["Spain", "🇪🇸"]], 1, "MEDIUM"),
  mc("Tap the nation that hosted AND won in 1978.", [["Argentina", "🇦🇷"], ["Brazil", "🇧🇷"], ["Chile", "🇨🇱"], ["Mexico", "🇲🇽"]], 0, "HARD"),
  mc("Tap the team that knocked Brazil out in the 2022 quarters.", [["Croatia", "🇭🇷"], ["Argentina", "🇦🇷"], ["France", "🇫🇷"], ["Netherlands", "🇳🇱"]], 0, "HARD"),
  mc("Tap the 2006 World Cup host.", [["Germany", "🇩🇪"], ["France", "🇫🇷"], ["Italy", "🇮🇹"], ["Switzerland", "🇨🇭"]], 0, "MEDIUM"),
  mc("Tap the country that hosted the 2002 FINAL.", [["South Korea", "🇰🇷"], ["Japan", "🇯🇵"], ["Qatar", "🇶🇦"], ["China", "🇨🇳"]], 1, "MEDIUM"),
  mc("Tap the team that beat Germany in the 2018 group stage.", [["Mexico", "🇲🇽"], ["Sweden", "🇸🇪"], ["South Korea", "🇰🇷"], ["Japan", "🇯🇵"]], 2, "HARD"),
  mc("Tap the South American nation that won in 1930 and 1950.", [["Argentina", "🇦🇷"], ["Uruguay", "🇺🇾"], ["Brazil", "🇧🇷"], ["Peru", "🇵🇪"]], 1, "MEDIUM"),
  mc("Tap the host of the 1950 'Maracanazo' final.", [["Brazil", "🇧🇷"], ["Uruguay", "🇺🇾"], ["Argentina", "🇦🇷"], ["Chile", "🇨🇱"]], 0, "HARD"),
  mc("Tap the 1994 World Cup host.", [["Mexico", "🇲🇽"], ["USA", "🇺🇸"], ["Canada", "🇨🇦"], ["Brazil", "🇧🇷"]], 1, "MEDIUM"),
  mc("Tap the nation that has lost the most finals without winning.", [["Netherlands", "🇳🇱"], ["Hungary", "🇭🇺"], ["Sweden", "🇸🇪"], ["Mexico", "🇲🇽"]], 0, "HARD"),
];

// ── 3. AUDIO MOMENT (SINGLE — commentary line as text) ──────────────────────
const K3 = "NAME THE MOMENT";
const am = (line: string, options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K3, content: `🔊 "${line}"  —  which moment is this?`, options, correctIndex, durationSec: 12, category: "WC: Audio Moment", difficulty });
const audio: Row[] = [
  am("Goooool! Messi! Argentina are world champions!", ["2014 final", "2022 final", "2021 Copa final", "2018 R16"], 1, "EASY"),
  am("Iniesta scores! Spain win the World Cup!", ["2008 final", "2010 WC final", "2012 final", "2009 final"], 1, "EASY"),
  am("Zidane... and he's sent off! In the final!", ["1998 final", "2006 final", "2000 Euro", "2004 final"], 1, "MEDIUM"),
  am("They think it's all over... it is now! Hurst completes the hat-trick!", ["1966 final", "1970 final", "1962 final", "1958 final"], 0, "MEDIUM"),
  am("Maradona, left the English defence for dead — a wonderful goal!", ["1982 vs Brazil", "1986 vs England", "1990 vs Italy", "1994 vs Nigeria"], 1, "MEDIUM"),
  am("Götze! Germany win the World Cup at the death!", ["2010 final", "2014 final", "2006 SF", "2018 group"], 1, "EASY"),
  am("Owen! What a goal by the young Englishman against Argentina!", ["1998 R16", "2002 group", "2006 R16", "2010 R16"], 0, "MEDIUM"),
  am("Baggio has missed! Brazil are champions!", ["1990 final", "1994 final", "1998 SF", "2002 final"], 1, "MEDIUM"),
  am("Mbappé! A hat-trick in the final — but it may not be enough!", ["2018 final", "2022 final", "2021 final", "2022 SF"], 1, "EASY"),
  am("Suárez handles it on the line! He's saved it — but he's off!", ["2010 QF vs Ghana", "2014 group", "2018 group", "2011 final"], 0, "HARD"),
  am("Schillaci! Italia '90 has its hero!", ["1986", "1990", "1994", "1982"], 1, "HARD"),
  am("Carlos Alberto! The greatest team goal in the greatest final!", ["1958 final", "1970 final", "1962 final", "1994 final"], 1, "MEDIUM"),
  am("A famous victory — the USA beat England 1-0!", ["1950 group", "1990 group", "1966 group", "2010 group"], 0, "HARD"),
  am("Klose equals the record — and Germany are demolishing Brazil!", ["2014 SF (7-1)", "2002 final", "2006 SF", "2010 QF"], 0, "MEDIUM"),
  am("Ronaldo! Redemption — two goals in the final!", ["1998 final", "2002 final", "2006 final", "1994 final"], 1, "MEDIUM"),
  am("A 24-pass move, finished by Cambiasso — magnificent Argentina!", ["2006 vs Serbia", "2010 vs Korea", "2014 vs Iran", "2002 vs England"], 0, "HARD"),
  am("Holland's total football — but the hosts will take the trophy.", ["1974 final", "1978 final", "1982 SF", "1998 SF"], 0, "HARD"),
  am("Gyan, off the bar! Ghana's dream is over!", ["2006 R16", "2010 QF", "2014 group", "2002 group"], 1, "MEDIUM"),
  am("England were ahead — but Croatia turn it around in extra time!", ["2018 SF", "2022 SF", "2018 final", "2006 SF"], 0, "MEDIUM"),
  am("Rensenbrink hits the post in the last minute — Argentina survive!", ["1974 final", "1978 final", "1986 final", "1990 final"], 1, "HARD"),
];

// ── 4. ORDERING (ORDER + correctOrder) ──────────────────────────────────────
const K4 = "PUT IN ORDER";
const ord = (content: string, options: string[], correctOrder: number[], difficulty: D): Row =>
  ({ kicker: K4, kind: QuestionKind.ORDER, content, options, correctIndex: correctOrder[0] ?? 0, correctOrder, durationSec: 20, category: "WC: Ordering", difficulty });
const ordering: Row[] = [
  ord("Order these winners — oldest title first.", ["France", "Argentina", "Spain", "Germany"], [2, 3, 0, 1], "MEDIUM"), // 2010,2014,2018,2022
  ord("Order these hosts — earliest to latest.", ["Brazil", "South Africa", "Qatar", "Germany"], [3, 1, 0, 2], "MEDIUM"), // 2006,2010,2014,2022
  ord("Order these WC top scorers — fewest goals to most.", ["Klose", "Ronaldo", "G. Müller", "Fontaine"], [3, 2, 1, 0], "HARD"),
  ord("Order these finals — earliest first.", ["2002", "1986", "2018", "1970"], [3, 1, 0, 2], "MEDIUM"),
  ord("Order Brazil's title years — earliest to latest.", ["1994", "1970", "2002", "1958"], [3, 1, 0, 2], "MEDIUM"),
  ord("Order these players' first World Cup — earliest first.", ["Mbappé", "Pelé", "Messi", "Maradona"], [1, 3, 2, 0], "MEDIUM"),
  ord("Order by WC title count — fewest to most.", ["England", "Italy", "Uruguay", "Brazil"], [0, 2, 1, 3], "EASY"),
  ord("Order these hosts 2010→2022 — earliest first.", ["Brazil", "South Africa", "Russia", "Qatar"], [1, 0, 2, 3], "MEDIUM"),
  ord("Order Golden Boot winners — earliest first.", ["Kane", "Ronaldo", "Mbappé", "T. Müller"], [1, 3, 0, 2], "HARD"),
  ord("Order these World-Cup-winning coaches — earliest first.", ["Scaloni", "Deschamps", "Löw", "Del Bosque"], [3, 2, 1, 0], "MEDIUM"),
  ord("Order Messi's World Cups — earliest first.", ["2014", "2006", "2022", "2018"], [1, 0, 3, 2], "MEDIUM"),
  ord("Order these record wins by year — earliest first.", ["Germany 7-1 Brazil", "Hungary 10-1 El Salvador", "Yugoslavia 9-0 Zaire", "Spain 7-0 Costa Rica"], [2, 1, 0, 3], "HARD"),
  ord("Order these debut hosts — earliest first.", ["Qatar", "South Africa", "Japan/Korea", "USA"], [3, 2, 1, 0], "MEDIUM"),
  ord("Order these African milestones — earliest first.", ["Cameroon QF", "Senegal QF", "Ghana QF", "Morocco SF"], [0, 1, 2, 3], "MEDIUM"),
  ord("Order these iconic teams' eras — earliest first.", ["Brazil", "Netherlands", "Argentina", "France"], [0, 1, 2, 3], "EASY"),
  ord("Order Spain's, France's, Italy's, Germany's last title — earliest first.", ["Spain", "France", "Italy", "Germany"], [2, 0, 3, 1], "MEDIUM"),
  ord("Order these venues' finals by year — earliest first.", ["Maracanã", "Lusail", "Azteca", "Stade de France"], [2, 3, 0, 1], "HARD"),
  ord("Order these mascots' tournaments — earliest first.", ["Zakumi", "Footix", "Fuleco", "La'eeb"], [1, 0, 2, 3], "HARD"),
  ord("Order these years — earliest first.", ["2006", "2014", "1998", "2022"], [2, 0, 1, 3], "EASY"),
  ord("Order these Argentina captains by era — earliest first.", ["Maradona", "Messi", "Passarella", "Mascherano"], [2, 0, 3, 1], "HARD"),
];

// ── 5. TRIVIA BINGO (MULTI + correctSet + pick) ─────────────────────────────
const K5 = "TAP ALL TRUE";
const bingo = (content: string, options: string[], correctSet: number[], difficulty: D): Row =>
  ({ kicker: K5, kind: QuestionKind.MULTI, content, options, correctIndex: correctSet[0] ?? 0, correctSet, pick: correctSet.length, durationSec: 18, category: "WC: Trivia Bingo", difficulty });
const triviaBingo: Row[] = [
  bingo("Tap the 3 nations here that have WON the World Cup.", ["Brazil", "Mexico", "Germany", "Croatia", "Argentina", "Sweden"], [0, 2, 4], "EASY"),
  bingo("Tap the 3 countries that have HOSTED a World Cup.", ["Qatar", "Norway", "Brazil", "Kenya", "South Africa", "India"], [0, 2, 4], "MEDIUM"),
  bingo("Tap the 3 EUROPEAN nations that have won the World Cup.", ["Portugal", "Italy", "Belgium", "Spain", "Netherlands", "France"], [1, 3, 5], "MEDIUM"),
  bingo("Tap the 3 here who have scored in a World Cup FINAL.", ["Zidane", "Pirlo", "Mbappé", "Buffon", "Iniesta", "Casillas"], [0, 2, 4], "MEDIUM"),
  bingo("Tap the 3 nations that reached a final but NEVER won.", ["Netherlands", "Spain", "Hungary", "Germany", "Croatia", "Brazil"], [0, 2, 4], "HARD"),
  bingo("Tap the 3 SOUTH AMERICAN World Cup hosts.", ["Brazil", "Colombia", "Uruguay", "Peru", "Argentina", "Ecuador"], [0, 2, 4], "MEDIUM"),
  bingo("Tap the 3 here who WON the World Cup as host.", ["France", "Belgium", "Argentina", "Portugal", "England", "Mexico"], [0, 2, 4], "MEDIUM"),
  bingo("Tap the 4 here that won the trophy this century.", ["Brazil", "Italy", "Greece", "Spain", "Denmark", "Germany"], [0, 1, 3, 5], "MEDIUM"),
  bingo("Tap the 3 keepers here who won the Golden Glove.", ["E. Martínez", "Modrić", "Courtois", "Kane", "Neuer", "Hazard"], [0, 2, 4], "HARD"),
  bingo("Tap the 3 African nations to reach a quarter-final or beyond.", ["Cameroon", "Egypt", "Senegal", "Nigeria", "Ghana", "Tunisia"], [0, 2, 4], "HARD"),
  bingo("Tap the 3 cities that have hosted a World Cup FINAL.", ["Rio de Janeiro", "Cairo", "Moscow", "Toronto", "Lusail", "Oslo"], [0, 2, 4], "MEDIUM"),
  bingo("Tap the 3 here who have WON the World Cup as a coach.", ["Deschamps", "Mourinho", "Scaloni", "Guardiola", "Löw", "Klopp"], [0, 2, 4], "MEDIUM"),
  bingo("Tap the 3 nations that have won exactly TWICE.", ["Argentina", "France", "England", "Uruguay", "Spain", "Sweden"], [0, 1, 3], "HARD"),
  bingo("Tap the 4 decades in which Brazil won the trophy.", ["1950s", "1960s", "1980s", "1990s", "2010s", "2000s"], [0, 1, 3, 5], "MEDIUM"),
  bingo("Tap the 4 nations that reached the 2022 SEMI-FINALS.", ["Argentina", "Brazil", "France", "England", "Croatia", "Morocco"], [0, 2, 4, 5], "MEDIUM"),
  bingo("Tap the 2 here who scored a hat-trick in a World Cup FINAL.", ["Hurst", "Pelé", "Mbappé", "G. Müller", "Zidane", "Ronaldo"], [0, 2], "HARD"),
  bingo("Tap the 4 here who have played in 5 World Cups.", ["Messi", "Carbajal", "Matthäus", "Cristiano Ronaldo", "Buffon", "Modrić"], [0, 1, 2, 3], "HARD"),
  bingo("Tap the 3 here who won the Golden BALL (best player).", ["Messi", "Kanté", "Modrić", "Iniesta", "Forlán", "Lukaku"], [0, 2, 4], "HARD"),
  bingo("Tap the 3 nations that have NEVER won the World Cup.", ["Brazil", "Belgium", "Germany", "Portugal", "Italy", "Mexico"], [1, 3, 5], "MEDIUM"),
  bingo("Tap the 3 World Cup hosts (on different continents).", ["Brazil", "Canada", "South Africa", "Kenya", "Qatar", "Greece"], [0, 2, 4], "MEDIUM"),
];

// ── 6. MINEFIELD (SINGLE + minefield) ───────────────────────────────────────
const K6 = "MINEFIELD · DON'T SLIP";
const mine = (content: string, options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K6, content, options, correctIndex, minefield: true, durationSec: 12, category: "WC: Minefield", difficulty });
const minefield: Row[] = [
  mine("Which nation has won the MOST World Cups?", ["Germany", "Brazil", "Italy", "Argentina"], 1, "EASY"),
  mine("Who won the 2022 Golden Ball?", ["Mbappé", "Messi", "Modrić", "Álvarez"], 1, "EASY"),
  mine("In what year was the first World Cup held?", ["1928", "1930", "1934", "1950"], 1, "MEDIUM"),
  mine("Who is the all-time World Cup top scorer?", ["Ronaldo", "Klose", "G. Müller", "Pelé"], 1, "MEDIUM"),
  mine("Which country won the 2018 World Cup?", ["Croatia", "France", "Belgium", "England"], 1, "EASY"),
  mine("Where was the 2014 World Cup held?", ["Brazil", "Argentina", "South Africa", "Russia"], 0, "EASY"),
  mine("Who scored the 'Hand of God' goal?", ["Pelé", "Maradona", "Valdano", "Kempes"], 1, "EASY"),
  mine("Which nation co-hosts 2026 with USA & Mexico?", ["Canada", "Brazil", "Costa Rica", "Cuba"], 0, "MEDIUM"),
  mine("How many players per team are on the pitch?", ["10", "11", "12", "9"], 1, "EASY"),
  mine("Who won the 2010 World Cup?", ["Netherlands", "Spain", "Germany", "Uruguay"], 1, "EASY"),
  mine("Which keeper won the 2022 Golden Glove?", ["Courtois", "E. Martínez", "Bono", "Lloris"], 1, "MEDIUM"),
  mine("Who knocked Brazil out in 2022?", ["Croatia", "Argentina", "France", "Morocco"], 0, "HARD"),
  mine("Who scored a hat-trick in the 1966 final?", ["B. Charlton", "Hurst", "Peters", "Hunt"], 1, "MEDIUM"),
  mine("Which African nation reached the 2022 semis?", ["Senegal", "Morocco", "Ghana", "Cameroon"], 1, "MEDIUM"),
  mine("How many World Cups did Pelé win as a player?", ["2", "3", "4", "1"], 1, "MEDIUM"),
  mine("In which year did Germany beat Brazil 7-1?", ["2010", "2014", "2018", "2006"], 1, "MEDIUM"),
  mine("Who won the 2006 final (on penalties)?", ["France", "Italy", "Germany", "Portugal"], 1, "MEDIUM"),
  mine("Who won the very first World Cup?", ["Brazil", "Italy", "Uruguay", "Argentina"], 2, "MEDIUM"),
  mine("How many goals won Mbappé the 2022 Golden Boot?", ["6", "8", "7", "5"], 1, "HARD"),
  mine("Which of these has NEVER won the World Cup?", ["Spain", "England", "Netherlands", "Argentina"], 2, "MEDIUM"),
];

// ── 7. VISUAL ID (SINGLE + real flag image) ─────────────────────────────────
const K7 = "VISUAL ID";
const vis = (iso: string, options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K7, content: "Which nation's flag is this?", mediaUrl: flag(iso), options, correctIndex, durationSec: 12, category: "WC: Visual ID", difficulty });
const visualId: Row[] = [
  vis("br", ["Argentina", "Brazil", "Portugal", "Italy"], 1, "EASY"),
  vis("ar", ["Uruguay", "Argentina", "Greece", "Israel"], 1, "EASY"),
  vis("de", ["Belgium", "Germany", "Spain", "Romania"], 1, "EASY"),
  vis("fr", ["Netherlands", "France", "Russia", "Czechia"], 1, "EASY"),
  vis("it", ["Mexico", "Ireland", "Italy", "Hungary"], 2, "EASY"),
  vis("es", ["Spain", "Portugal", "Colombia", "Catalonia"], 0, "MEDIUM"),
  vis("uy", ["Argentina", "Uruguay", "Greece", "Israel"], 1, "MEDIUM"),
  vis("nl", ["France", "Netherlands", "Russia", "Luxembourg"], 1, "MEDIUM"),
  vis("hr", ["Croatia", "Slovakia", "Serbia", "Slovenia"], 0, "MEDIUM"),
  vis("ma", ["Tunisia", "Morocco", "Turkey", "Qatar"], 1, "MEDIUM"),
  vis("pt", ["Spain", "Portugal", "Italy", "Mexico"], 1, "MEDIUM"),
  vis("be", ["Germany", "Belgium", "Romania", "Chad"], 1, "MEDIUM"),
  vis("jp", ["South Korea", "Japan", "Bangladesh", "China"], 1, "EASY"),
  vis("kr", ["Japan", "South Korea", "Taiwan", "Mongolia"], 1, "MEDIUM"),
  vis("mx", ["Italy", "Mexico", "Hungary", "Iran"], 1, "MEDIUM"),
  vis("gh", ["Senegal", "Ghana", "Bolivia", "Ethiopia"], 1, "HARD"),
  vis("sn", ["Mali", "Senegal", "Guinea", "Cameroon"], 1, "HARD"),
  vis("pl", ["Poland", "Indonesia", "Monaco", "Austria"], 0, "MEDIUM"),
  vis("ng", ["Nigeria", "Italy", "Pakistan", "Ireland"], 0, "MEDIUM"),
  vis("ch", ["Denmark", "Switzerland", "Austria", "Norway"], 1, "MEDIUM"),
];

// ── 8. MISSING WORD (SINGLE + blank) ────────────────────────────────────────
const K8 = "MISSING WORD";
const miss = (content: string, options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K8, content, options, correctIndex, durationSec: 12, category: "WC: Missing Word", difficulty });
const missingWord: Row[] = [
  miss("The ____ of God goal was scored by Maradona in 1986.", ["Hand", "Foot", "Head", "Will"], 0, "EASY"),
  miss("____ won the 2022 World Cup on penalties against France.", ["Brazil", "Argentina", "Croatia", "Spain"], 1, "EASY"),
  miss("The first World Cup was held in ____ in 1930.", ["Brazil", "Italy", "Uruguay", "France"], 2, "MEDIUM"),
  miss("Germany beat Brazil ____ in the 2014 semi-final.", ["5-0", "7-1", "4-0", "6-1"], 1, "MEDIUM"),
  miss("Miroslav ____ is the all-time top scorer at World Cups.", ["Klinsmann", "Klose", "Kroos", "Kahn"], 1, "MEDIUM"),
  miss("Spain won their first World Cup in ____.", ["2006", "2010", "2014", "2008"], 1, "EASY"),
  miss("The 2026 World Cup adds the USA, Mexico and ____.", ["Canada", "Cuba", "Brazil", "Costa Rica"], 0, "EASY"),
  miss("Zinedine ____ was sent off in the 2006 final.", ["Zidane", "Zambrotta", "Zamorano", "Zico"], 0, "EASY"),
  miss("____ scored the winning goal in the 2010 final for Spain.", ["Villa", "Iniesta", "Torres", "Xavi"], 1, "MEDIUM"),
  miss("Just Fontaine scored ____ goals at the 1958 World Cup.", ["10", "13", "11", "9"], 1, "HARD"),
  miss("The official ball of South Africa 2010 was the Adidas ____.", ["Jabulani", "Brazuca", "Telstar", "Tango"], 0, "HARD"),
  miss("____ is the only nation to win the World Cup five times.", ["Germany", "Brazil", "Italy", "Argentina"], 1, "EASY"),
  miss("Geoff Hurst scored a ____ in the 1966 final.", ["brace", "hat-trick", "penalty", "own goal"], 1, "MEDIUM"),
  miss("Roberto ____ missed the decisive penalty in the 1994 final.", ["Baresi", "Baggio", "Bergomi", "Berti"], 1, "MEDIUM"),
  miss("____ reached the semi-finals in 2022, an African first.", ["Senegal", "Morocco", "Ghana", "Tunisia"], 1, "MEDIUM"),
  miss("Pelé was ____ years old when he scored in the 1958 final.", ["16", "17", "18", "19"], 1, "MEDIUM"),
  miss("Italy has won the World Cup ____ times.", ["3", "4", "2", "5"], 1, "MEDIUM"),
  miss("The 2018 World Cup was hosted by ____.", ["Russia", "Qatar", "Brazil", "Germany"], 0, "EASY"),
  miss("Lionel ____ coached Argentina to the 2022 title.", ["Sampaoli", "Scaloni", "Simeone", "Bielsa"], 1, "MEDIUM"),
  miss("England's only World Cup title came in ____.", ["1962", "1966", "1970", "1958"], 1, "EASY"),
];

// ── 9. GET THE PICTURE (SINGLE — the flag is the clue) ──────────────────────
const K9 = "GET THE PICTURE";
const pic = (iso: string, content: string, options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K9, content, mediaUrl: flag(iso), options, correctIndex, durationSec: 14, category: "WC: Get the Picture", difficulty });
const getThePicture: Row[] = [
  pic("ar", "This nation won the 2022 World Cup. Name its captain.", ["Di María", "Messi", "Álvarez", "Otamendi"], 1, "EASY"),
  pic("br", "How many World Cups has this nation won?", ["4", "5", "3", "6"], 1, "EASY"),
  pic("fr", "This nation won in 1998 and 2018. Who coached the 2018 win?", ["Wenger", "Deschamps", "Zidane", "Henry"], 1, "MEDIUM"),
  pic("de", "This nation's all-time WC top scorer (16 goals) is...", ["G. Müller", "Klose", "T. Müller", "Klinsmann"], 1, "MEDIUM"),
  pic("uy", "This nation won the FIRST World Cup in which year?", ["1928", "1930", "1934", "1950"], 1, "MEDIUM"),
  pic("es", "This nation won its only World Cup in...", ["2006", "2010", "2014", "2008"], 1, "EASY"),
  pic("it", "How many World Cups has this nation won?", ["3", "4", "2", "5"], 1, "MEDIUM"),
  pic("hr", "This nation reached the World Cup FINAL in which year?", ["2014", "2018", "2022", "2010"], 1, "MEDIUM"),
  pic("ma", "This nation made history in 2022 by reaching the...", ["Final", "Semi-final", "Quarter-final", "Round of 16"], 1, "HARD"),
  pic("nl", "This nation has reached three finals but won...", ["Once", "Twice", "Never", "Three times"], 2, "HARD"),
  pic("en-gb", "Replaced below.", ["a", "b", "c", "d"], 0, "EASY"),
  pic("pt", "This nation's number 7 has played in five World Cups. Who?", ["Figo", "Cristiano Ronaldo", "Nani", "Eusébio"], 1, "EASY"),
  pic("kr", "This nation reached the SEMI-FINALS as co-host in...", ["1998", "2002", "2006", "2010"], 1, "MEDIUM"),
  pic("jp", "Which manager led this nation's 2002 run? (Hint: 'Troussier').", ["Zico", "Troussier", "Osim", "Moriyasu"], 1, "HARD"),
  pic("mx", "This nation hosted the World Cup in 1970 and which other year?", ["1986", "1994", "1978", "2002"], 0, "MEDIUM"),
  pic("se", "This nation hosted, and lost the final, in which year?", ["1950", "1958", "1962", "1974"], 1, "HARD"),
  pic("us", "This nation co-hosts the 2026 World Cup, and hosted solo in...", ["1986", "1990", "1994", "1999"], 2, "MEDIUM"),
  pic("za", "This nation hosted the first World Cup on its continent in...", ["2006", "2010", "2014", "2002"], 1, "EASY"),
  pic("be", "This 'golden generation' finished 3rd at which World Cup?", ["2014", "2018", "2022", "2010"], 1, "MEDIUM"),
  pic("hu", "This nation's 'Magical Magyars' lost the 1954 final to...", ["Brazil", "West Germany", "Italy", "Uruguay"], 1, "HARD"),
];
// fix the placeholder entry (#11) with a valid flag
getThePicture[10] = pic("gh", "This nation was denied a semi-final by a Suárez handball in 2010. Name it.", ["Nigeria", "Ghana", "Senegal", "Cameroon"], 1, "HARD");

// ── 10. QUICKFIRE (SINGLE + short timer) ────────────────────────────────────
const K10 = "QUICKFIRE · 6s";
const qf = (content: string, options: string[], correctIndex: number, difficulty: D): Row =>
  ({ kicker: K10, content, options, correctIndex, durationSec: 6, category: "WC: Quickfire", difficulty });
const quickfire: Row[] = [
  qf("2022 winners?", ["France", "Argentina", "Brazil", "Croatia"], 1, "EASY"),
  qf("Most WC titles?", ["Germany", "Brazil", "Italy", "Argentina"], 1, "EASY"),
  qf("2018 hosts?", ["Qatar", "Russia", "Brazil", "France"], 1, "EASY"),
  qf("Hand of God scorer?", ["Pelé", "Maradona", "Messi", "Kempes"], 1, "EASY"),
  qf("All-time top scorer?", ["Ronaldo", "Klose", "G. Müller", "Pelé"], 1, "MEDIUM"),
  qf("2010 winners?", ["Netherlands", "Spain", "Germany", "Uruguay"], 1, "EASY"),
  qf("2014 hosts?", ["Brazil", "Argentina", "Russia", "Chile"], 0, "EASY"),
  qf("England's title year?", ["1962", "1966", "1970", "1958"], 1, "MEDIUM"),
  qf("First WC year?", ["1928", "1930", "1934", "1950"], 1, "MEDIUM"),
  qf("2022 Golden Ball?", ["Mbappé", "Messi", "Modrić", "Álvarez"], 1, "EASY"),
  qf("2006 final winners?", ["France", "Italy", "Germany", "Spain"], 1, "MEDIUM"),
  qf("Pelé's titles?", ["2", "3", "4", "1"], 1, "MEDIUM"),
  qf("2026 third co-host?", ["Canada", "Cuba", "Brazil", "Peru"], 0, "MEDIUM"),
  qf("2022 Golden Boot?", ["Messi", "Mbappé", "Giroud", "Álvarez"], 1, "EASY"),
  qf("Spain's first title?", ["2006", "2010", "2014", "2008"], 1, "EASY"),
  qf("Germany 7-1 victim?", ["Argentina", "Brazil", "France", "Spain"], 1, "MEDIUM"),
  qf("First WC winners?", ["Brazil", "Italy", "Uruguay", "Argentina"], 2, "MEDIUM"),
  qf("2018 winners?", ["Croatia", "France", "Belgium", "England"], 1, "EASY"),
  qf("Players per side?", ["10", "11", "12", "9"], 1, "EASY"),
  qf("2022 host country?", ["UAE", "Qatar", "Saudi Arabia", "Kuwait"], 1, "EASY"),
];

const ALL: Row[] = [
  ...whoAmI, ...mapClick, ...audio, ...ordering, ...triviaBingo,
  ...minefield, ...visualId, ...missingWord, ...getThePicture, ...quickfire,
];

async function main() {
  const byCat = ALL.reduce<Record<string, number>>((m, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {});
  console.log("counts per format:", byCat);
  if (ALL.length !== 200) throw new Error(`expected 200, got ${ALL.length}`);

  const data = ALL.map((r) => ({
    content: r.content,
    options: r.options,
    correctIndex: r.correctIndex,
    durationSec: r.durationSec ?? 12,
    kind: r.kind ?? QuestionKind.SINGLE,
    correctSet: r.correctSet ?? [],
    pick: r.pick ?? null,
    correctOrder: r.correctOrder ?? [],
    flags: r.flags ?? [],
    minefield: r.minefield ?? false,
    kicker: r.kicker ?? null,
    clues: r.clues ?? [],
    mediaUrl: r.mediaUrl ?? null,
    theme: GameTheme.FOOTBALL,
    category: r.category,
    difficulty: Difficulty[r.difficulty],
  }));

  // Additive + idempotent: remove only THIS pack (category "WC: …"), keep the base bank.
  const removed = await prisma.questionTemplate.deleteMany({ where: { category: { startsWith: "WC: " } } });
  const res = await prisma.questionTemplate.createMany({ data });
  console.log(`removed ${removed.count} prior pack rows; inserted ${res.count} (target 200)`);

  const kinds = await prisma.questionTemplate.groupBy({ by: ["kind"], where: { category: { startsWith: "WC: " } }, _count: true });
  console.log("pack by kind:", kinds.map((k) => `${k.kind}=${k._count}`).join("  "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
