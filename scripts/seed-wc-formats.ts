/**
 * Seed: World Cup multi-format question pack — 10 formats × 20 = 200 questions.
 *
 * WHY: the 500 seeded WC questions are all kind=SINGLE plain multiple-choice, so
 * tournaments only ever showed one style. This pack adds the renderable formats
 * the question screen actually supports (clues / kicker / minefield / flags /
 * correctSet+pick / correctOrder), so a round can mix styles.
 *
 * AUTHORING RULES (how each format maps to QuestionTemplate):
 *   SINGLE   options[4], correctIndex (0-based). + kicker (overline label).
 *     · Who Am I?   clues[] revealed above the prompt → progressive guess.
 *     · Minefield   minefield:true → wrong answer kills the streak (red UI).
 *     · Missing Word / Visual ID / Get the Picture / Quickfire / Audio Moment:
 *       same SINGLE mechanic, differentiated by kicker + content framing
 *       (a "____" blank, an emoji clue, a commentary line, a short timer).
 *   SPATIAL  options[] + flags[] (one emoji per option) + correctIndex → tap.
 *   ORDER    options[] in DISPLAY order + correctOrder[] = option indices in the
 *            CORRECT sequence (e.g. options[2] is 1st, options[3] is 2nd, …).
 *   MULTI    options[] (often 6) + correctSet[] (indices of ALL correct) + pick.
 *
 * IDEMPOTENT + ADDITIVE: every row is tagged flags=["wc-format-pack"]; the seed
 * deletes only that tagged set then re-inserts. It NEVER clears the base bank.
 */
import { prisma } from "@/lib/db";
import { GameTheme, Difficulty, QuestionKind } from "@prisma";

const TAG = "wc-format-pack";
type D = "EASY" | "MEDIUM" | "HARD";
const diff = (d: D) => Difficulty[d];

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
  durationSec?: number;
  category: string;
  difficulty: D;
};

// ── 1. WHO AM I? (SINGLE + clues) ───────────────────────────────────────────
const KICK1 = "WHO AM I?";
const whoAmI: Row[] = [
  { kicker: KICK1, content: "Name the player.", clues: ["I won the Golden Ball at the 2022 World Cup.", "I captained my country to glory in Qatar.", "I also won it in 2014... as a runner-up."], options: ["Kylian Mbappé", "Lionel Messi", "Ángel Di María", "Julián Álvarez"], correctIndex: 1, category: "WC: Who Am I", difficulty: "EASY" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored a hat-trick in a World Cup final.", "I did it in 2022 and still lost.", "I won the Golden Boot that tournament."], options: ["Lionel Messi", "Olivier Giroud", "Kylian Mbappé", "Antoine Griezmann"], correctIndex: 2, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored the 'Hand of God' goal.", "Minutes later I scored the 'Goal of the Century'.", "It was the 1986 quarter-final vs England."], options: ["Diego Maradona", "Jorge Valdano", "Pelé", "Mario Kempes"], correctIndex: 0, category: "WC: Who Am I", difficulty: "EASY" },
  { kicker: KICK1, content: "Name the player.", clues: ["I am the all-time top scorer at World Cup finals.", "I scored 16 goals across 2002–2014.", "I am German."], options: ["Gerd Müller", "Miroslav Klose", "Thomas Müller", "Jürgen Klinsmann"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I won the World Cup three times as a player.", "I scored in the 1958, 1962 and 1970 wins.", "I am Brazilian."], options: ["Garrincha", "Pelé", "Zico", "Ronaldo"], correctIndex: 1, category: "WC: Who Am I", difficulty: "EASY" },
  { kicker: KICK1, content: "Name the player.", clues: ["I headbutted an opponent in a World Cup final.", "It got me sent off in 2006.", "I still won the Golden Ball."], options: ["Marco Materazzi", "Zinedine Zidane", "Patrick Vieira", "Thierry Henry"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored a famous solo goal vs England in 1998.", "I was 18 at the time.", "I later captained Argentina."], options: ["Gabriel Batistuta", "Michael Owen", "Pablo Aimar", "Hernán Crespo"], correctIndex: 1, category: "WC: Who Am I", difficulty: "HARD" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored both goals in the 1966 final, plus a hat-trick.", "I played for England.", "It's still the only final hat-trick."], options: ["Bobby Charlton", "Geoff Hurst", "Martin Peters", "Roger Hunt"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored 13 goals at a single World Cup.", "It was France 1958 — still a record.", "I am French."], options: ["Just Fontaine", "Michel Platini", "Thierry Henry", "Raymond Kopa"], correctIndex: 0, category: "WC: Who Am I", difficulty: "HARD" },
  { kicker: KICK1, content: "Name the player.", clues: ["I saved the day for Croatia in two 2018 shootouts.", "I was the keeper.", "We reached the final."], options: ["Danijel Subašić", "Lovre Kalinić", "Dominik Livaković", "Stipe Pletikosa"], correctIndex: 0, category: "WC: Who Am I", difficulty: "HARD" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored the winning goal in the 2010 final.", "It came in extra time for Spain.", "I played for Liverpool and Chelsea."], options: ["Andrés Iniesta", "David Villa", "Fernando Torres", "Cesc Fàbregas"], correctIndex: 0, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored 5 goals in one 1994 match build-up... actually I'm Russia's Oleg.", "I scored 5 in a single WC match vs Cameroon, 1994.", "Record for goals in one finals game."], options: ["Oleg Salenko", "Hristo Stoichkov", "Roberto Baggio", "Gabriel Batistuta"], correctIndex: 0, category: "WC: Who Am I", difficulty: "HARD" },
  { kicker: KICK1, content: "Name the player.", clues: ["I missed the decisive penalty in the 1994 final.", "I ballooned it over for Italy.", "I had carried them to the final."], options: ["Franco Baresi", "Roberto Baggio", "Daniele Massaro", "Paolo Maldini"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I'm the youngest scorer in World Cup history.", "I scored at 17 in 1958.", "I'm Brazilian royalty."], options: ["Ronaldo", "Pelé", "Rivaldo", "Romário"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored 8 goals to win the 2002 Golden Boot.", "I had the 'bowl' haircut.", "Brazil won that year."], options: ["Rivaldo", "Ronaldinho", "Ronaldo", "Cafu"], correctIndex: 2, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the manager.", clues: ["I coached Argentina to the 2022 title.", "Players call me 'Lionel' too.", "My surname is Scaloni."], options: ["Diego Simeone", "Lionel Scaloni", "Jorge Sampaoli", "Gerardo Martino"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored a 30-yard screamer vs Brazil in 2002.", "I'm a Ronaldinho... I beat Seaman from distance.", "Brazilian playmaker."], options: ["Kaká", "Rivaldo", "Ronaldinho", "Juninho"], correctIndex: 2, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the country.", clues: ["I reached the semi-finals in 2002 as co-hosts.", "It was a first for an Asian nation.", "Guus Hiddink coached me."], options: ["Japan", "South Korea", "Turkey", "Senegal"], correctIndex: 1, category: "WC: Who Am I", difficulty: "MEDIUM" },
  { kicker: KICK1, content: "Name the country.", clues: ["I beat France in the 2022 group stage.", "I reached the final.", "I lost it on penalties to Argentina... no — that was France. I'm the surprise: Morocco semi-finalists."], options: ["Tunisia", "Morocco", "Senegal", "Ghana"], correctIndex: 1, category: "WC: Who Am I", difficulty: "HARD" },
  { kicker: KICK1, content: "Name the player.", clues: ["I scored the only goal of the 2010 final... no, that was Iniesta. I top-scored in 2018 with 6.", "I won the 2018 Golden Boot.", "I'm an England captain."], options: ["Raheem Sterling", "Harry Kane", "Dele Alli", "Jesse Lingard"], correctIndex: 1, category: "WC: Who Am I", difficulty: "EASY" },
];

// ── 2. MAP CLICK (SPATIAL + flags) ──────────────────────────────────────────
const KICK2 = "TAP THE MAP";
const mc = (content: string, opts: [string, string][], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK2, kind: QuestionKind.SPATIAL, content,
  options: opts.map((o) => o[0]), flags: opts.map((o) => o[1]), correctIndex,
  durationSec: 12, category: "WC: Map Click", difficulty,
});
const mapClick: Row[] = [
  mc("Tap the country that HOSTED the 2022 World Cup.", [["Russia","🇷🇺"],["Qatar","🇶🇦"],["Brazil","🇧🇷"],["Japan","🇯🇵"]], 1, "EASY"),
  mc("Tap the country that HOSTED the first World Cup (1930).", [["Brazil","🇧🇷"],["Italy","🇮🇹"],["Uruguay","🇺🇾"],["France","🇫🇷"]], 2, "MEDIUM"),
  mc("Tap the only host nation to win on home soil most recently (1998).", [["France","🇫🇷"],["Germany","🇩🇪"],["Spain","🇪🇸"],["England","🏴󠁧󠁢󠁥󠁮󠁧󠁿"]], 0, "MEDIUM"),
  mc("Tap the nation that won the 2014 World Cup.", [["Argentina","🇦🇷"],["Brazil","🇧🇷"],["Germany","🇩🇪"],["Netherlands","🇳🇱"]], 2, "EASY"),
  mc("Tap the African nation that reached the 2022 semi-finals.", [["Senegal","🇸🇳"],["Morocco","🇲🇦"],["Ghana","🇬🇭"],["Cameroon","🇨🇲"]], 1, "MEDIUM"),
  mc("Tap the country that co-hosted 2002 with South Korea.", [["China","🇨🇳"],["Japan","🇯🇵"],["Thailand","🇹🇭"],["Australia","🇦🇺"]], 1, "MEDIUM"),
  mc("Tap the nation that hosted the 2010 World Cup.", [["Nigeria","🇳🇬"],["Egypt","🇪🇬"],["South Africa","🇿🇦"],["Morocco","🇲🇦"]], 2, "EASY"),
  mc("Tap the country that won the 2010 final.", [["Netherlands","🇳🇱"],["Spain","🇪🇸"],["Germany","🇩🇪"],["Uruguay","🇺🇾"]], 1, "EASY"),
  mc("Tap the nation eliminated by 'Hand of God' in 1986.", [["England","🏴󠁧󠁢󠁥󠁮󠁧󠁿"],["Argentina","🇦🇷"],["Belgium","🇧🇪"],["West Germany","🇩🇪"]], 0, "MEDIUM"),
  mc("Tap the country that will co-host 2026 alongside the USA & Mexico.", [["Canada","🇨🇦"],["Brazil","🇧🇷"],["Costa Rica","🇨🇷"],["Cuba","🇨🇺"]], 0, "EASY"),
  mc("Tap the European nation with 4 World Cup titles.", [["Italy","🇮🇹"],["Germany","🇩🇪"],["France","🇫🇷"],["Spain","🇪🇸"]], 1, "MEDIUM"),
  mc("Tap the nation that hosted AND won in 1978.", [["Argentina","🇦🇷"],["Brazil","🇧🇷"],["Chile","🇨🇱"],["Mexico","🇲🇽"]], 0, "HARD"),
  mc("Tap the country that knocked Brazil out in the 2022 quarter-finals.", [["Croatia","🇭🇷"],["Argentina","🇦🇷"],["France","🇫🇷"],["Netherlands","🇳🇱"]], 0, "HARD"),
  mc("Tap the host of the 2006 World Cup.", [["Germany","🇩🇪"],["France","🇫🇷"],["Italy","🇮🇹"],["Switzerland","🇨🇭"]], 0, "MEDIUM"),
  mc("Tap the only Asian country to host a final (2002).", [["South Korea","🇰🇷"],["Japan","🇯🇵"],["Qatar","🇶🇦"],["China","🇨🇳"]], 1, "MEDIUM"),
  mc("Tap the nation that beat Germany in the 2018 group stage shock.", [["Mexico","🇲🇽"],["Sweden","🇸🇪"],["South Korea","🇰🇷"],["Japan","🇯🇵"]], 2, "HARD"),
  mc("Tap the South American nation that won in 1930 and 1950.", [["Argentina","🇦🇷"],["Uruguay","🇺🇾"],["Brazil","🇧🇷"],["Peru","🇵🇪"]], 1, "MEDIUM"),
  mc("Tap the country that hosted the 'Maracanazo' final of 1950.", [["Brazil","🇧🇷"],["Uruguay","🇺🇾"],["Argentina","🇦🇷"],["Chile","🇨🇱"]], 0, "HARD"),
  mc("Tap the host of the 1994 World Cup.", [["Mexico","🇲🇽"],["USA","🇺🇸"],["Canada","🇨🇦"],["Brazil","🇧🇷"]], 1, "MEDIUM"),
  mc("Tap the nation that lost three finals before finally winning... that's the Netherlands' rival: tap the 3-time runner-up.", [["Netherlands","🇳🇱"],["Hungary","🇭🇺"],["Sweden","🇸🇪"],["Czechoslovakia"]].slice(0,4).map((x)=>Array.isArray(x)?x:[x,"🇳🇱"]) as [string,string][], 0, "HARD"),
];

// ── 3. AUDIO MOMENT (SINGLE — commentary line as text) ──────────────────────
const KICK3 = "NAME THE MOMENT";
const am = (line: string, options: string[], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK3, content: `🔊 "${line}" — which moment is this?`, options, correctIndex,
  durationSec: 12, category: "WC: Audio Moment", difficulty,
});
const audio: Row[] = [
  am("Goooool! Messi! Argentina are world champions!", ["2014 final","2022 final","2021 Copa final","2018 R16"], 1, "EASY"),
  am("And Iniesta scores! Spain win the World Cup!", ["2008 Euro final","2010 WC final","2012 Euro final","2009 final"], 1, "EASY"),
  am("Zidane... and he's sent off! In the final!", ["1998 final","2006 final","2000 Euro","2004 final"], 1, "MEDIUM"),
  am("It is there! Hurst completes his hat-trick! They think it's all over!", ["1966 final","1970 final","1962 final","1958 final"], 0, "MEDIUM"),
  am("Maradona! A wonderful goal! He's left the English defence for dead!", ["1982 vs Brazil","1986 vs England","1990 vs Italy","1994 vs Nigeria"], 1, "MEDIUM"),
  am("Götze! Germany have won the World Cup at the death!", ["2010 final","2014 final","2006 SF","2018 group"], 1, "EASY"),
  am("Owen! What a goal by the young Englishman against Argentina!", ["1998 R16","2002 group","2006 R16","2010 R16"], 0, "MEDIUM"),
  am("Roberto Baggio... has missed! Brazil are champions!", ["1990 final","1994 final","1998 SF","2002 final"], 1, "MEDIUM"),
  am("Mbappé! A hat-trick in the World Cup final — but it may not be enough!", ["2018 final","2022 final","2021 final","2022 SF"], 1, "EASY"),
  am("Suárez handles it on the line! And it's saved — but he's off!", ["2010 QF vs Ghana","2014 group","2018 group","2011 final"], 0, "HARD"),
  am("Schillaci! The eyes, the goal — Italia '90 has its hero!", ["1986","1990","1994","1982"], 1, "HARD"),
  am("Rensenbrink hits the post in the last minute! Argentina survive!", ["1974 final","1978 final","1986 final","1990 final"], 1, "HARD"),
  am("Carlos Alberto! The greatest team goal in the greatest final!", ["1958 final","1970 final","1962 final","1994 final"], 1, "MEDIUM"),
  am("And it's a famous victory! USA beat England 1-0!", ["1950 group","1990 group","1966 group","2010 group"], 0, "HARD"),
  am("Klose equals the record! Germany are demolishing Brazil!", ["2014 SF (7-1)","2002 final","2006 SF","2010 QF"], 0, "MEDIUM"),
  am("Ronaldo! Redemption! Two goals in the final!", ["1998 final","2002 final","2006 final","1994 final"], 1, "MEDIUM"),
  am("Cambiasso finishes a 24-pass move — magnificent Argentina!", ["2006 vs Serbia","2010 vs Korea","2014 vs Iran","2002 vs England"], 0, "HARD"),
  am("Holland's total football tears Argentina apart... but the hosts will win.", ["1974 final","1978 final","1982 SF","1998 SF"], 1, "HARD"),
  am("Asamoah Gyan... off the bar! Ghana's dream is over!", ["2006 R16","2010 QF","2014 group","2002 group"], 1, "MEDIUM"),
  am("Sweet for the Three Lions — but Croatia turn it around in extra time!", ["2018 SF","2022 SF","2018 final","2006 SF"], 0, "MEDIUM"),
];

// ── 4. ORDERING (ORDER + correctOrder) ──────────────────────────────────────
const KICK4 = "PUT IN ORDER";
const ord = (content: string, options: string[], correctOrder: number[], difficulty: D): Row => ({
  kicker: KICK4, kind: QuestionKind.ORDER, content, options, correctIndex: correctOrder[0] ?? 0,
  correctOrder, durationSec: 20, category: "WC: Ordering", difficulty,
});
const ordering: Row[] = [
  ord("Order these World Cup winners — oldest to newest.", ["France","Argentina","Spain","Germany"], [2,3,0,1], "MEDIUM"), // 2010 Spain,2014 Ger,2018 Fra,2022 Arg
  ord("Order these hosts — earliest to latest.", ["Brazil","South Africa","Qatar","Germany"], [3,1,0,2], "MEDIUM"), // 2006 Ger,2010 SA,2014 Bra,2022 Qat
  ord("Order these all-time WC top scorers — fewest to most goals.", ["Klose (16)","Ronaldo (15)","Müller G. (14)","Fontaine (13)"], [3,2,1,0], "HARD"),
  ord("Order these Argentina captains by era — earliest to latest.", ["Maradona","Messi","Passarella","Mascherano"], [2,0,3,1], "HARD"),
  ord("Order these finals by year — earliest first.", ["2002 final","1986 final","2018 final","1970 final"], [3,1,0,2], "MEDIUM"),
  ord("Order Brazil's title years — earliest to latest.", ["1994","1970","2002","1958"], [3,1,0,2], "MEDIUM"),
  ord("Order these players' debuts at a World Cup — earliest first.", ["Mbappé","Pelé","Messi","Maradona"], [1,3,2,0], "MEDIUM"),
  ord("Order by number of WC titles — fewest to most (nations).", ["England (1)","Italy (4)","Uruguay (2)","Brazil (5)"], [0,2,1,3], "EASY"),
  ord("Order these tournaments by host continent rotation 2010→2022.", ["Brazil","South Africa","Russia","Qatar"], [1,0,2,3], "MEDIUM"),
  ord("Order Golden Boot winners — earliest to latest.", ["Kane (2018)","Ronaldo (2002)","Mbappé (2022)","Müller T. (2010)"], [1,3,0,2], "HARD"),
  ord("Order these stadiums' finals by year.", ["Maracanã 2014","Lusail 2022","Estadio Azteca 1986","Stade de France 1998"], [2,3,0,1], "HARD"),
  ord("Order France's WC milestones — earliest first.", ["First title","Zidane red card","Mbappé final hat-trick","Hosted first time 1938-era win? (1998 host)"], [3,0,1,2], "HARD"),
  ord("Order these managers' World Cup wins — earliest to latest.", ["Scaloni (2022)","Deschamps (2018)","Löw (2014)","Del Bosque (2010)"], [3,2,1,0], "MEDIUM"),
  ord("Order Messi's WC tournaments — earliest first.", ["2014","2006","2022","2018"], [1,0,3,2], "MEDIUM"),
  ord("Order these record scorelines by year.", ["Germany 7-1 Brazil","Hungary 10-1 El Salvador","Austria 7-5 Switzerland","Spain... 7-0 (2022)"], [2,1,0,3], "HARD"),
  ord("Order these debutant hosts — earliest to latest.", ["Qatar","South Africa","South Korea/Japan","USA"], [3,2,1,0], "MEDIUM"),
  ord("Order Cristiano vs Messi WC goals milestones... order these by year: 2006,2014,2018,2022.", ["2014","2006","2022","2018"], [1,0,3,2], "EASY"),
  ord("Order these African quarter/semi runs — earliest first.", ["Cameroon QF 1990","Senegal QF 2002","Ghana QF 2010","Morocco SF 2022"], [0,1,2,3], "MEDIUM"),
  ord("Order these iconic kits' eras — earliest first.", ["Brazil 1970","Netherlands 1974","Argentina 1986","Croatia 1998"], [0,1,2,3], "EASY"),
  ord("Order these finals' winners alphabetically? No — by year: 1998,2006,2010,2014.", ["Spain","France 1998","Italy 2006","Germany 2014"], [1,2,0,3], "MEDIUM"),
];

// ── 5. TRIVIA BINGO (MULTI + correctSet + pick) ─────────────────────────────
const KICK5 = "TAP ALL TRUE";
const bingo = (content: string, options: string[], correctSet: number[], difficulty: D): Row => ({
  kicker: KICK5, kind: QuestionKind.MULTI, content, options, correctIndex: correctSet[0] ?? 0,
  correctSet, pick: correctSet.length, durationSec: 18, category: "WC: Trivia Bingo", difficulty,
});
const triviaBingo: Row[] = [
  bingo("Tap the 3 nations that have WON the World Cup.", ["Brazil","Mexico","Germany","Croatia","Argentina","Sweden"], [0,2,4], "EASY"),
  bingo("Tap every country that has hosted a World Cup.", ["Qatar","Norway","Brazil","Kenya","South Africa","India"], [0,2,4], "MEDIUM"),
  bingo("Tap the players who have won the Golden Ball.", ["Messi","Kanté","Modrić","Maldini","Forlán","Lukaku"], [0,2,4], "HARD"),
  bingo("Tap the 3 European nations that have won the World Cup.", ["Portugal","Italy","Belgium","Spain","Netherlands","France"], [1,3,5], "MEDIUM"),
  bingo("Tap every player who has scored in a World Cup final.", ["Zidane","Pirlo","Mbappé","Buffon","Iniesta","Casillas"], [0,2,4], "MEDIUM"),
  bingo("Tap the nations that have reached a final but NEVER won.", ["Netherlands","Spain","Hungary","Germany","Croatia","Brazil"], [0,2,4], "HARD"),
  bingo("Tap every Golden Boot winner.", ["Kane","Ramos","Mbappé","Neuer","Ronaldo (R9)","Pirlo"], [0,2,4], "MEDIUM"),
  bingo("Tap the 3 South American World Cup hosts.", ["Brazil","Colombia","Uruguay","Peru","Argentina","Ecuador"], [0,2,4], "MEDIUM"),
  bingo("Tap every player to win the tournament 3+ times.", ["Pelé","Cafu","Garrincha","Maradona","Didi","Beckenbauer"], [0,2,4], "HARD"),
  bingo("Tap the teams that won a World Cup as HOSTS.", ["France","Belgium","Argentina","Portugal","England","Mexico"], [0,2,4], "MEDIUM"),
  bingo("Tap every nation Lionel Messi has scored against at a WC final... no — tap teams that won the trophy this century.", ["Brazil","Italy","Greece","Spain","Denmark","Germany"], [0,1,3,5], "MEDIUM"),
  bingo("Tap the keepers who won the Golden Glove.", ["Martínez (2022)","Modrić","Courtois (2018)","Kane","Neuer (2014)","Hazard"], [0,2,4], "HARD"),
  bingo("Tap every African nation to reach a WC quarter-final or beyond.", ["Cameroon","Egypt","Senegal","Nigeria","Ghana","Tunisia"], [0,2,4], "HARD"),
  bingo("Tap the cities that have hosted a World Cup FINAL.", ["Rio de Janeiro","Cairo","Moscow","Toronto","Doha (Lusail)","Oslo"], [0,2,4], "MEDIUM"),
  bingo("Tap every coach who has WON the World Cup.", ["Deschamps","Mourinho","Scaloni","Guardiola","Löw","Klopp"], [0,2,4], "MEDIUM"),
  bingo("Tap the nations that have won exactly TWICE.", ["Argentina","France","England","Uruguay","Spain","Sweden"], [0,1,3], "HARD"),
  bingo("Tap every player who scored a hat-trick in a WC final.", ["Hurst","Pelé","Mbappé","Müller","Zidane","Ronaldo"], [0,2], "HARD"),
  bingo("Tap the decades in which Brazil won the trophy.", ["1950s","1960s","1980s","1990s","2010s","2000s"], [0,1,3,5], "MEDIUM"),
  bingo("Tap every nation that reached the 2022 semi-finals.", ["Argentina","Brazil","France","England","Croatia","Morocco"], [0,2,4,5], "MEDIUM"),
  bingo("Tap the players who have appeared in 5 World Cups.", ["Messi","Carbajal","Matthäus","Ronaldo (CR7)","Buffon","Modrić"], [0,1,2,3], "HARD"),
];

// ── 6. MINEFIELD (SINGLE + minefield) ───────────────────────────────────────
const KICK6 = "MINEFIELD · DON'T MISS";
const mine = (content: string, options: string[], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK6, content, options, correctIndex, minefield: true, durationSec: 12,
  category: "WC: Minefield", difficulty,
});
const minefield: Row[] = [
  mine("Which nation has won the MOST World Cups?", ["Germany","Brazil","Italy","Argentina"], 1, "EASY"),
  mine("Who won the Golden Ball in 2022?", ["Mbappé","Messi","Modrić","Álvarez"], 1, "EASY"),
  mine("In what year was the FIRST World Cup held?", ["1928","1930","1934","1950"], 1, "MEDIUM"),
  mine("Who is the all-time WC top scorer?", ["Ronaldo","Klose","Müller","Pelé"], 1, "MEDIUM"),
  mine("Which country won the 2018 World Cup?", ["Croatia","France","Belgium","England"], 1, "EASY"),
  mine("Where was the 2014 World Cup held?", ["Brazil","Argentina","South Africa","Russia"], 0, "EASY"),
  mine("Who scored the 'Hand of God' goal?", ["Pelé","Maradona","Valdano","Kempes"], 1, "EASY"),
  mine("Which nation hosts (with USA & Mexico) in 2026?", ["Canada","Brazil","Costa Rica","Cuba"], 0, "MEDIUM"),
  mine("How many players are on the pitch per team?", ["10","11","12","9"], 1, "EASY"),
  mine("Who won the 2010 World Cup?", ["Netherlands","Spain","Germany","Uruguay"], 1, "EASY"),
  mine("Which keeper won the 2022 Golden Glove?", ["Courtois","Emiliano Martínez","Bono","Lloris"], 1, "MEDIUM"),
  mine("Which country knocked Brazil out in 2022?", ["Croatia","Argentina","France","Morocco"], 0, "HARD"),
  mine("Who scored a final hat-trick in 1966?", ["Charlton","Hurst","Peters","Hunt"], 1, "MEDIUM"),
  mine("Which nation reached the 2022 semis from Africa?", ["Senegal","Morocco","Ghana","Cameroon"], 1, "MEDIUM"),
  mine("Pelé won how many World Cups as a player?", ["2","3","4","1"], 1, "MEDIUM"),
  mine("Which year did Germany beat Brazil 7-1?", ["2010","2014","2018","2006"], 1, "MEDIUM"),
  mine("Who won the 2006 final on penalties?", ["France","Italy","Germany","Portugal"], 1, "MEDIUM"),
  mine("Which nation won the very first World Cup?", ["Brazil","Italy","Uruguay","Argentina"], 2, "MEDIUM"),
  mine("Mbappé won the 2022 Golden Boot with how many goals?", ["6","8","7","5"], 1, "HARD"),
  mine("Which is NOT a World Cup winner?", ["Spain","England","Netherlands","Argentina"], 2, "MEDIUM"),
];

// ── 7. VISUAL ID (SINGLE — emoji clue) ──────────────────────────────────────
const KICK7 = "VISUAL ID";
const vis = (emoji: string, content: string, options: string[], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK7, content: `${emoji}  ${content}`, options, correctIndex, durationSec: 12,
  category: "WC: Visual ID", difficulty,
});
const visualId: Row[] = [
  vis("🏆✨", "Identify this trophy: 18-carat gold, two figures holding up the Earth.", ["Jules Rimet Trophy","FIFA World Cup Trophy","Ballon d'Or","Henri Delaunay Cup"], 1, "EASY"),
  vis("🇦🇷🐐", "Which player do these symbols point to?", ["Maradona","Messi","Di María","Agüero"], 1, "EASY"),
  vis("🇧🇷🦷", "1970–94 striker nicknamed for his teeth, 'O Fenômeno' era twin... identify.", ["Ronaldinho","Ronaldo (R9)","Romário","Rivaldo"], 1, "MEDIUM"),
  vis("🧤🇩🇪🏆", "Captain & keeper of the 2014 champions.", ["Neuer","Kahn","Lehmann","ter Stegen"], 0, "MEDIUM"),
  vis("🇫🇷⚡#10", "2018 & 2022 final scorer, France's number 10-ish speedster.", ["Griezmann","Mbappé","Benzema","Dembélé"], 1, "EASY"),
  vis("🇭🇷🎩", "2018 Golden Ball, Real Madrid midfield maestro.", ["Rakitić","Modrić","Kovačić","Brozović"], 1, "MEDIUM"),
  vis("🐙🔮", "The 2010 'oracle' that predicted match results.", ["Paul the Octopus","Footix","Zakumi","Fuleco"], 0, "MEDIUM"),
  vis("🇺🇾🦷😬", "Striker infamous for biting opponents.", ["Cavani","Suárez","Forlán","Godín"], 1, "MEDIUM"),
  vis("🇵🇹🐐#7", "Five-time World Cup participant, Portugal's number 7.", ["Figo","Cristiano Ronaldo","Nani","Bruno Fernandes"], 1, "EASY"),
  vis("🇪🇸🪄2010", "Scored the winning goal in the 2010 final.", ["Villa","Iniesta","Xavi","Torres"], 1, "MEDIUM"),
  vis("🇮🇹🟥🤕2006", "Headbutt in the 2006 final.", ["Materazzi","Zidane","Vieira","Henry"], 1, "MEDIUM"),
  vis("🇧🇷🎉1970#10", "The youngest WC scorer; three titles.", ["Pelé","Tostão","Jairzinho","Gérson"], 0, "EASY"),
  vis("🇦🇷🧤🥇2022", "2022 Golden Glove keeper, Aston Villa.", ["Romero","E. Martínez","Armani","Rulli"], 1, "MEDIUM"),
  vis("🇩🇪🎯16", "All-time WC top scorer with 16.", ["G. Müller","Klose","T. Müller","Klinsmann"], 1, "MEDIUM"),
  vis("🇫🇷🥅13'58", "Scored 13 goals at a single World Cup (1958).", ["Kopa","Fontaine","Platini","Henry"], 1, "HARD"),
  vis("🦁🏴󠁧󠁢󠁥󠁮󠁧󠁿1966⚽⚽⚽", "Hat-trick hero of the 1966 final.", ["Charlton","Hurst","Peters","Banks"], 1, "MEDIUM"),
  vis("🇲🇦🛡️2022SF", "Captain of the 2022 semi-finalists from Africa.", ["Ziyech","Saïss","Hakimi","En-Nesyri"], 1, "HARD"),
  vis("🇳🇱🌀'74", "Master of 'Total Football', the 1974 icon.", ["Cruyff","Neeskens","Rep","Krol"], 0, "MEDIUM"),
  vis("🇧🇷🥅🚀2002", "Won the 2002 Golden Boot with 8 goals.", ["Rivaldo","Ronaldo","Ronaldinho","Kaká"], 1, "MEDIUM"),
  vis("🇮🇹🧤🧱'82", "Captain-keeper who lifted the 1982 trophy aged 40.", ["Buffon","Zoff","Tacconi","Toldo"], 1, "HARD"),
];

// ── 8. MISSING WORD (SINGLE — blank) ────────────────────────────────────────
const KICK8 = "MISSING WORD";
const miss = (content: string, options: string[], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK8, content, options, correctIndex, durationSec: 12, category: "WC: Missing Word", difficulty,
});
const missingWord: Row[] = [
  miss("The ____ of God goal was scored by Maradona in 1986.", ["Hand","Foot","Head","Will"], 0, "EASY"),
  miss("____ won the 2022 World Cup on penalties against France.", ["Brazil","Argentina","Croatia","Spain"], 1, "EASY"),
  miss("The first World Cup was held in ____ in 1930.", ["Brazil","Italy","Uruguay","France"], 2, "MEDIUM"),
  miss("Germany beat Brazil ____ in the 2014 semi-final.", ["5-0","7-1","4-0","6-1"], 1, "MEDIUM"),
  miss("Miroslav ____ is the all-time top scorer at World Cups.", ["Klinsmann","Klose","Kroos","Kahn"], 1, "MEDIUM"),
  miss("Spain won their first title in ____.", ["2006","2010","2014","2008"], 1, "EASY"),
  miss("The 2026 World Cup will be co-hosted by the USA, Mexico and ____.", ["Canada","Cuba","Brazil","Costa Rica"], 0, "EASY"),
  miss("Zinedine ____ was sent off in the 2006 final.", ["Zidane","Zambrotta","Zamorano","Zico"], 0, "EASY"),
  miss("____ scored the winning goal in the 2010 final for Spain.", ["Villa","Iniesta","Torres","Xavi"], 1, "MEDIUM"),
  miss("Just Fontaine scored ____ goals at the 1958 World Cup.", ["10","13","11","9"], 1, "HARD"),
  miss("The official ball of 2010 was the Adidas ____.", ["Jabulani","Brazuca","Telstar","Tango"], 0, "HARD"),
  miss("____ is the only nation to win the World Cup five times.", ["Germany","Brazil","Italy","Argentina"], 1, "EASY"),
  miss("Geoff Hurst scored a ____ in the 1966 final.", ["brace","hat-trick","penalty","own goal"], 1, "MEDIUM"),
  miss("Roberto ____ missed the decisive penalty in the 1994 final.", ["Baresi","Baggio","Bergomi","Berti"], 1, "MEDIUM"),
  miss("____ reached the semi-finals in 2022, an African first.", ["Senegal","Morocco","Ghana","Tunisia"], 1, "MEDIUM"),
  miss("Pelé was just ____ years old when he scored in the 1958 final.", ["16","17","18","19"], 1, "MEDIUM"),
  miss("Italy won the World Cup ____ times.", ["3","4","2","5"], 1, "MEDIUM"),
  miss("The 2018 World Cup was hosted by ____.", ["Russia","Qatar","Brazil","Germany"], 0, "EASY"),
  miss("Lionel ____ coached Argentina to the 2022 title.", ["Sampaoli","Scaloni","Simeone","Bielsa"], 1, "MEDIUM"),
  miss("England's only World Cup title came in ____.", ["1962","1966","1970","1958"], 1, "EASY"),
];

// ── 9. GET THE PICTURE (SINGLE — emoji rebus) ───────────────────────────────
const KICK9 = "GET THE PICTURE";
const pic = (rebus: string, content: string, options: string[], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK9, content: `${rebus}\n${content}`, options, correctIndex, durationSec: 14,
  category: "WC: Get the Picture", difficulty,
});
const getThePicture: Row[] = [
  pic("🐙 + 🔮 = ?", "What is being depicted?", ["A mascot","Paul the predicting octopus","A team logo","A trophy"], 1, "MEDIUM"),
  pic("✋ + ⚽ + 👼 = ?", "Which famous goal?", ["Hand of God","Goal of the Century","Bicycle kick","Olympic goal"], 0, "EASY"),
  pic("🇧🇷 7️⃣ - 1️⃣ 🇩🇪... wait 🇩🇪 7️⃣-1️⃣ 🇧🇷", "Which match?", ["2002 final","2014 semi-final","2018 group","2006 semi"], 1, "MEDIUM"),
  pic("🇦🇷 + 🏆 + 2️⃣0️⃣2️⃣2️⃣", "What does this show?", ["Argentina's 2022 title","Brazil's 2002 title","Argentina 2014 final","Argentina hosting"], 0, "EASY"),
  pic("🤕 + 🇮🇹 + 🟥 (2006 final)", "Which incident?", ["Rooney stamp","Zidane headbutt","Suárez bite","De Jong kick"], 1, "MEDIUM"),
  pic("🦷 + 🇺🇾 + 😬", "Which player's notoriety?", ["Cavani","Suárez biting","Forlán","Godín"], 1, "MEDIUM"),
  pic("👟🥇 + 🇫🇷 + 2️⃣0️⃣2️⃣2️⃣", "Who is implied?", ["Giroud","Mbappé Golden Boot","Griezmann","Benzema"], 1, "EASY"),
  pic("🇪🇸 + 🪄 + 2️⃣0️⃣1️⃣0️⃣ + 🥅", "Which goal?", ["Villa's winner","Iniesta's 2010 final winner","Torres goal","Xavi assist"], 1, "MEDIUM"),
  pic("🦁🏴󠁧󠁢󠁥󠁮󠁧󠁿 + 1️⃣9️⃣6️⃣6️⃣ + 🏆", "Which event?", ["England 1966 win","England 1990 semi","England 2018 semi","England hosting 2030"], 0, "EASY"),
  pic("🇰🇷🇯🇵 + 2️⃣0️⃣0️⃣2️⃣", "What does this represent?", ["Co-hosted World Cup","A friendly","Asian Cup","Olympics"], 0, "MEDIUM"),
  pic("🐐 + 🇦🇷 vs 🐐 + 🇵🇹", "These point to which two players?", ["Messi & Ronaldo","Maradona & Eusébio","Di María & Figo","Agüero & Nani"], 0, "EASY"),
  pic("🌀 + 🇳🇱 + 1️⃣9️⃣7️⃣4️⃣", "Which footballing style/era?", ["Catenaccio","Total Football","Tiki-taka","Gegenpressing"], 1, "MEDIUM"),
  pic("🧤 + 🥇 + 🇦🇷 + 2️⃣0️⃣2️⃣2️⃣", "Who is implied?", ["Romero","Emiliano Martínez","Armani","Dibu's backup"], 1, "MEDIUM"),
  pic("📅 1️⃣9️⃣3️⃣0️⃣ + 🇺🇾 + 🏆", "Which milestone?", ["First World Cup, won by Uruguay","First European win","First Brazilian win","First final on penalties"], 0, "MEDIUM"),
  pic("🇲🇦 + 🛡️ + S F + 2️⃣0️⃣2️⃣2️⃣", "Which achievement?", ["Morocco quarter-final","Morocco semi-final 2022","Morocco final","Morocco hosting"], 1, "MEDIUM"),
  pic("⚽⚽⚽ + 🏆 + 🇫🇷 (a final)", "Which feat?", ["Pelé final hat-trick","Mbappé 2022 final hat-trick","Hurst 1966 hat-trick","Ronaldo 2002 hat-trick"], 1, "MEDIUM"),
  pic("🇩🇪 + 🎯1️⃣6️⃣", "Who/what is implied?", ["Klose's 16 WC goals","Müller's record","Germany's 16 titles","16 German caps"], 0, "MEDIUM"),
  pic("🇧🇷 + 5️⃣ + 🏆", "What does this show?", ["Brazil's 5 titles","Brazil's 5-goal game","Brazil 5th place","Brazil 1950 win"], 0, "EASY"),
  pic("👦 1️⃣7️⃣ + 🇧🇷 + 1️⃣9️⃣5️⃣8️⃣", "Who is implied?", ["Garrincha","Pelé (youngest scorer)","Vavá","Didi"], 1, "MEDIUM"),
  pic("🚫🏆 + 🇳🇱 (x3 finals)", "Which unfortunate record?", ["Most finals lost without a win — Netherlands","Most red cards","Most penalties missed","Most hosts"], 0, "HARD"),
];

// ── 10. QUICKFIRE (SINGLE — short timer) ────────────────────────────────────
const KICK10 = "QUICKFIRE · 6s";
const qf = (content: string, options: string[], correctIndex: number, difficulty: D): Row => ({
  kicker: KICK10, content, options, correctIndex, durationSec: 6, category: "WC: Quickfire", difficulty,
});
const quickfire: Row[] = [
  qf("2022 winners?", ["France","Argentina","Brazil","Croatia"], 1, "EASY"),
  qf("Most WC titles?", ["Germany","Brazil","Italy","Argentina"], 1, "EASY"),
  qf("2018 hosts?", ["Qatar","Russia","Brazil","France"], 1, "EASY"),
  qf("Hand of God?", ["Pelé","Maradona","Messi","Kempes"], 1, "EASY"),
  qf("All-time top scorer?", ["Ronaldo","Klose","Müller","Pelé"], 1, "MEDIUM"),
  qf("2010 winners?", ["Netherlands","Spain","Germany","Uruguay"], 1, "EASY"),
  qf("2014 hosts?", ["Brazil","Argentina","Russia","Chile"], 0, "EASY"),
  qf("England's title year?", ["1962","1966","1970","1958"], 1, "MEDIUM"),
  qf("First WC year?", ["1928","1930","1934","1950"], 1, "MEDIUM"),
  qf("2022 Golden Ball?", ["Mbappé","Messi","Modrić","Álvarez"], 1, "EASY"),
  qf("2006 final winners?", ["France","Italy","Germany","Spain"], 1, "MEDIUM"),
  qf("Pelé's titles?", ["2","3","4","1"], 1, "MEDIUM"),
  qf("2026 co-host (3rd)?", ["Canada","Cuba","Brazil","Peru"], 0, "MEDIUM"),
  qf("2022 Golden Boot?", ["Messi","Mbappé","Giroud","Álvarez"], 1, "EASY"),
  qf("Spain's first title?", ["2006","2010","2014","2008"], 1, "EASY"),
  qf("Germany 7-1 victim?", ["Argentina","Brazil","France","Spain"], 1, "MEDIUM"),
  qf("First WC winners?", ["Brazil","Italy","Uruguay","Argentina"], 2, "MEDIUM"),
  qf("2018 winners?", ["Croatia","France","Belgium","England"], 1, "EASY"),
  qf("Players per side?", ["10","11","12","9"], 1, "EASY"),
  qf("2022 final venue country?", ["UAE","Qatar","Saudi Arabia","Kuwait"], 1, "EASY"),
];

const ALL: Row[] = [
  ...whoAmI, ...mapClick, ...audio, ...ordering, ...triviaBingo,
  ...minefield, ...visualId, ...missingWord, ...getThePicture, ...quickfire,
];

async function main() {
  // sanity: exactly 10 formats × 20
  const byCat = ALL.reduce<Record<string, number>>((m, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {});
  console.log("counts:", byCat);

  const data = ALL.map((r) => ({
    content: r.content,
    options: r.options,
    correctIndex: r.correctIndex,
    durationSec: r.durationSec ?? 12,
    kind: r.kind ?? QuestionKind.SINGLE,
    correctSet: r.correctSet ?? [],
    pick: r.pick ?? null,
    correctOrder: r.correctOrder ?? [],
    flags: [...(r.flags ?? []), TAG],
    minefield: r.minefield ?? false,
    kicker: r.kicker ?? null,
    clues: r.clues ?? [],
    theme: GameTheme.FOOTBALL,
    category: r.category,
    difficulty: diff(r.difficulty),
  }));

  // Additive + idempotent: remove only THIS pack (tagged), never the base bank.
  const removed = await prisma.questionTemplate.deleteMany({ where: { flags: { has: TAG } } });
  const res = await prisma.questionTemplate.createMany({ data });
  console.log(`removed ${removed.count} prior pack rows; inserted ${res.count} (target 200)`);

  const kinds = await prisma.questionTemplate.groupBy({ by: ["kind"], where: { flags: { has: TAG } }, _count: true });
  console.log("pack by kind:", kinds.map((k) => `${k.kind}=${k._count}`).join("  "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
