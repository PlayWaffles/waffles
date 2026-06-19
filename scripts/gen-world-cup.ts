// One-shot generator for the Waffles v2 "world-cup" trivia pack.
//
// Holds a curated, fact-checked dataset and emits questions wc-026..wc-500
// into src/app/v2/_app/data/questions.ts (the hand-authored wc-001..025 are
// left untouched). Idempotent: re-running strips any existing wc-026+ rows
// first, so it can be edited and re-run freely.
//
// Run:  node scripts/gen-world-cup.ts   (Node >= 23.6 strips TS types)

import fs from "node:fs";
import path from "node:path";

type Diff = "easy" | "medium" | "hard";
type Idx = 0 | 1 | 2 | 3;
type Row = [Diff, string, [string, string, string, string], Idx, string];

const Q: Row[] = [];
const add = (...rows: Row[]) => Q.push(...rows);

// Shorthand source URLs.
const W = (slug: string) => `https://en.wikipedia.org/wiki/${slug}`;

// ─────────────────────────────────────────────────────────────────────
// Edition-by-edition results (winner, host, runner-up, final, top scorer,
// venue, iconic moments). Facts cross-checked against each edition's article.
// ─────────────────────────────────────────────────────────────────────

// 1930 — Uruguay
add(
  ["medium", "Which country hosted the very first World Cup, in 1930?", ["Uruguay", "Argentina", "Brazil", "Italy"], 0, W("1930_FIFA_World_Cup")],
  ["medium", "Who did Uruguay beat in the 1930 World Cup final?", ["Argentina", "Brazil", "United States", "Chile"], 0, W("1930_FIFA_World_Cup_final")],
  ["hard", "What was the score in the 1930 World Cup final?", ["4–2", "2–1", "3–0", "1–0"], 0, W("1930_FIFA_World_Cup_final")],
  ["hard", "Who is credited with the first goal in World Cup history (1930)?", ["Lucien Laurent", "Guillermo Stábile", "Bert Patenaude", "Pedro Cea"], 0, W("Lucien_Laurent")],
  ["hard", "Who was the top scorer at the 1930 World Cup?", ["Guillermo Stábile", "Pedro Cea", "Bert Patenaude", "Lucien Laurent"], 0, W("Guillermo_St%C3%A1bile")],
  ["hard", "Which Montevideo stadium hosted the 1930 World Cup final?", ["Estadio Centenario", "La Bombonera", "Maracanã", "El Monumental"], 0, W("Estadio_Centenario")],
);

// 1934 — Italy
add(
  ["medium", "Which country won the 1934 World Cup, played on home soil?", ["Italy", "Czechoslovakia", "Austria", "Germany"], 0, W("1934_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1934 World Cup?", ["Italy", "France", "Spain", "Switzerland"], 0, W("1934_FIFA_World_Cup")],
  ["hard", "Who did Italy beat in the 1934 World Cup final?", ["Czechoslovakia", "Hungary", "Austria", "Germany"], 0, W("1934_FIFA_World_Cup_final")],
  ["hard", "Which nation was the first from Africa to play at a World Cup (1934)?", ["Egypt", "Morocco", "Tunisia", "Nigeria"], 0, W("Egypt_national_football_team")],
);

// 1938 — France
add(
  ["medium", "Which country won the 1938 World Cup, retaining their title?", ["Italy", "Hungary", "Brazil", "France"], 0, W("1938_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1938 World Cup?", ["France", "Italy", "Belgium", "Switzerland"], 0, W("1938_FIFA_World_Cup")],
  ["hard", "Who did Italy beat in the 1938 World Cup final?", ["Hungary", "Brazil", "France", "Czechoslovakia"], 0, W("1938_FIFA_World_Cup_final")],
  ["hard", "Which Brazilian forward was the top scorer of the 1938 World Cup?", ["Leônidas", "Silvio Piola", "Gyula Zsengellér", "György Sárosi"], 0, W("Leônidas_(footballer,_born_1913)")],
);

// 1950 — Brazil
add(
  ["medium", "Which country won the 1950 World Cup?", ["Uruguay", "Brazil", "Sweden", "Spain"], 0, W("1950_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1950 World Cup?", ["Brazil", "Uruguay", "Argentina", "Chile"], 0, W("1950_FIFA_World_Cup")],
  ["hard", "In which stadium did Uruguay shock Brazil to win the 1950 World Cup?", ["Maracanã", "Pacaembu", "Mineirão", "Morumbi"], 0, W("Maracan%C3%A3_Stadium")],
  ["hard", "Who was the top scorer of the 1950 World Cup?", ["Ademir", "Zizinho", "Óscar Míguez", "Chico"], 0, W("Ademir_Marques_de_Menezes")],
);

// 1954 — Switzerland
add(
  ["medium", "Which country won the 1954 World Cup?", ["West Germany", "Hungary", "Austria", "Uruguay"], 0, W("1954_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1954 World Cup?", ["Switzerland", "West Germany", "Austria", "Italy"], 0, W("1954_FIFA_World_Cup")],
  ["hard", "The 1954 'Miracle of Bern' saw West Germany beat which 'Mighty Magyars' side?", ["Hungary", "Austria", "Brazil", "Uruguay"], 0, W("1954_FIFA_World_Cup_final")],
  ["hard", "Who was the top scorer of the 1954 World Cup, with 11 goals?", ["Sándor Kocsis", "Ferenc Puskás", "Just Fontaine", "Max Morlock"], 0, W("S%C3%A1ndor_Kocsis")],
  ["hard", "Which 1954 quarterfinal is the highest-scoring match in World Cup history, ending 7–5?", ["Austria vs Switzerland", "Hungary vs Brazil", "Germany vs Turkey", "Uruguay vs Scotland"], 0, W("Austria_v_Switzerland_(1954_FIFA_World_Cup)")],
);

// 1958 — Sweden
add(
  ["easy", "Which country won the 1958 World Cup, their first title?", ["Brazil", "Sweden", "France", "West Germany"], 0, W("1958_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1958 World Cup?", ["Sweden", "Switzerland", "Norway", "Denmark"], 0, W("1958_FIFA_World_Cup")],
  ["medium", "A 17-year-old Pelé announced himself to the world at which tournament?", ["1958 World Cup", "1962 World Cup", "1954 World Cup", "1966 World Cup"], 0, W("Pel%C3%A9")],
  ["hard", "Who did Brazil beat 5–2 in the 1958 World Cup final?", ["Sweden", "France", "West Germany", "Hungary"], 0, W("1958_FIFA_World_Cup_final")],
);

// 1962 — Chile
add(
  ["medium", "Which country won the 1962 World Cup?", ["Brazil", "Czechoslovakia", "Chile", "Yugoslavia"], 0, W("1962_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1962 World Cup?", ["Chile", "Brazil", "Argentina", "Uruguay"], 0, W("1962_FIFA_World_Cup")],
  ["hard", "With Pelé injured early, which dribbling winger inspired Brazil's 1962 triumph?", ["Garrincha", "Vavá", "Didi", "Amarildo"], 0, W("Garrincha")],
  ["hard", "Who did Brazil beat in the 1962 World Cup final?", ["Czechoslovakia", "Chile", "Yugoslavia", "Hungary"], 0, W("1962_FIFA_World_Cup_final")],
);

// 1966 — England
add(
  ["hard", "Who scored a hat-trick in the 1966 World Cup final?", ["Geoff Hurst", "Bobby Charlton", "Roger Hunt", "Martin Peters"], 0, W("Geoff_Hurst")],
  ["medium", "Who did England beat in the 1966 World Cup final?", ["West Germany", "Portugal", "Brazil", "Soviet Union"], 0, W("1966_FIFA_World_Cup_final")],
  ["hard", "Who was the top scorer of the 1966 World Cup, with 9 goals?", ["Eusébio", "Geoff Hurst", "Bobby Charlton", "Franz Beckenbauer"], 0, W("Eus%C3%A9bio")],
  ["hard", "Which London stadium hosted the 1966 World Cup final?", ["Wembley", "Old Trafford", "Anfield", "Highbury"], 0, W("Wembley_Stadium_(1923)")],
  ["medium", "Which captain lifted the trophy for England in 1966?", ["Bobby Moore", "Bobby Charlton", "Geoff Hurst", "Gordon Banks"], 0, W("Bobby_Moore")],
  ["easy", "The first World Cup mascot, 'World Cup Willie' (1966), was what animal?", ["Lion", "Bulldog", "Bear", "Eagle"], 0, W("World_Cup_Willie")],
);

// 1970 — Mexico
add(
  ["easy", "Which country won the 1970 World Cup, keeping the Jules Rimet Trophy for good?", ["Brazil", "Italy", "West Germany", "Uruguay"], 0, W("1970_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1970 World Cup?", ["Mexico", "Brazil", "Argentina", "Chile"], 0, W("1970_FIFA_World_Cup")],
  ["hard", "Who did Brazil beat 4–1 in the 1970 World Cup final?", ["Italy", "West Germany", "Uruguay", "England"], 0, W("1970_FIFA_World_Cup_final")],
  ["hard", "Who scored Brazil's celebrated fourth goal in the 1970 final?", ["Carlos Alberto", "Pelé", "Jairzinho", "Tostão"], 0, W("Carlos_Alberto_Torres")],
  ["hard", "Who was the top scorer of the 1970 World Cup?", ["Gerd Müller", "Pelé", "Jairzinho", "Luigi Riva"], 0, W("Gerd_M%C3%BCller")],
  ["medium", "Which legend won his third World Cup winners' medal in 1970?", ["Pelé", "Garrincha", "Tostão", "Rivelino"], 0, W("Pel%C3%A9")],
);

// 1974 — West Germany
add(
  ["medium", "Which country won the 1974 World Cup?", ["West Germany", "Netherlands", "Poland", "Brazil"], 0, W("1974_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1974 World Cup?", ["West Germany", "Netherlands", "Sweden", "Switzerland"], 0, W("1974_FIFA_World_Cup")],
  ["hard", "Who did West Germany beat in the 1974 World Cup final?", ["Netherlands", "Poland", "Brazil", "Sweden"], 0, W("1974_FIFA_World_Cup_final")],
  ["hard", "Which Dutch maestro popularised 'Total Football' at the 1974 World Cup?", ["Johan Cruyff", "Johan Neeskens", "Ruud Krol", "Rob Rensenbrink"], 0, W("Johan_Cruyff")],
  ["hard", "Who was the top scorer of the 1974 World Cup?", ["Grzegorz Lato", "Johan Cruyff", "Gerd Müller", "Andrzej Szarmach"], 0, W("Grzegorz_Lato")],
  ["hard", "Which captain, nicknamed 'Der Kaiser', lifted the 1974 trophy for West Germany?", ["Franz Beckenbauer", "Gerd Müller", "Sepp Maier", "Paul Breitner"], 0, W("Franz_Beckenbauer")],
  ["easy", "The current World Cup trophy debuted in 1974. What was the original trophy called?", ["Jules Rimet Trophy", "FIFA Cup", "Coupe du Monde", "Victory Trophy"], 0, W("Jules_Rimet_Trophy")],
);

// 1978 — Argentina
add(
  ["medium", "Which country won the 1978 World Cup on home soil?", ["Argentina", "Netherlands", "Brazil", "Italy"], 0, W("1978_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1978 World Cup?", ["Argentina", "Brazil", "Chile", "Uruguay"], 0, W("1978_FIFA_World_Cup")],
  ["hard", "Who did Argentina beat in the 1978 World Cup final?", ["Netherlands", "Brazil", "Italy", "Peru"], 0, W("1978_FIFA_World_Cup_final")],
  ["hard", "Who was the top scorer of the 1978 World Cup?", ["Mario Kempes", "Rob Rensenbrink", "Teófilo Cubillas", "Hans Krankl"], 0, W("Mario_Kempes")],
);

// 1982 — Spain
add(
  ["medium", "Which country won the 1982 World Cup?", ["Italy", "West Germany", "Poland", "France"], 0, W("1982_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1982 World Cup?", ["Spain", "Italy", "France", "Portugal"], 0, W("1982_FIFA_World_Cup")],
  ["hard", "Who did Italy beat 3–1 in the 1982 World Cup final?", ["West Germany", "Poland", "France", "Brazil"], 0, W("1982_FIFA_World_Cup_final")],
  ["hard", "Who won the Golden Boot at the 1982 World Cup?", ["Paolo Rossi", "Karl-Heinz Rummenigge", "Zico", "Falcão"], 0, W("Paolo_Rossi")],
  ["hard", "Which 40-year-old goalkeeper captained Italy to the 1982 title?", ["Dino Zoff", "Walter Zenga", "Gianluigi Buffon", "Enrico Albertosi"], 0, W("Dino_Zoff")],
  ["hard", "The 1982 World Cup expanded the field to how many teams?", ["24", "16", "20", "32"], 0, W("1982_FIFA_World_Cup")],
);

// 1986 — Mexico
add(
  ["easy", "Which country won the 1986 World Cup?", ["Argentina", "West Germany", "France", "Brazil"], 0, W("1986_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1986 World Cup after Colombia withdrew?", ["Mexico", "United States", "Brazil", "Spain"], 0, W("1986_FIFA_World_Cup")],
  ["hard", "Who did Argentina beat 3–2 in the 1986 World Cup final?", ["West Germany", "France", "Belgium", "Brazil"], 0, W("1986_FIFA_World_Cup_final")],
  ["hard", "Maradona's solo 'Goal of the Century' in 1986 was scored against which team?", ["England", "Belgium", "West Germany", "Italy"], 0, W("Argentina_v_England_(1986_FIFA_World_Cup)")],
  ["medium", "Who captained Argentina to the 1986 World Cup title?", ["Diego Maradona", "Jorge Valdano", "Oscar Ruggeri", "Sergio Batista"], 0, W("Diego_Maradona")],
  ["hard", "Who won the Golden Boot at the 1986 World Cup?", ["Gary Lineker", "Diego Maradona", "Careca", "Emilio Butragueño"], 0, W("Gary_Lineker")],
  ["medium", "Which stadium hosted both the 1970 and 1986 World Cup finals?", ["Estadio Azteca", "Maracanã", "Wembley", "Estadio Centenario"], 0, W("Estadio_Azteca")],
);

// 1990 — Italy
add(
  ["medium", "Which country won the 1990 World Cup?", ["West Germany", "Argentina", "Italy", "England"], 0, W("1990_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1990 World Cup?", ["Italy", "Spain", "West Germany", "France"], 0, W("1990_FIFA_World_Cup")],
  ["hard", "Who scored the winning penalty in the 1990 World Cup final?", ["Andreas Brehme", "Lothar Matthäus", "Jürgen Klinsmann", "Rudi Völler"], 0, W("1990_FIFA_World_Cup_final")],
  ["hard", "Which 38-year-old delighted fans with his corner-flag dance for Cameroon in 1990?", ["Roger Milla", "Samuel Eto'o", "François Omam-Biyik", "Patrick Mboma"], 0, W("Roger_Milla")],
  ["hard", "Who won the Golden Boot at the 1990 World Cup?", ["Salvatore Schillaci", "Lothar Matthäus", "Gary Lineker", "Roger Milla"], 0, W("Salvatore_Schillaci")],
  ["medium", "England lost the 1990 semifinal on penalties to which team?", ["West Germany", "Italy", "Argentina", "Netherlands"], 0, W("1990_FIFA_World_Cup")],
);

// 1994 — United States
add(
  ["medium", "Which country won the 1994 World Cup?", ["Brazil", "Italy", "Sweden", "Bulgaria"], 0, W("1994_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1994 World Cup?", ["United States", "Mexico", "Canada", "Brazil"], 0, W("1994_FIFA_World_Cup")],
  ["hard", "Who missed the decisive penalty for Italy in the 1994 final shootout?", ["Roberto Baggio", "Franco Baresi", "Daniele Massaro", "Paolo Maldini"], 0, W("1994_FIFA_World_Cup_final")],
  ["hard", "Who did Brazil beat on penalties in the 1994 World Cup final?", ["Italy", "Sweden", "Bulgaria", "Netherlands"], 0, W("1994_FIFA_World_Cup_final")],
  ["hard", "Colombian defender Andrés Escobar was killed after an own goal at which World Cup?", ["1994", "1990", "1986", "1998"], 0, W("Andr%C3%A9s_Escobar")],
  ["hard", "Which California stadium hosted the 1994 World Cup final?", ["Rose Bowl", "Soldier Field", "Giants Stadium", "Cotton Bowl"], 0, W("Rose_Bowl_(stadium)")],
  ["medium", "Which surprise team finished fourth at the 1994 World Cup?", ["Bulgaria", "Romania", "Nigeria", "Saudi Arabia"], 0, W("1994_FIFA_World_Cup")],
);

// 1998 — France
add(
  ["easy", "Which country won the 1998 World Cup on home soil?", ["France", "Brazil", "Croatia", "Netherlands"], 0, W("1998_FIFA_World_Cup")],
  ["medium", "Which country hosted the 1998 World Cup?", ["France", "Italy", "Spain", "Germany"], 0, W("1998_FIFA_World_Cup")],
  ["hard", "Who scored twice in the 1998 final as France beat Brazil 3–0?", ["Zinedine Zidane", "Emmanuel Petit", "Thierry Henry", "Lilian Thuram"], 0, W("1998_FIFA_World_Cup_final")],
  ["hard", "Who won the Golden Boot at the 1998 World Cup?", ["Davor Šuker", "Ronaldo", "Christian Vieri", "Gabriel Batistuta"], 0, W("Davor_%C5%A0uker")],
  ["medium", "The 1998 World Cup expanded the field to how many teams?", ["32", "24", "16", "40"], 0, W("1998_FIFA_World_Cup")],
  ["hard", "Which nation reached the semifinals on their World Cup debut in 1998?", ["Croatia", "Senegal", "Ukraine", "Slovenia"], 0, W("Croatia_national_football_team")],
  ["hard", "Which stadium hosted the 1998 World Cup final?", ["Stade de France", "Parc des Princes", "Stade Vélodrome", "Stade Gerland"], 0, W("Stade_de_France")],
);

// 2002 — South Korea / Japan
add(
  ["easy", "Which country won the 2002 World Cup?", ["Brazil", "Germany", "Turkey", "South Korea"], 0, W("2002_FIFA_World_Cup")],
  ["hard", "Who did Brazil beat 2–0 in the 2002 World Cup final?", ["Germany", "South Korea", "Turkey", "Spain"], 0, W("2002_FIFA_World_Cup_final")],
  ["medium", "Who won the 2002 Golden Boot with 8 goals?", ["Ronaldo", "Rivaldo", "Miroslav Klose", "Ronaldinho"], 0, W("Ronaldo_(Brazilian_footballer)")],
  ["hard", "Which co-host stunned the world by reaching the 2002 semifinals?", ["South Korea", "Japan", "Turkey", "Senegal"], 0, W("South_Korea_national_football_team")],
  ["hard", "Which African debutant beat holders France in the opening match of 2002?", ["Senegal", "Cameroon", "Nigeria", "Ghana"], 0, W("Senegal_national_football_team")],
  ["hard", "Which nation finished third at the 2002 World Cup, their best-ever result?", ["Turkey", "South Korea", "United States", "Senegal"], 0, W("2002_FIFA_World_Cup")],
);

// 2006 — Germany
add(
  ["easy", "Which country won the 2006 World Cup?", ["Italy", "France", "Germany", "Portugal"], 0, W("2006_FIFA_World_Cup")],
  ["medium", "Which country hosted the 2006 World Cup?", ["Germany", "Italy", "France", "Switzerland"], 0, W("2006_FIFA_World_Cup")],
  ["hard", "Zinedine Zidane was sent off in the 2006 final for headbutting whom?", ["Marco Materazzi", "Fabio Cannavaro", "Gennaro Gattuso", "Andrea Pirlo"], 0, W("2006_FIFA_World_Cup_final")],
  ["hard", "How was the 2006 World Cup final decided?", ["Penalty shootout", "Extra-time goal", "90 minutes", "Replay"], 0, W("2006_FIFA_World_Cup_final")],
  ["hard", "Who won the Golden Boot at the 2006 World Cup?", ["Miroslav Klose", "Thierry Henry", "Hernán Crespo", "Lukas Podolski"], 0, W("Miroslav_Klose")],
  ["medium", "Which defender captained Italy in 2006 and won the Ballon d'Or that year?", ["Fabio Cannavaro", "Paolo Maldini", "Alessandro Nesta", "Gianluca Zambrotta"], 0, W("Fabio_Cannavaro")],
);

// 2010 — South Africa
add(
  ["easy", "Which country won the 2010 World Cup, their first title?", ["Spain", "Netherlands", "Germany", "Uruguay"], 0, W("2010_FIFA_World_Cup")],
  ["medium", "Which country hosted the 2010 World Cup, the first held in Africa?", ["South Africa", "Nigeria", "Egypt", "Morocco"], 0, W("2010_FIFA_World_Cup")],
  ["hard", "Who scored the extra-time winner in the 2010 World Cup final?", ["Andrés Iniesta", "David Villa", "Xavi", "Cesc Fàbregas"], 0, W("2010_FIFA_World_Cup_final")],
  ["hard", "Who did Spain beat 1–0 in the 2010 final?", ["Netherlands", "Germany", "Uruguay", "Brazil"], 0, W("2010_FIFA_World_Cup_final")],
  ["easy", "Which loud plastic horn became the sound of the 2010 World Cup?", ["Vuvuzela", "Kazoo", "Air horn", "Bugle"], 0, W("Vuvuzela")],
  ["medium", "Which octopus 'predicted' a string of 2010 World Cup results?", ["Paul", "Octi", "Nemo", "Inky"], 0, W("Paul_the_Octopus")],
  ["medium", "What was the title of Shakira's official 2010 World Cup song?", ["Waka Waka", "Wavin' Flag", "La La La", "We Are One"], 0, W("Waka_Waka_(This_Time_for_Africa)")],
  ["hard", "Who won the Golden Ball as best player of the 2010 World Cup?", ["Diego Forlán", "Wesley Sneijder", "David Villa", "Andrés Iniesta"], 0, W("Diego_Forl%C3%A1n")],
);

// 2014 — Brazil
add(
  ["hard", "Who scored the extra-time winner for Germany in the 2014 final?", ["Mario Götze", "Thomas Müller", "Miroslav Klose", "André Schürrle"], 0, W("2014_FIFA_World_Cup_final")],
  ["hard", "Who did Germany beat 1–0 in the 2014 World Cup final?", ["Argentina", "Brazil", "Netherlands", "Chile"], 0, W("2014_FIFA_World_Cup_final")],
  ["medium", "Who won the Golden Boot at the 2014 World Cup?", ["James Rodríguez", "Thomas Müller", "Lionel Messi", "Neymar"], 0, W("James_Rodr%C3%ADguez")],
  ["easy", "By what humbling score did Germany beat hosts Brazil in the 2014 semifinal?", ["7–1", "5–0", "4–0", "6–2"], 0, W("Brazil_v_Germany_(2014_FIFA_World_Cup)")],
  ["medium", "Which Rio stadium hosted the 2014 World Cup final?", ["Maracanã", "Mineirão", "Arena Corinthians", "Mané Garrincha"], 0, W("Maracan%C3%A3_Stadium")],
  ["easy", "The 2014 World Cup mascot Fuleco was based on what animal?", ["Armadillo", "Sloth", "Jaguar", "Toucan"], 0, W("Fuleco")],
);

// 2018 — Russia
add(
  ["easy", "Which country won the 2018 World Cup?", ["France", "Croatia", "Belgium", "England"], 0, W("2018_FIFA_World_Cup")],
  ["hard", "What was the score in the 2018 World Cup final?", ["4–2", "2–1", "3–1", "2–0"], 0, W("2018_FIFA_World_Cup_final")],
  ["medium", "Who won the Golden Boot at the 2018 World Cup?", ["Harry Kane", "Kylian Mbappé", "Antoine Griezmann", "Romelu Lukaku"], 0, W("Harry_Kane")],
  ["medium", "Which teenager scored in the 2018 final and won Best Young Player?", ["Kylian Mbappé", "Ousmane Dembélé", "Marcus Rashford", "Trent Alexander-Arnold"], 0, W("Kylian_Mbapp%C3%A9")],
  ["hard", "Which video review system was used at a World Cup for the first time in 2018?", ["VAR", "Goal-line technology", "Hawk-Eye", "Smart ball"], 0, W("Video_assistant_referee")],
  ["hard", "Who won the Golden Ball as best player of the 2018 World Cup?", ["Luka Modrić", "Kylian Mbappé", "Antoine Griezmann", "Eden Hazard"], 0, W("Luka_Modri%C4%87")],
  ["medium", "Which country finished third at the 2018 World Cup?", ["Belgium", "England", "Croatia", "Russia"], 0, W("2018_FIFA_World_Cup")],
  ["easy", "The 2018 World Cup mascot Zabivaka was what animal?", ["Wolf", "Bear", "Fox", "Husky"], 0, W("Zabivaka")],
);

// 2022 — Qatar
add(
  ["hard", "What was the score after extra time in the 2022 World Cup final?", ["3–3", "2–2", "4–4", "3–2"], 0, W("2022_FIFA_World_Cup_final")],
  ["medium", "Which African nation reached the World Cup semifinals for the first time in 2022?", ["Morocco", "Senegal", "Tunisia", "Ghana"], 0, W("Morocco_national_football_team")],
  ["hard", "Which team shocked Argentina with a 2–1 win in their 2022 opener?", ["Saudi Arabia", "Japan", "Iran", "Mexico"], 0, W("Argentina_v_Saudi_Arabia_(2022_FIFA_World_Cup)")],
  ["hard", "Which team beat both Germany and Spain in the 2022 group stage?", ["Japan", "Costa Rica", "Morocco", "South Korea"], 0, W("Japan_national_football_team")],
  ["medium", "How many goals did Kylian Mbappé score in the 2022 final?", ["3", "2", "1", "4"], 0, W("2022_FIFA_World_Cup_final")],
  ["medium", "Which Argentina goalkeeper won the Golden Glove in 2022?", ["Emiliano Martínez", "Franco Armani", "Gerónimo Rulli", "Juan Musso"], 0, W("Emiliano_Mart%C3%ADnez")],
  ["easy", "The 2022 World Cup was the first ever held in which Northern-Hemisphere season?", ["Winter", "Summer", "Spring", "Autumn"], 0, W("2022_FIFA_World_Cup")],
  ["easy", "Which nation hosted the first World Cup in the Middle East, in 2022?", ["Qatar", "United Arab Emirates", "Saudi Arabia", "Bahrain"], 0, W("2022_FIFA_World_Cup")],
);

// ─────────────────────────────────────────────────────────────────────
// Per-edition supplements — finals, semifinals, awards, iconic moments.
// ─────────────────────────────────────────────────────────────────────
add(
  ["hard", "How many teams competed at the inaugural 1930 World Cup?", ["13", "16", "8", "20"], 0, W("1930_FIFA_World_Cup")],
  ["hard", "Which North American side finished third at the 1930 World Cup?", ["United States", "Mexico", "Canada", "Cuba"], 0, W("1930_FIFA_World_Cup")],
  ["hard", "Who scored Uruguay's winning goal in the decisive 1950 match against Brazil?", ["Alcides Ghiggia", "Juan Schiaffino", "Óscar Míguez", "Julio Pérez"], 0, W("Alcides_Ghiggia")],
  ["hard", "Which country finished third at the 1954 World Cup?", ["Austria", "Uruguay", "Hungary", "Switzerland"], 0, W("1954_FIFA_World_Cup")],
  ["hard", "Which 17-year-old scored twice in the 1958 World Cup final?", ["Pelé", "Garrincha", "Vavá", "Mário Zagallo"], 0, W("Pel%C3%A9")],
  ["medium", "Brazil retained the World Cup in 1962, having also won in which year?", ["1958", "1954", "1950", "1966"], 0, W("Brazil_national_football_team")],
  ["hard", "Which team did England beat in the 1966 semifinal?", ["Portugal", "Soviet Union", "West Germany", "Italy"], 0, W("1966_FIFA_World_Cup")],
  ["hard", "North Korea pulled off a shock 1–0 win over which team at the 1966 World Cup?", ["Italy", "Portugal", "Hungary", "Chile"], 0, W("1966_FIFA_World_Cup")],
  ["hard", "The 1970 semifinal dubbed the 'Game of the Century' was Italy versus which team?", ["West Germany", "Brazil", "Uruguay", "England"], 0, W("Italy_v_West_Germany_(1970_FIFA_World_Cup)")],
  ["hard", "Which England goalkeeper made a famous save from a Pelé header in 1970?", ["Gordon Banks", "Peter Shilton", "Ray Clemence", "Peter Bonetti"], 0, W("Gordon_Banks")],
  ["hard", "Which country finished third at the 1974 World Cup?", ["Poland", "Brazil", "Sweden", "Yugoslavia"], 0, W("1974_FIFA_World_Cup")],
  ["hard", "Which striker scored twice in the 1978 final for Argentina?", ["Mario Kempes", "Leopoldo Luque", "Daniel Bertoni", "Osvaldo Ardiles"], 0, W("Mario_Kempes")],
  ["hard", "Paolo Rossi's hat-trick knocked Brazil out of the 1982 World Cup in a 3–2 win for which team?", ["Italy", "Poland", "France", "West Germany"], 0, W("Italy_v_Brazil_(1982_FIFA_World_Cup)")],
  ["hard", "The first penalty shootout in World Cup history (a 1982 semifinal) was West Germany against which team?", ["France", "Italy", "Poland", "Spain"], 0, W("France_v_West_Germany_(1982_FIFA_World_Cup)")],
  ["hard", "Which country finished third at the 1990 World Cup as hosts?", ["Italy", "England", "West Germany", "Argentina"], 0, W("1990_FIFA_World_Cup")],
  ["hard", "Which country finished third at the 1994 World Cup?", ["Sweden", "Bulgaria", "Romania", "Italy"], 0, W("1994_FIFA_World_Cup")],
  ["hard", "Which Romania playmaker dazzled at the 1994 World Cup?", ["Gheorghe Hagi", "Dan Petrescu", "Florin Răducioiu", "Ilie Dumitrescu"], 0, W("Gheorghe_Hagi")],
  ["hard", "Which French defender scored both goals in the 1998 semifinal win over Croatia?", ["Lilian Thuram", "Marcel Desailly", "Laurent Blanc", "Bixente Lizarazu"], 0, W("Lilian_Thuram")],
  ["hard", "Who won the Golden Ball as best player of the 2002 World Cup?", ["Oliver Kahn", "Ronaldo", "Hong Myung-bo", "Rivaldo"], 0, W("Oliver_Kahn")],
  ["hard", "Which French striker missed his kick in the 2006 World Cup final shootout?", ["David Trezeguet", "Thierry Henry", "Sylvain Wiltord", "Franck Ribéry"], 0, W("2006_FIFA_World_Cup_final")],
  ["hard", "Whose handball on the line denied Ghana in the 2010 quarterfinal?", ["Luis Suárez", "Diego Forlán", "Edinson Cavani", "Diego Lugano"], 0, W("Uruguay_v_Ghana_(2010_FIFA_World_Cup)")],
  ["hard", "Who won the Golden Boot at the 2010 World Cup?", ["Thomas Müller", "David Villa", "Wesley Sneijder", "Diego Forlán"], 0, W("Thomas_M%C3%BCller")],
  ["medium", "Who won the Golden Ball as best player of the 2014 World Cup?", ["Lionel Messi", "Thomas Müller", "James Rodríguez", "Arjen Robben"], 0, W("Lionel_Messi")],
  ["hard", "James Rodríguez scored a stunning chest-and-volley goal at the 2014 World Cup against which team?", ["Uruguay", "Brazil", "Japan", "Greece"], 0, W("James_Rodr%C3%ADguez")],
  ["hard", "Which host nation knocked Spain out on penalties at the 2018 World Cup?", ["Russia", "Croatia", "Denmark", "Sweden"], 0, W("2018_FIFA_World_Cup")],
  ["hard", "Who scored the winning penalty for Argentina in the 2022 World Cup final shootout?", ["Gonzalo Montiel", "Lautaro Martínez", "Lionel Messi", "Leandro Paredes"], 0, W("2022_FIFA_World_Cup_final")],
  ["medium", "Who became only the second player to score a hat-trick in a World Cup final, in 2022?", ["Kylian Mbappé", "Lionel Messi", "Olivier Giroud", "Julián Álvarez"], 0, W("2022_FIFA_World_Cup_final")],
  ["hard", "Belgium reached the 1986 semifinals before losing to which eventual champions?", ["Argentina", "West Germany", "France", "Brazil"], 0, W("1986_FIFA_World_Cup")],
);

// ─────────────────────────────── Final venue cities ───────────────────
add(
  ["hard", "Which city hosted the 1934 World Cup final?", ["Rome", "Milan", "Turin", "Naples"], 0, W("1934_FIFA_World_Cup_final")],
  ["hard", "Which city hosted the 1938 World Cup final?", ["Paris", "Marseille", "Lyon", "Bordeaux"], 0, W("1938_FIFA_World_Cup_final")],
  ["hard", "Which Swiss city hosted the 1954 World Cup final?", ["Bern", "Geneva", "Zurich", "Basel"], 0, W("1954_FIFA_World_Cup_final")],
  ["hard", "The 1958 World Cup final was played at the Råsunda Stadium near which capital?", ["Stockholm", "Oslo", "Copenhagen", "Helsinki"], 0, W("1958_FIFA_World_Cup_final")],
  ["hard", "Which city hosted the 1962 World Cup final?", ["Santiago", "Valparaíso", "Buenos Aires", "Lima"], 0, W("1962_FIFA_World_Cup_final")],
  ["hard", "Which city hosted the 1970 World Cup final?", ["Mexico City", "Guadalajara", "Monterrey", "Puebla"], 0, W("1970_FIFA_World_Cup_final")],
  ["hard", "Which German city hosted the 1974 World Cup final?", ["Munich", "Berlin", "Hamburg", "Frankfurt"], 0, W("1974_FIFA_World_Cup_final")],
  ["hard", "Which city hosted the 1978 World Cup final?", ["Buenos Aires", "Rosario", "Córdoba", "Mendoza"], 0, W("1978_FIFA_World_Cup_final")],
  ["hard", "Which city hosted the 1982 World Cup final?", ["Madrid", "Barcelona", "Seville", "Valencia"], 0, W("1982_FIFA_World_Cup_final")],
  ["medium", "Which city hosted the 1986 World Cup final?", ["Mexico City", "Guadalajara", "Monterrey", "Toluca"], 0, W("1986_FIFA_World_Cup_final")],
  ["hard", "Which city hosted the 1990 World Cup final?", ["Rome", "Milan", "Naples", "Turin"], 0, W("1990_FIFA_World_Cup_final")],
  ["medium", "Which Japanese city hosted the 2002 World Cup final?", ["Yokohama", "Tokyo", "Osaka", "Sapporo"], 0, W("2002_FIFA_World_Cup_final")],
  ["medium", "Which city hosted the 2006 World Cup final?", ["Berlin", "Munich", "Dortmund", "Frankfurt"], 0, W("2006_FIFA_World_Cup_final")],
  ["medium", "Which city hosted the 2018 World Cup final?", ["Moscow", "Saint Petersburg", "Kazan", "Sochi"], 0, W("2018_FIFA_World_Cup_final")],
  ["hard", "The decisive match of the 1950 World Cup was played in which city?", ["Rio de Janeiro", "São Paulo", "Belo Horizonte", "Brasília"], 0, W("1950_FIFA_World_Cup")],
);

// ─────────────────────────────── Player nationalities ─────────────────
add(
  ["medium", "Zinedine Zidane played for which national team?", ["France", "Algeria", "Italy", "Spain"], 0, W("Zinedine_Zidane")],
  ["medium", "Johan Cruyff played for which national team?", ["Netherlands", "Belgium", "Germany", "Spain"], 0, W("Johan_Cruyff")],
  ["medium", "Franz Beckenbauer played for which national team?", ["Germany", "Austria", "Netherlands", "Switzerland"], 0, W("Franz_Beckenbauer")],
  ["medium", "Roberto Baggio played for which national team?", ["Italy", "Argentina", "Brazil", "Spain"], 0, W("Roberto_Baggio")],
  ["easy", "Luka Modrić plays for which national team?", ["Croatia", "Serbia", "Slovenia", "Bosnia and Herzegovina"], 0, W("Luka_Modri%C4%87")],
  ["medium", "Eden Hazard played for which national team?", ["Belgium", "France", "Netherlands", "Portugal"], 0, W("Eden_Hazard")],
  ["easy", "Harry Kane plays for which national team?", ["England", "Ireland", "Scotland", "Wales"], 0, W("Harry_Kane")],
  ["medium", "Luis Suárez plays for which national team?", ["Uruguay", "Argentina", "Colombia", "Chile"], 0, W("Luis_Su%C3%A1rez")],
  ["easy", "Robert Lewandowski plays for which national team?", ["Poland", "Germany", "Czech Republic", "Ukraine"], 0, W("Robert_Lewandowski")],
  ["medium", "Mohamed Salah plays for which national team?", ["Egypt", "Morocco", "Algeria", "Tunisia"], 0, W("Mohamed_Salah")],
  ["medium", "Sadio Mané plays for which national team?", ["Senegal", "Mali", "Guinea", "Ivory Coast"], 0, W("Sadio_Man%C3%A9")],
  ["medium", "Son Heung-min plays for which national team?", ["South Korea", "Japan", "China", "North Korea"], 0, W("Son_Heung-min")],
  ["easy", "Ronaldinho played for which national team?", ["Brazil", "Argentina", "Portugal", "Spain"], 0, W("Ronaldinho")],
  ["medium", "Andrés Iniesta played for which national team?", ["Spain", "Portugal", "Italy", "Argentina"], 0, W("Andr%C3%A9s_Iniesta")],
  ["medium", "Manuel Neuer plays for which national team?", ["Germany", "Austria", "Switzerland", "Netherlands"], 0, W("Manuel_Neuer")],
  ["medium", "Gianluigi Buffon played for which national team?", ["Italy", "Spain", "France", "Portugal"], 0, W("Gianluigi_Buffon")],
  ["medium", "Thierry Henry played for which national team?", ["France", "Belgium", "England", "Portugal"], 0, W("Thierry_Henry")],
  ["medium", "Wayne Rooney played for which national team?", ["England", "Ireland", "Scotland", "Wales"], 0, W("Wayne_Rooney")],
  ["medium", "Andrea Pirlo played for which national team?", ["Italy", "Spain", "Argentina", "Brazil"], 0, W("Andrea_Pirlo")],
  ["medium", "Xavi Hernández played for which national team?", ["Spain", "Italy", "Portugal", "Mexico"], 0, W("Xavi")],
  ["medium", "Arjen Robben played for which national team?", ["Netherlands", "Belgium", "Germany", "Denmark"], 0, W("Arjen_Robben")],
  ["medium", "Didier Drogba played for which national team?", ["Ivory Coast", "Ghana", "Cameroon", "Nigeria"], 0, W("Didier_Drogba")],
  ["medium", "Samuel Eto'o played for which national team?", ["Cameroon", "Senegal", "Nigeria", "Ghana"], 0, W("Samuel_Eto%27o")],
  ["medium", "Gabriel Batistuta played for which national team?", ["Argentina", "Brazil", "Uruguay", "Chile"], 0, W("Gabriel_Batistuta")],
  ["medium", "Kaká played for which national team?", ["Brazil", "Portugal", "Argentina", "Italy"], 0, W("Kak%C3%A1")],
  ["medium", "Luís Figo played for which national team?", ["Portugal", "Spain", "Brazil", "Italy"], 0, W("Lu%C3%ADs_Figo")],
  ["medium", "Francesco Totti played for which national team?", ["Italy", "Spain", "Argentina", "France"], 0, W("Francesco_Totti")],
  ["medium", "Park Ji-sung played for which national team?", ["South Korea", "Japan", "China", "Thailand"], 0, W("Park_Ji-sung")],
  ["hard", "Jay-Jay Okocha played for which national team?", ["Nigeria", "Ghana", "Cameroon", "South Africa"], 0, W("Jay-Jay_Okocha")],
  ["medium", "Gareth Bale played for which national team?", ["Wales", "England", "Ireland", "Scotland"], 0, W("Gareth_Bale")],
  ["medium", "Christian Pulisic plays for which national team?", ["United States", "Canada", "Mexico", "England"], 0, W("Christian_Pulisic")],
  ["medium", "Sergio Ramos played for which national team?", ["Spain", "Portugal", "Italy", "Mexico"], 0, W("Sergio_Ramos")],
  ["medium", "Toni Kroos played for which national team?", ["Germany", "Austria", "Switzerland", "Poland"], 0, W("Toni_Kroos")],
  ["easy", "Ángel Di María plays for which national team?", ["Argentina", "Uruguay", "Chile", "Colombia"], 0, W("%C3%81ngel_Di_Mar%C3%ADa")],
  ["medium", "Karim Benzema played for which national team?", ["France", "Algeria", "Morocco", "Spain"], 0, W("Karim_Benzema")],
  ["medium", "Romelu Lukaku plays for which national team?", ["Belgium", "DR Congo", "France", "Netherlands"], 0, W("Romelu_Lukaku")],
  ["easy", "Vinícius Júnior plays for which national team?", ["Brazil", "Portugal", "Argentina", "Spain"], 0, W("Vin%C3%ADcius_J%C3%BAnior")],
  ["hard", "Rivaldo played for which national team?", ["Brazil", "Portugal", "Argentina", "Spain"], 0, W("Rivaldo")],
  ["hard", "Roberto Carlos played for which national team?", ["Brazil", "Portugal", "Spain", "Italy"], 0, W("Roberto_Carlos")],
  ["medium", "Paolo Maldini played for which national team?", ["Italy", "Spain", "France", "Portugal"], 0, W("Paolo_Maldini")],
  ["medium", "David Beckham played for which national team?", ["England", "Ireland", "Wales", "Scotland"], 0, W("David_Beckham")],
  ["medium", "Michael Owen played for which national team?", ["England", "Wales", "Scotland", "Ireland"], 0, W("Michael_Owen")],
  ["medium", "Dennis Bergkamp played for which national team?", ["Netherlands", "Belgium", "Germany", "Denmark"], 0, W("Dennis_Bergkamp")],
  ["hard", "Hugo Sánchez played for which national team?", ["Mexico", "Spain", "Argentina", "Colombia"], 0, W("Hugo_S%C3%A1nchez")],
  ["hard", "Carlos Valderrama, famed for his big curly hair, played for which national team?", ["Colombia", "Brazil", "Ecuador", "Venezuela"], 0, W("Carlos_Valderrama")],
);

// ─────────────────────────────── National-team nicknames ──────────────
add(
  ["medium", "Which national team is nicknamed 'Die Mannschaft'?", ["Germany", "Austria", "Switzerland", "Netherlands"], 0, W("Germany_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Azzurri'?", ["Italy", "Spain", "Argentina", "Brazil"], 0, W("Italy_national_football_team")],
  ["medium", "Which national team is nicknamed 'La Roja'?", ["Spain", "Chile", "Portugal", "Mexico"], 0, W("Spain_national_football_team")],
  ["easy", "Which national team is nicknamed the 'Three Lions'?", ["England", "Scotland", "Wales", "Ireland"], 0, W("England_national_football_team")],
  ["medium", "Which national team is nicknamed 'Oranje'?", ["Netherlands", "Belgium", "Germany", "Denmark"], 0, W("Netherlands_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Seleção'?", ["Brazil", "Portugal", "Argentina", "Spain"], 0, W("Brazil_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Super Eagles'?", ["Nigeria", "Ghana", "Cameroon", "Senegal"], 0, W("Nigeria_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Pharaohs'?", ["Egypt", "Morocco", "Algeria", "Tunisia"], 0, W("Egypt_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Indomitable Lions'?", ["Cameroon", "Senegal", "Nigeria", "Ghana"], 0, W("Cameroon_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Black Stars'?", ["Ghana", "Nigeria", "Senegal", "Mali"], 0, W("Ghana_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Atlas Lions'?", ["Morocco", "Algeria", "Tunisia", "Egypt"], 0, W("Morocco_national_football_team")],
  ["hard", "Which national team is nicknamed the 'Lions of Teranga'?", ["Senegal", "Cameroon", "Ivory Coast", "Mali"], 0, W("Senegal_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Socceroos'?", ["Australia", "New Zealand", "South Africa", "Canada"], 0, W("Australia_men%27s_national_soccer_team")],
  ["medium", "Which national team is nicknamed 'Samurai Blue'?", ["Japan", "South Korea", "China", "Thailand"], 0, W("Japan_national_football_team")],
  ["medium", "Which national team is nicknamed 'El Tri'?", ["Mexico", "Colombia", "Costa Rica", "Peru"], 0, W("Mexico_national_football_team")],
  ["medium", "Which national team is nicknamed 'La Celeste'?", ["Uruguay", "Argentina", "Chile", "Paraguay"], 0, W("Uruguay_national_football_team")],
  ["medium", "Which national team is nicknamed the 'Red Devils'?", ["Belgium", "Netherlands", "Switzerland", "Wales"], 0, W("Belgium_national_football_team")],
  ["hard", "Which national team is nicknamed 'Vatreni' (the Blazers)?", ["Croatia", "Serbia", "Slovenia", "Bosnia and Herzegovina"], 0, W("Croatia_national_football_team")],
  ["hard", "Which national team is nicknamed the 'Reggae Boyz'?", ["Jamaica", "Trinidad and Tobago", "Haiti", "Costa Rica"], 0, W("Jamaica_national_football_team")],
  ["hard", "Which national team is nicknamed the 'Taegeuk Warriors'?", ["South Korea", "Japan", "China", "Vietnam"], 0, W("South_Korea_national_football_team")],
  ["hard", "Which national team is nicknamed 'A Seleção das Quinas'?", ["Portugal", "Brazil", "Spain", "Italy"], 0, W("Portugal_national_football_team")],
);

// ─────────────────────────────── Titles & host years ──────────────────
add(
  ["medium", "In which year did Spain win their only World Cup?", ["2010", "2008", "2012", "2006"], 0, W("Spain_national_football_team")],
  ["medium", "In which year did France win their first World Cup?", ["1998", "1994", "2002", "1990"], 0, W("France_national_football_team")],
  ["hard", "Before 2022, Argentina's most recent World Cup title came in which year?", ["1986", "1978", "1990", "1994"], 0, W("Argentina_national_football_team")],
  ["medium", "Uruguay's most recent World Cup title came in which year?", ["1950", "1930", "1954", "1962"], 0, W("Uruguay_national_football_team")],
  ["medium", "Italy's most recent World Cup title came in which year?", ["2006", "1982", "1994", "2002"], 0, W("Italy_national_football_team")],
  ["medium", "Brazil's most recent World Cup title came in which year?", ["2002", "1994", "2006", "1998"], 0, W("Brazil_national_football_team")],
  ["hard", "How many World Cups has Brazil won?", ["5", "4", "6", "3"], 0, W("Brazil_national_football_team")],
  ["hard", "How many World Cups has Germany won (including as West Germany)?", ["4", "3", "5", "2"], 0, W("Germany_national_football_team")],
  ["hard", "How many World Cups has Italy won?", ["4", "3", "5", "2"], 0, W("Italy_national_football_team")],
  ["hard", "How many World Cups has Argentina won?", ["3", "2", "4", "1"], 0, W("Argentina_national_football_team")],
  ["hard", "How many World Cups has France won?", ["2", "1", "3", "4"], 0, W("France_national_football_team")],
  ["hard", "How many times has Uruguay won the World Cup?", ["2", "1", "3", "4"], 0, W("Uruguay_national_football_team")],
  ["medium", "In which year did Italy first host the World Cup?", ["1934", "1938", "1950", "1990"], 0, W("1934_FIFA_World_Cup")],
  ["medium", "In which year did Brazil first host the World Cup?", ["1950", "1962", "1970", "2014"], 0, W("1950_FIFA_World_Cup")],
  ["medium", "In which year did Mexico first host the World Cup?", ["1970", "1986", "1962", "1978"], 0, W("1970_FIFA_World_Cup")],
  ["medium", "In which year did the United States host the World Cup?", ["1994", "1986", "1990", "1998"], 0, W("1994_FIFA_World_Cup")],
  ["medium", "In which year did South Africa host the World Cup?", ["2010", "2006", "2014", "2002"], 0, W("2010_FIFA_World_Cup")],
);

// ─────────────────────────────── Records & firsts ─────────────────────
add(
  ["hard", "Who scored 15 World Cup goals, long second on the all-time list?", ["Ronaldo", "Gerd Müller", "Just Fontaine", "Pelé"], 0, W("Ronaldo_(Brazilian_footballer)")],
  ["hard", "Who holds the record for most goals at a single World Cup, with 13 in 1958?", ["Just Fontaine", "Sándor Kocsis", "Gerd Müller", "Eusébio"], 0, W("Just_Fontaine")],
  ["hard", "Who holds the record for most World Cup matches played?", ["Lionel Messi", "Lothar Matthäus", "Cristiano Ronaldo", "Paolo Maldini"], 0, W("Lionel_Messi")],
  ["hard", "Which Mexican goalkeeper was the first player to appear at five World Cups?", ["Antonio Carbajal", "Hugo Sánchez", "Jorge Campos", "Guillermo Ochoa"], 0, W("Antonio_Carbajal")],
  ["hard", "Who is the only head coach to win the World Cup twice?", ["Vittorio Pozzo", "Mário Zagallo", "Helmut Schön", "Carlos Bilardo"], 0, W("Vittorio_Pozzo")],
  ["hard", "Who won the World Cup as France's captain in 1998 and as their coach in 2018?", ["Didier Deschamps", "Zinedine Zidane", "Marcel Desailly", "Laurent Blanc"], 0, W("Didier_Deschamps")],
  ["hard", "Franz Beckenbauer won the World Cup as captain in 1974 and as coach in which year?", ["1990", "1986", "1982", "1994"], 0, W("Franz_Beckenbauer")],
  ["hard", "Who scored the fastest goal in World Cup history, in about 11 seconds in 2002?", ["Hakan Şükür", "Christian Vieri", "Davor Šuker", "Clint Dempsey"], 0, W("Hakan_%C5%9E%C3%BCk%C3%BCr")],
  ["hard", "Who is the oldest player to appear at a World Cup, aged 45 in 2018?", ["Essam El-Hadary", "Faryd Mondragón", "Roger Milla", "Dino Zoff"], 0, W("Essam_El-Hadary")],
  ["hard", "Who is the oldest goalscorer in World Cup history, aged 42 in 1994?", ["Roger Milla", "Cristiano Ronaldo", "Dino Zoff", "Pelé"], 0, W("Roger_Milla")],
  ["hard", "Who is the youngest goalscorer in World Cup history?", ["Pelé", "Kylian Mbappé", "Michael Owen", "Lionel Messi"], 0, W("Pel%C3%A9")],
  ["hard", "Who is the only player to score five goals in a single World Cup match?", ["Oleg Salenko", "Just Fontaine", "Gerd Müller", "Eusébio"], 0, W("Oleg_Salenko")],
  ["hard", "Who scored the first hat-trick in World Cup history, for the USA in 1930?", ["Bert Patenaude", "Guillermo Stábile", "Lucien Laurent", "Pedro Cea"], 0, W("Bert_Patenaude")],
  ["hard", "Which team scored a record 27 goals in a single World Cup tournament, in 1954?", ["Hungary", "Brazil", "West Germany", "Uruguay"], 0, W("1954_FIFA_World_Cup")],
  ["hard", "Which World Cup produced a record 172 goals?", ["2022", "2014", "1998", "2018"], 0, W("2022_FIFA_World_Cup")],
  ["hard", "As of 2022, how many host nations have won the World Cup?", ["6", "4", "8", "5"], 0, W("FIFA_World_Cup")],
  ["hard", "Which was the first team to win a World Cup held on another continent, in 1958?", ["Brazil", "Argentina", "Uruguay", "Italy"], 0, W("Brazil_national_football_team")],
  ["medium", "Who is the only player to win three World Cups?", ["Pelé", "Diego Maradona", "Cafu", "Mário Zagallo"], 0, W("Pel%C3%A9")],
  ["hard", "Holders Germany were knocked out in the group stage at which World Cup?", ["2018", "2014", "2010", "2022"], 0, W("2018_FIFA_World_Cup")],
  ["hard", "Holders France crashed out in the group stage at which World Cup?", ["2002", "1998", "2006", "2010"], 0, W("2002_FIFA_World_Cup")],
  ["hard", "Which Brazilian played in three straight World Cup finals (1994, 1998, 2002)?", ["Cafu", "Roberto Carlos", "Ronaldo", "Rivaldo"], 0, W("Cafu")],
  ["hard", "Which Soviet goalkeeper is the only keeper to win the Ballon d'Or?", ["Lev Yashin", "Rinat Dasayev", "Oliver Kahn", "Gordon Banks"], 0, W("Lev_Yashin")],
  ["hard", "Besides Brazil, which country also won back-to-back World Cups (1934 and 1938)?", ["Italy", "Germany", "Argentina", "Uruguay"], 0, W("Italy_national_football_team")],
  ["medium", "Which national team has reached the most World Cup finals?", ["Germany", "Brazil", "Italy", "Argentina"], 0, W("Germany_national_football_team")],
);

// ─────────────────────────────── Winning managers ─────────────────────
add(
  ["medium", "Who coached Spain to the 2010 World Cup title?", ["Vicente del Bosque", "Luis Aragonés", "Julen Lopetegui", "Luis Enrique"], 0, W("Vicente_del_Bosque")],
  ["medium", "Who coached Germany to the 2014 World Cup title?", ["Joachim Löw", "Jürgen Klinsmann", "Hansi Flick", "Rudi Völler"], 0, W("Joachim_L%C3%B6w")],
  ["medium", "Who coached Italy to the 2006 World Cup title?", ["Marcello Lippi", "Giovanni Trapattoni", "Cesare Prandelli", "Roberto Mancini"], 0, W("Marcello_Lippi")],
  ["medium", "Who coached France to their first World Cup title in 1998?", ["Aimé Jacquet", "Roger Lemerre", "Raymond Domenech", "Michel Hidalgo"], 0, W("Aim%C3%A9_Jacquet")],
  ["medium", "Who coached Argentina to the 1986 World Cup title?", ["Carlos Bilardo", "César Luis Menotti", "Alfio Basile", "Daniel Passarella"], 0, W("Carlos_Bilardo")],
  ["medium", "Who coached England to the 1966 World Cup title?", ["Alf Ramsey", "Walter Winterbottom", "Bobby Robson", "Don Revie"], 0, W("Alf_Ramsey")],
  ["medium", "Who coached Brazil to the 2002 World Cup title?", ["Luiz Felipe Scolari", "Mário Zagallo", "Carlos Alberto Parreira", "Tite"], 0, W("Luiz_Felipe_Scolari")],
  ["hard", "Who coached Argentina to the 1978 World Cup title?", ["César Luis Menotti", "Carlos Bilardo", "Marcelo Bielsa", "Alejandro Sabella"], 0, W("C%C3%A9sar_Luis_Menotti")],
  ["hard", "Who coached Italy to the 1982 World Cup title?", ["Enzo Bearzot", "Vittorio Pozzo", "Arrigo Sacchi", "Dino Zoff"], 0, W("Enzo_Bearzot")],
  ["hard", "Who coached Brazil's celebrated 1970 World Cup team?", ["Mário Zagallo", "Telê Santana", "Vicente Feola", "Carlos Alberto Parreira"], 0, W("M%C3%A1rio_Zagallo")],
  ["hard", "Who coached Brazil to the 1994 World Cup title?", ["Carlos Alberto Parreira", "Mário Zagallo", "Telê Santana", "Luiz Felipe Scolari"], 0, W("Carlos_Alberto_Parreira")],
  ["medium", "Who captained France to the 2018 World Cup title?", ["Hugo Lloris", "Antoine Griezmann", "Paul Pogba", "Raphaël Varane"], 0, W("Hugo_Lloris")],
  ["medium", "Who captained Germany to the 2014 World Cup title?", ["Philipp Lahm", "Bastian Schweinsteiger", "Manuel Neuer", "Toni Kroos"], 0, W("Philipp_Lahm")],
  ["medium", "Who captained Spain to the 2010 World Cup title?", ["Iker Casillas", "Carles Puyol", "Xavi", "Sergio Ramos"], 0, W("Iker_Casillas")],
);

// ─────────────────────────────── Knockout routes ──────────────────────
add(
  ["medium", "Croatia reached the 2018 final by beating which team in the semifinal?", ["England", "Russia", "Belgium", "France"], 0, W("2018_FIFA_World_Cup")],
  ["medium", "Which team did Argentina beat in the 2022 World Cup semifinal?", ["Croatia", "Morocco", "France", "Netherlands"], 0, W("2022_FIFA_World_Cup")],
  ["medium", "Which team did France beat in the 2022 World Cup semifinal?", ["Morocco", "England", "Croatia", "Portugal"], 0, W("2022_FIFA_World_Cup")],
  ["medium", "Which host nation did Italy beat in the 2006 World Cup semifinal?", ["Germany", "Portugal", "France", "Ukraine"], 0, W("2006_FIFA_World_Cup")],
  ["medium", "Which team knocked Brazil out in the 2006 quarterfinal?", ["France", "Germany", "Italy", "Portugal"], 0, W("2006_FIFA_World_Cup")],
  ["medium", "Which team knocked Brazil out in the 2010 quarterfinal?", ["Netherlands", "Spain", "Germany", "Uruguay"], 0, W("2010_FIFA_World_Cup")],
  ["hard", "Which co-host knocked Spain out in the 2002 quarterfinals?", ["South Korea", "Japan", "Turkey", "Senegal"], 0, W("2002_FIFA_World_Cup")],
  ["medium", "Which team did Spain beat in the 2010 World Cup semifinal?", ["Germany", "Netherlands", "Uruguay", "Paraguay"], 0, W("2010_FIFA_World_Cup")],
  ["medium", "Which team did the Netherlands beat in the 2010 World Cup semifinal?", ["Uruguay", "Brazil", "Ghana", "Spain"], 0, W("2010_FIFA_World_Cup")],
  ["hard", "Argentina beat which team on penalties in the 2014 semifinal?", ["Netherlands", "Belgium", "Brazil", "Germany"], 0, W("2014_FIFA_World_Cup")],
  ["medium", "Which European side knocked England out on penalties in the 2006 quarterfinals?", ["Portugal", "France", "Germany", "Italy"], 0, W("2006_FIFA_World_Cup")],
  ["hard", "Which team beat Brazil in the 2022 quarterfinals on penalties?", ["Croatia", "Argentina", "Morocco", "Netherlands"], 0, W("2022_FIFA_World_Cup")],
);

// ─────────────────────────────── Trophy & format ──────────────────────
add(
  ["hard", "Who designed the current FIFA World Cup Trophy?", ["Silvio Gazzaniga", "Abel Lafleur", "Sepp Blatter", "Jules Rimet"], 0, W("FIFA_World_Cup_Trophy")],
  ["hard", "The original World Cup trophy was renamed in 1946 in honour of which FIFA president?", ["Jules Rimet", "João Havelange", "Stanley Rous", "Sepp Blatter"], 0, W("Jules_Rimet_Trophy")],
  ["medium", "The current World Cup trophy is made mainly of which metal?", ["Gold", "Silver", "Bronze", "Platinum"], 0, W("FIFA_World_Cup_Trophy")],
  ["hard", "Brazil were allowed to keep the Jules Rimet Trophy permanently after winning it for a third time in which year?", ["1970", "1962", "1958", "1974"], 0, W("Jules_Rimet_Trophy")],
  ["medium", "There were no World Cups in 1942 and 1946 because of what?", ["World War II", "World War I", "The Great Depression", "A FIFA dispute"], 0, W("FIFA_World_Cup")],
  ["medium", "From 1998 to 2022, how many teams contested the World Cup finals?", ["32", "24", "16", "48"], 0, W("FIFA_World_Cup")],
  ["hard", "Goal-line technology was used at a World Cup for the first time in which year?", ["2014", "2010", "2018", "2006"], 0, W("Goal-line_technology")],
  ["hard", "The 'golden goal' rule, used from 1998 to 2002, did what?", ["Ended the match on the next goal in extra time", "Doubled a goal's value", "Awarded a bonus point", "Gave a free penalty"], 0, W("Golden_goal")],
  ["medium", "How long is the extra-time period in a knockout match, in total?", ["30 minutes", "20 minutes", "15 minutes", "45 minutes"], 0, W("Overtime_(sports)#Association_football")],
  ["medium", "FIFA, the World Cup's governing body, is headquartered in which country?", ["Switzerland", "France", "Belgium", "England"], 0, W("FIFA")],
);

// ─────────────────────────────── Confederations & qualifying ──────────
add(
  ["medium", "Which confederation governs European football?", ["UEFA", "CONMEBOL", "CONCACAF", "CAF"], 0, W("UEFA")],
  ["medium", "Which confederation governs African football?", ["CAF", "AFC", "OFC", "UEFA"], 0, W("Confederation_of_African_Football")],
  ["medium", "Which confederation governs Asian football?", ["AFC", "CAF", "OFC", "CONCACAF"], 0, W("Asian_Football_Confederation")],
  ["medium", "Which confederation governs North & Central American and Caribbean football?", ["CONCACAF", "CONMEBOL", "UEFA", "OFC"], 0, W("CONCACAF")],
  ["hard", "Which confederation governs football in Oceania?", ["OFC", "AFC", "CAF", "CONMEBOL"], 0, W("Oceania_Football_Confederation")],
  ["medium", "How many continental confederations make up FIFA?", ["6", "5", "4", "7"], 0, W("List_of_football_confederations")],
  ["medium", "Which team always qualifies automatically for the World Cup?", ["The host nation", "The defending champion", "The top-ranked team", "The previous runner-up"], 0, W("FIFA_World_Cup_qualification")],
  ["hard", "Since 2006, the defending champions no longer receive what?", ["Automatic qualification", "A seeding bonus", "Extra substitutes", "Home advantage"], 0, W("FIFA_World_Cup_qualification")],
  ["hard", "Which confederation's teams have won the most World Cups?", ["UEFA (Europe)", "CONMEBOL (South America)", "CONCACAF", "CAF (Africa)"], 0, W("FIFA_World_Cup")],
  ["medium", "Which confederation does Argentina belong to for World Cup qualifying?", ["CONMEBOL", "CONCACAF", "UEFA", "AFC"], 0, W("CONMEBOL")],
);

// ─────────────────────────────── Laws of the game ─────────────────────
add(
  ["medium", "From what distance is a penalty kick taken?", ["12 yards (about 11 m)", "10 yards", "18 yards", "6 yards"], 0, W("Penalty_kick_(association_football)")],
  ["easy", "What restart is given when the ball fully crosses the touchline?", ["Throw-in", "Corner kick", "Goal kick", "Free kick"], 0, W("Throw-in")],
  ["medium", "What is awarded when a defender plays the ball over their own goal line?", ["Corner kick", "Goal kick", "Penalty", "Throw-in"], 0, W("Corner_kick")],
  ["medium", "How many on-field assistant referees support the main referee?", ["2", "1", "3", "4"], 0, W("Assistant_referee_(association_football)")],
  ["hard", "What is the minimum number of players a team needs to keep playing a match?", ["7", "8", "6", "9"], 0, W("Laws_of_the_Game_(association_football)")],
  ["hard", "Which body writes football's official Laws of the Game?", ["IFAB", "FIFA", "UEFA", "CONMEBOL"], 0, W("International_Football_Association_Board")],
  ["medium", "From which type of free kick can a goal NOT be scored directly?", ["Indirect free kick", "Direct free kick", "Penalty kick", "Corner kick"], 0, W("Free_kick_(association_football)")],
  ["easy", "What is it called when an attacker is ahead of the second-last defender as the ball is played to them?", ["Offside", "Handball", "Foul", "Holding"], 0, W("Offside_(association_football)")],
  ["easy", "How long is each half of a standard football match, excluding stoppage time?", ["45 minutes", "40 minutes", "30 minutes", "50 minutes"], 0, W("Association_football")],
  ["medium", "What does VAR stand for?", ["Video Assistant Referee", "Visual Action Replay", "Verified Action Review", "Virtual Assistant Referee"], 0, W("Video_assistant_referee")],
);

// ─────────────────────────────── Iconic moments & culture ─────────────
add(
  ["hard", "The 1982 West Germany–Austria match, suspected of collusion, is nicknamed the 'Disgrace of ___'.", ["Gijón", "Madrid", "Vienna", "Seville"], 0, W("Disgrace_of_Gij%C3%B3n")],
  ["hard", "The violent 1962 Chile–Italy group match is known as the 'Battle of ___'.", ["Santiago", "Berne", "Nuremberg", "Rome"], 0, W("Battle_of_Santiago_(1962_FIFA_World_Cup)")],
  ["hard", "The 2006 Portugal–Netherlands last-16 tie, with four red cards, is the 'Battle of ___'.", ["Nuremberg", "Santiago", "Berne", "Munich"], 0, W("Portugal_v_Netherlands_(2006_FIFA_World_Cup)")],
  ["hard", "Maradona's nickname, meaning 'The Golden Boy', is what?", ["El Pibe de Oro", "El Matador", "La Pulga", "El Diez"], 0, W("Diego_Maradona")],
  ["hard", "Pelé's birth name was Edson Arantes do ___.", ["Nascimento", "Santos", "Oliveira", "Silva"], 0, W("Pel%C3%A9")],
  ["medium", "Which K'naan song became a global anthem at the 2010 World Cup?", ["Wavin' Flag", "Waka Waka", "We Are One", "The Cup of Life"], 0, W("Wavin%27_Flag")],
  ["hard", "Ricky Martin's 1998 World Cup anthem was 'The Cup of ___'.", ["Life", "Gold", "Dreams", "Nations"], 0, W("The_Cup_of_Life")],
  ["hard", "Which late tenor's 'Nessun Dorma' became the theme of the 1990 World Cup?", ["Luciano Pavarotti", "Andrea Bocelli", "Plácido Domingo", "José Carreras"], 0, W("Luciano_Pavarotti")],
  ["medium", "Pitbull, Jennifer Lopez and Claudia Leitte performed which 2014 World Cup anthem?", ["We Are One (Ole Ola)", "Waka Waka", "Wavin' Flag", "Live It Up"], 0, W("We_Are_One_(Ole_Ola)")],
  ["hard", "The slow-motion 'Goal of the Century' was a solo run by Maradona at which World Cup?", ["1986", "1982", "1990", "1978"], 0, W("Argentina_v_England_(1986_FIFA_World_Cup)")],
);

// ─────────────────────────────── Match balls ──────────────────────────
add(
  ["medium", "Which company has supplied the official World Cup match ball since 1970?", ["Adidas", "Nike", "Puma", "Mitre"], 0, W("Adidas")],
  ["hard", "What was the 2022 World Cup official match ball called?", ["Al Rihla", "Jabulani", "Brazuca", "Telstar 18"], 0, W("Adidas_Al_Rihla")],
  ["hard", "What was the 2010 World Cup official match ball called?", ["Jabulani", "Brazuca", "Teamgeist", "Fevernova"], 0, W("Adidas_Jabulani")],
  ["hard", "What was the 2014 World Cup official match ball called?", ["Brazuca", "Jabulani", "Al Rihla", "Tricolore"], 0, W("Adidas_Brazuca")],
  ["hard", "Adidas's first official World Cup ball, used in 1970, was called the ___.", ["Telstar", "Tango", "Azteca", "Etrusco"], 0, W("Adidas_Telstar")],
  ["hard", "What was the 2006 World Cup official match ball called?", ["Teamgeist", "Fevernova", "Tricolore", "Jabulani"], 0, W("Adidas_Teamgeist")],
  ["hard", "What was the 2002 World Cup official match ball called?", ["Fevernova", "Tricolore", "Teamgeist", "Questra"], 0, W("Adidas_Fevernova")],
);

// ─────────────────────────────── Mascots ──────────────────────────────
add(
  ["hard", "The 1986 World Cup mascot 'Pique' was based on which vegetable?", ["Jalapeño pepper", "Tomato", "Corn cob", "Cactus"], 0, W("FIFA_World_Cup_official_mascots")],
  ["hard", "The 1982 World Cup mascot 'Naranjito' was based on which fruit?", ["Orange", "Apple", "Lemon", "Grape"], 0, W("FIFA_World_Cup_official_mascots")],
  ["hard", "The 1998 World Cup mascot 'Footix' was what animal?", ["Rooster", "Lion", "Fox", "Eagle"], 0, W("Footix")],
  ["hard", "The 1994 World Cup mascot 'Striker' was what animal?", ["Dog", "Eagle", "Horse", "Bear"], 0, W("FIFA_World_Cup_official_mascots")],
  ["hard", "The 2022 World Cup mascot was named what?", ["La'eeb", "Zabivaka", "Fuleco", "Zakumi"], 0, W("La%27eeb")],
  ["medium", "The 2010 World Cup mascot Zakumi was what animal?", ["Leopard", "Lion", "Cheetah", "Zebra"], 0, W("Zakumi")],
);

// ─────────────────────────────── Stadium locations ────────────────────
add(
  ["easy", "The Maracanã stadium is in which city?", ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"], 0, W("Maracan%C3%A3_Stadium")],
  ["medium", "The Estadio Azteca is in which city?", ["Mexico City", "Guadalajara", "Monterrey", "Puebla"], 0, W("Estadio_Azteca")],
  ["medium", "Soccer City (FNB Stadium), the 2010 final venue, is in which city?", ["Johannesburg", "Cape Town", "Durban", "Pretoria"], 0, W("FNB_Stadium")],
  ["medium", "The Lusail Stadium is near which capital city?", ["Doha", "Dubai", "Riyadh", "Manama"], 0, W("Lusail_Stadium")],
  ["easy", "Wembley Stadium is in which city?", ["London", "Manchester", "Liverpool", "Birmingham"], 0, W("Wembley_Stadium")],
  ["medium", "The Rose Bowl, the 1994 final venue, is in which US state?", ["California", "Texas", "Florida", "New York"], 0, W("Rose_Bowl_(stadium)")],
  ["medium", "The Luzhniki Stadium is in which city?", ["Moscow", "Saint Petersburg", "Kyiv", "Minsk"], 0, W("Luzhniki_Stadium")],
  ["medium", "The Stade de France is located in the suburbs of which city?", ["Paris", "Lyon", "Marseille", "Lille"], 0, W("Stade_de_France")],
);

// ─────────────────────────────── 2026 & 2030 ──────────────────────────
add(
  ["medium", "How many nations will co-host the 2026 World Cup?", ["3", "2", "4", "1"], 0, W("2026_FIFA_World_Cup")],
  ["hard", "Which country will host the most matches at the 2026 World Cup?", ["United States", "Mexico", "Canada", "Brazil"], 0, W("2026_FIFA_World_Cup")],
  ["hard", "Which stadium will become the first to host games at three different World Cups in 2026?", ["Estadio Azteca", "Maracanã", "Wembley", "Rose Bowl"], 0, W("Estadio_Azteca")],
  ["hard", "Which country will become the first to host the World Cup three times, in 2026?", ["Mexico", "Italy", "Brazil", "France"], 0, W("2026_FIFA_World_Cup")],
  ["hard", "The 2030 World Cup's main hosts are Spain, Portugal and which African nation?", ["Morocco", "Algeria", "Tunisia", "Egypt"], 0, W("2030_FIFA_World_Cup")],
  ["hard", "To mark its centenary, the 2030 World Cup will stage opening games in Uruguay, Argentina and which country?", ["Paraguay", "Chile", "Brazil", "Peru"], 0, W("2030_FIFA_World_Cup")],
);

// ─────────────────────────────── More player nationalities ────────────
add(
  ["medium", "Zlatan Ibrahimović played for which national team?", ["Sweden", "Norway", "Denmark", "Bosnia and Herzegovina"], 0, W("Zlatan_Ibrahimovi%C4%87")],
  ["hard", "Marco van Basten played for which national team?", ["Netherlands", "Belgium", "Germany", "Italy"], 0, W("Marco_van_Basten")],
  ["hard", "Ruud Gullit played for which national team?", ["Netherlands", "Suriname", "Belgium", "Germany"], 0, W("Ruud_Gullit")],
  ["hard", "Andriy Shevchenko played for which national team?", ["Ukraine", "Russia", "Poland", "Belarus"], 0, W("Andriy_Shevchenko")],
  ["hard", "Pavel Nedvěd played for which national team?", ["Czech Republic", "Slovakia", "Poland", "Hungary"], 0, W("Pavel_Nedv%C4%9Bd")],
  ["medium", "Romário played for which national team?", ["Brazil", "Portugal", "Argentina", "Uruguay"], 0, W("Rom%C3%A1rio")],
  ["hard", "Davor Šuker played for which national team?", ["Croatia", "Serbia", "Slovenia", "Bosnia and Herzegovina"], 0, W("Davor_%C5%A0uker")],
  ["medium", "Peter Schmeichel played for which national team?", ["Denmark", "Sweden", "Norway", "Netherlands"], 0, W("Peter_Schmeichel")],
  ["hard", "Gerd Müller played for which national team?", ["Germany", "Austria", "Switzerland", "Netherlands"], 0, W("Gerd_M%C3%BCller")],
  ["hard", "Lothar Matthäus played for which national team?", ["Germany", "Austria", "Switzerland", "Poland"], 0, W("Lothar_Matth%C3%A4us")],
  ["medium", "Eusébio played for which national team?", ["Portugal", "Brazil", "Spain", "Mozambique"], 0, W("Eus%C3%A9bio")],
  ["medium", "Garrincha played for which national team?", ["Brazil", "Argentina", "Portugal", "Uruguay"], 0, W("Garrincha")],
  ["medium", "Bobby Charlton played for which national team?", ["England", "Scotland", "Wales", "Ireland"], 0, W("Bobby_Charlton")],
  ["hard", "Hong Myung-bo played for which national team?", ["South Korea", "Japan", "China", "North Korea"], 0, W("Hong_Myung-bo")],
  ["hard", "Hidetoshi Nakata played for which national team?", ["Japan", "South Korea", "China", "Thailand"], 0, W("Hidetoshi_Nakata")],
  ["hard", "Abedi Pelé played for which national team?", ["Ghana", "Nigeria", "Senegal", "Cameroon"], 0, W("Abedi_Pele")],
  ["hard", "Rabah Madjer played for which national team?", ["Algeria", "Morocco", "Tunisia", "Egypt"], 0, W("Rabah_Madjer")],
  ["medium", "Bebeto, famed for his 1994 'baby-cradle' goal celebration, played for which national team?", ["Brazil", "Argentina", "Portugal", "Italy"], 0, W("Bebeto")],
);

// ─────────────────────────────────────────────────────────────────────
// Assemble + splice into the question bank. Target: pack of exactly 500
// (wc-001..025 are kept; this file owns wc-026..500 → 475 generated rows).
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────── Extra facts & firsts ────────────────
add(
  ["medium", "Which was the most recent host nation to win the World Cup?", ["France (1998)", "Brazil (2014)", "Germany (2006)", "Argentina (2022)"], 0, W("FIFA_World_Cup")],
  ["medium", "How many different countries have won the World Cup, as of 2022?", ["8", "6", "10", "12"], 0, W("FIFA_World_Cup")],
  ["medium", "Which European nation was the first to win the World Cup?", ["Italy", "Germany", "England", "France"], 0, W("Italy_national_football_team")],
  ["hard", "Which World Cup was the first to be broadcast in colour?", ["1970", "1966", "1958", "1974"], 0, W("1970_FIFA_World_Cup")],
  ["medium", "How many World Cup tournaments had been held through 2022?", ["22", "20", "24", "18"], 0, W("FIFA_World_Cup")],
  ["medium", "How many World Cups have the Netherlands won, despite reaching three finals?", ["0", "1", "2", "3"], 0, W("Netherlands_national_football_team")],
  ["hard", "Which country has lost the most World Cup finals?", ["Germany", "Argentina", "Netherlands", "Italy"], 0, W("Germany_national_football_team")],
  ["hard", "Red and yellow cards were first used at which World Cup?", ["1970", "1966", "1974", "1962"], 0, W("Penalty_card")],
  ["hard", "Substitutes were first permitted at which World Cup?", ["1970", "1966", "1974", "1962"], 0, W("Substitute_(association_football)")],
  ["medium", "Lionel Messi appeared at how many World Cups from 2006 to 2022?", ["5", "4", "6", "3"], 0, W("Lionel_Messi")],
  ["hard", "Who became the first player to score at five different World Cups, in 2022?", ["Cristiano Ronaldo", "Lionel Messi", "Miroslav Klose", "Pelé"], 0, W("Cristiano_Ronaldo")],
  ["hard", "Who captained Brazil's celebrated 1970 World Cup winners?", ["Carlos Alberto", "Pelé", "Gérson", "Rivelino"], 0, W("Carlos_Alberto_Torres")],
  ["easy", "Which shirt number did Pelé famously wear for Brazil?", ["10", "9", "7", "8"], 0, W("Pel%C3%A9")],
  ["hard", "Which shirt number is most associated with Johan Cruyff?", ["14", "10", "9", "7"], 0, W("Johan_Cruyff")],
  ["medium", "Which country's fans popularised the 'Viking clap' at the 2018 World Cup?", ["Iceland", "Norway", "Denmark", "Croatia"], 0, W("Iceland_national_football_team")],
  ["medium", "Iceland made their World Cup debut at which tournament?", ["2018", "2014", "2010", "2022"], 0, W("Iceland_national_football_team")],
  ["medium", "Which award goes to the World Cup's best goalkeeper?", ["Golden Glove", "Golden Boot", "Golden Ball", "Bronze Boot"], 0, W("Golden_Glove_(association_football)")],
  ["hard", "The World Cup's best-goalkeeper award is named after which legendary keeper?", ["Lev Yashin", "Gordon Banks", "Dino Zoff", "Peter Schmeichel"], 0, W("Lev_Yashin")],
  ["easy", "Which continent hosted the 2010 World Cup?", ["Africa", "Asia", "Europe", "South America"], 0, W("2010_FIFA_World_Cup")],
  ["medium", "Which continent will host the bulk of the 2026 World Cup?", ["North America", "South America", "Europe", "Asia"], 0, W("2026_FIFA_World_Cup")],
  ["medium", "Which two countries co-hosted the 2002 World Cup?", ["South Korea and Japan", "China and Japan", "South Korea and China", "Japan and Thailand"], 0, W("2002_FIFA_World_Cup")],
  ["medium", "The 2002 World Cup was the first staged on which continent?", ["Asia", "Africa", "Europe", "Oceania"], 0, W("2002_FIFA_World_Cup")],
  ["medium", "Geoff Hurst scored how many goals in the 1966 World Cup final?", ["3", "2", "4", "1"], 0, W("Geoff_Hurst")],
  ["hard", "Which national team is nicknamed 'Les Éléphants'?", ["Ivory Coast", "Ghana", "Cameroon", "Nigeria"], 0, W("Ivory_Coast_national_football_team")],
  ["hard", "Which national team is nicknamed the 'Cafeteros'?", ["Colombia", "Brazil", "Venezuela", "Peru"], 0, W("Colombia_national_football_team")],
  ["hard", "Which national team is nicknamed 'La Albirroja'?", ["Paraguay", "Peru", "Bolivia", "Ecuador"], 0, W("Paraguay_national_football_team")],
  ["easy", "Which sport is contested at the FIFA World Cup?", ["Football (soccer)", "Rugby", "Cricket", "Field hockey"], 0, W("FIFA_World_Cup")],
);

// ─────────────────────────────── More player nationalities ────────────
add(
  ["easy", "Sergio Agüero played for which national team?", ["Argentina", "Spain", "Brazil", "Mexico"], 0, W("Sergio_Ag%C3%BCero")],
  ["easy", "Antoine Griezmann plays for which national team?", ["France", "Spain", "Portugal", "Belgium"], 0, W("Antoine_Griezmann")],
  ["easy", "Thomas Müller plays for which national team?", ["Germany", "Austria", "Switzerland", "Netherlands"], 0, W("Thomas_M%C3%BCller")],
  ["medium", "David Villa played for which national team?", ["Spain", "Italy", "Portugal", "Mexico"], 0, W("David_Villa")],
  ["medium", "Edinson Cavani plays for which national team?", ["Uruguay", "Argentina", "Colombia", "Paraguay"], 0, W("Edinson_Cavani")],
  ["medium", "Radamel Falcao plays for which national team?", ["Colombia", "Venezuela", "Ecuador", "Peru"], 0, W("Radamel_Falcao")],
  ["medium", "Achraf Hakimi plays for which national team?", ["Morocco", "Algeria", "Tunisia", "Spain"], 0, W("Achraf_Hakimi")],
  ["medium", "Alexis Sánchez plays for which national team?", ["Chile", "Peru", "Colombia", "Uruguay"], 0, W("Alexis_S%C3%A1nchez")],
  ["medium", "Hirving Lozano plays for which national team?", ["Mexico", "Colombia", "Costa Rica", "United States"], 0, W("Hirving_Lozano")],
  ["medium", "Bruno Fernandes plays for which national team?", ["Portugal", "Brazil", "Spain", "Italy"], 0, W("Bruno_Fernandes")],
  ["medium", "Pepe played for which national team?", ["Portugal", "Brazil", "Spain", "Angola"], 0, W("Pepe_(footballer,_born_1983)")],
  ["medium", "Thiago Silva plays for which national team?", ["Brazil", "Portugal", "Argentina", "Uruguay"], 0, W("Thiago_Silva")],
  ["medium", "Casemiro plays for which national team?", ["Brazil", "Portugal", "Spain", "Argentina"], 0, W("Casemiro")],
  ["medium", "Alisson plays for which national team?", ["Brazil", "Portugal", "Argentina", "Italy"], 0, W("Alisson")],
  ["medium", "Robin van Persie played for which national team?", ["Netherlands", "Belgium", "Germany", "Denmark"], 0, W("Robin_van_Persie")],
  ["hard", "Wesley Sneijder played for which national team?", ["Netherlands", "Belgium", "Germany", "Austria"], 0, W("Wesley_Sneijder")],
  ["hard", "Patrick Kluivert played for which national team?", ["Netherlands", "Suriname", "Belgium", "Germany"], 0, W("Patrick_Kluivert")],
  ["medium", "Mesut Özil played for which national team?", ["Germany", "Turkey", "Austria", "Switzerland"], 0, W("Mesut_%C3%96zil")],
  ["medium", "Paul Pogba plays for which national team?", ["France", "Guinea", "Belgium", "Portugal"], 0, W("Paul_Pogba")],
  ["medium", "Olivier Giroud plays for which national team?", ["France", "Belgium", "Switzerland", "Italy"], 0, W("Olivier_Giroud")],
  ["hard", "N'Golo Kanté plays for which national team?", ["France", "Mali", "Senegal", "Belgium"], 0, W("N%27Golo_Kant%C3%A9")],
  ["medium", "Steven Gerrard played for which national team?", ["England", "Scotland", "Wales", "Ireland"], 0, W("Steven_Gerrard")],
  ["medium", "Frank Lampard played for which national team?", ["England", "Scotland", "Wales", "Ireland"], 0, W("Frank_Lampard")],
  ["medium", "Alan Shearer played for which national team?", ["England", "Scotland", "Wales", "Ireland"], 0, W("Alan_Shearer")],
  ["medium", "Fernando Torres played for which national team?", ["Spain", "Portugal", "Italy", "Mexico"], 0, W("Fernando_Torres")],
  ["medium", "Carles Puyol played for which national team?", ["Spain", "Portugal", "France", "Italy"], 0, W("Carles_Puyol")],
  ["medium", "Sergio Busquets plays for which national team?", ["Spain", "Portugal", "Italy", "Argentina"], 0, W("Sergio_Busquets")],
  ["hard", "Diego Godín played for which national team?", ["Uruguay", "Argentina", "Colombia", "Chile"], 0, W("Diego_God%C3%ADn")],
  ["medium", "Federico Valverde plays for which national team?", ["Uruguay", "Argentina", "Chile", "Colombia"], 0, W("Federico_Valverde")],
  ["medium", "Arturo Vidal plays for which national team?", ["Chile", "Peru", "Colombia", "Uruguay"], 0, W("Arturo_Vidal")],
  ["hard", "Keylor Navas plays for which national team?", ["Costa Rica", "Panama", "Honduras", "Mexico"], 0, W("Keylor_Navas")],
  ["medium", "Guillermo Ochoa plays for which national team?", ["Mexico", "Colombia", "Costa Rica", "United States"], 0, W("Guillermo_Ochoa")],
  ["hard", "Rafael Márquez played for which national team?", ["Mexico", "Spain", "Colombia", "United States"], 0, W("Rafael_M%C3%A1rquez")],
  ["medium", "Riyad Mahrez plays for which national team?", ["Algeria", "Morocco", "Tunisia", "Egypt"], 0, W("Riyad_Mahrez")],
  ["medium", "Victor Osimhen plays for which national team?", ["Nigeria", "Ghana", "Cameroon", "Senegal"], 0, W("Victor_Osimhen")],
  ["medium", "Javier Mascherano played for which national team?", ["Argentina", "Brazil", "Uruguay", "Chile"], 0, W("Javier_Mascherano")],
  ["medium", "Gonzalo Higuaín played for which national team?", ["Argentina", "France", "Uruguay", "Chile"], 0, W("Gonzalo_Higua%C3%ADn")],
  ["medium", "Dani Alves played for which national team?", ["Brazil", "Portugal", "Spain", "Argentina"], 0, W("Dani_Alves")],
  ["easy", "Jude Bellingham plays for which national team?", ["England", "Wales", "Ireland", "Scotland"], 0, W("Jude_Bellingham")],
  ["medium", "Bukayo Saka plays for which national team?", ["England", "Nigeria", "Wales", "Ireland"], 0, W("Bukayo_Saka")],
  ["medium", "Pedri plays for which national team?", ["Spain", "Portugal", "Italy", "Argentina"], 0, W("Pedri")],
  ["medium", "Álvaro Morata plays for which national team?", ["Spain", "Italy", "Portugal", "Mexico"], 0, W("%C3%81lvaro_Morata")],
  ["medium", "Rodri plays for which national team?", ["Spain", "Portugal", "Italy", "Argentina"], 0, W("Rodri")],
  ["medium", "Jamal Musiala plays for which national team?", ["Germany", "England", "Nigeria", "Austria"], 0, W("Jamal_Musiala")],
  ["medium", "Kai Havertz plays for which national team?", ["Germany", "Austria", "Switzerland", "Netherlands"], 0, W("Kai_Havertz")],
  ["medium", "Lautaro Martínez plays for which national team?", ["Argentina", "Uruguay", "Chile", "Colombia"], 0, W("Lautaro_Mart%C3%ADnez")],
  ["medium", "Julián Álvarez plays for which national team?", ["Argentina", "Uruguay", "Chile", "Mexico"], 0, W("Juli%C3%A1n_%C3%81lvarez")],
  ["medium", "Enzo Fernández plays for which national team?", ["Argentina", "Uruguay", "Chile", "Colombia"], 0, W("Enzo_Fern%C3%A1ndez")],
  ["medium", "Rúben Dias plays for which national team?", ["Portugal", "Brazil", "Spain", "Italy"], 0, W("Rúben_Dias")],
  ["medium", "Bernardo Silva plays for which national team?", ["Portugal", "Brazil", "Spain", "Italy"], 0, W("Bernardo_Silva")],
  ["medium", "Memphis Depay plays for which national team?", ["Netherlands", "Belgium", "Germany", "Suriname"], 0, W("Memphis_Depay")],
  ["medium", "Frenkie de Jong plays for which national team?", ["Netherlands", "Belgium", "Germany", "Denmark"], 0, W("Frenkie_de_Jong")],
  ["medium", "Virgil van Dijk plays for which national team?", ["Netherlands", "Belgium", "Suriname", "Germany"], 0, W("Virgil_van_Dijk")],
  ["medium", "Richarlison plays for which national team?", ["Brazil", "Portugal", "Argentina", "Uruguay"], 0, W("Richarlison")],
  ["medium", "Cody Gakpo plays for which national team?", ["Netherlands", "Belgium", "Germany", "Denmark"], 0, W("Cody_Gakpo")],
  ["medium", "Ousmane Dembélé plays for which national team?", ["France", "Senegal", "Mali", "Belgium"], 0, W("Ousmane_Demb%C3%A9l%C3%A9")],
);

add(
  ["medium", "Kevin De Bruyne plays for which national team?", ["Belgium", "Netherlands", "Germany", "France"], 0, W("Kevin_De_Bruyne")],
  ["medium", "Which Belgian goalkeeper won the 2018 World Cup Golden Glove?", ["Thibaut Courtois", "Simon Mignolet", "Koen Casteels", "Jan Vertonghen"], 0, W("Thibaut_Courtois")],
  ["hard", "Diego Maradona wore which shirt number for Argentina?", ["10", "9", "7", "11"], 0, W("Diego_Maradona")],
  ["medium", "Which national team is nicknamed the 'Yanks'?", ["United States", "Canada", "Australia", "England"], 0, W("United_States_men%27s_national_soccer_team")],
);

const TARGET = 475; // wc-026 .. wc-500
console.log(`Generated ${Q.length} candidate rows (target ${TARGET}).`);
if (Q.length < TARGET) {
  throw new Error(`Need at least ${TARGET} rows, only have ${Q.length}. Add ${TARGET - Q.length} more.`);
}
Q.length = TARGET; // trim any surplus from the tail

// Re-grade difficulty so the pack lands at ~40/40/20. Each row gets an
// intrinsic "hardness" score; we then bucket the 475 rows into the
// 190 easiest / 190 medium / 95 hardest. Combined with wc-001..025
// (10/10/5) the pack totals 200/200/100.
function hardness(row: Row): number {
  const q = row[1].toLowerCase();
  let s = 0;
  const ym = q.match(/\b(19\d\d|20\d\d)\b/);
  const year = ym ? Number(ym[1]) : 0;
  if (/for which national team/.test(q)) s -= 40; // "X plays for which country" — easiest tier
  if (/\b(penalty kick|throw-?in|corner kick|offside|free kick|assistant referee|laws of the game|var|each half of a standard|minimum number of players)\b/.test(q)) s -= 35;
  if (/nicknamed/.test(q)) s -= 8;
  if (/(which country|which nation).*(won|hosted)|(won|hosted) (the )?\d{4} world cup/.test(q)) {
    if (year >= 2006) s -= 25;
    else if (year >= 1986) s -= 6;
    else s += 12;
  }
  if (/(top scorer|golden boot|golden ball|golden glove)/.test(q)) s += 12;
  if (/(who coached|who captained|coached .* to|captained .* to)/.test(q)) s += 6;
  if (/(city hosted|stadium|venue|råsunda|which city)/.test(q)) s += 30;
  if (/(what was the score|by what.*score|score (in|after))/.test(q)) s += 26;
  if (/(record|fastest|oldest|youngest|first (player|hat-trick|goal|to)|most (goals|world cup|matches)|how many world cups)/.test(q)) s += 25;
  if (/(match ball|ball called|mascot|anthem|world cup song)/.test(q)) s += 14;
  if (year && year < 1966) s += 12;
  return s;
}

Q.map((row, i) => ({ row, i, s: hardness(row) }))
  .sort((a, b) => a.s - b.s || a.i - b.i)
  .forEach((x, rank) => {
    x.row[0] = rank < 190 ? "easy" : rank < 380 ? "medium" : "hard";
  });

// Reject internal duplicate question text early (cheap pre-check).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const seen = new Map<string, number>();
Q.forEach((row, i) => {
  const k = norm(row[1]);
  if (seen.has(k)) throw new Error(`Duplicate question text at #${i} and #${seen.get(k)}: ${row[1]}`);
  seen.set(k, i);
  // sanity: correctIndex must be a valid slot and answers unique
  const ans = row[2];
  if (new Set(ans.map((a) => a.toLowerCase())).size !== 4) throw new Error(`Duplicate answer in #${i}: ${row[1]}`);
  if (row[3] < 0 || row[3] > 3) throw new Error(`Bad correctIndex in #${i}`);
});

// Authoring convention above puts the correct answer first; the runtime does
// NOT shuffle, so spread the correct option across positions deterministically
// (seeded by index, stable across re-runs).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Q.forEach((row, i) => {
  const rng = mulberry32(i + 1);
  const answers = row[2].slice();
  const correctVal = answers[row[3]];
  for (let k = answers.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [answers[k], answers[j]] = [answers[j], answers[k]];
  }
  row[2] = answers as [string, string, string, string];
  row[3] = answers.indexOf(correctVal) as Idx;
});

const rows = Q.map((t, i) => {
  const id = `wc-${String(i + 26).padStart(3, "0")}`;
  const [difficulty, question, answers, correctIndex, sourceUrl] = t;
  return (
    `  { id: ${JSON.stringify(id)}, category: "Sports", difficulty: ${JSON.stringify(difficulty)}, ` +
    `pack: "world-cup", question: ${JSON.stringify(question)}, answers: ${JSON.stringify(answers)}, ` +
    `correctIndex: ${correctIndex}, sourceUrl: ${JSON.stringify(sourceUrl)} },`
  );
});

const file = path.resolve(import.meta.dirname, "../src/app/v2/_app/data/questions.ts");
let src = fs.readFileSync(file, "utf8");

// Idempotent: drop any previously generated wc-026+ rows.
src = src
  .split("\n")
  .filter((line) => {
    const m = line.match(/id: "wc-(\d+)"/);
    return !(m && Number(m[1]) >= 26);
  })
  .join("\n");

// Splice the fresh rows in just before the array's closing `];`.
const marker = "\n];";
const at = src.lastIndexOf(marker);
if (at === -1) throw new Error("Could not find closing `];` of QUESTION_BANK.");
src = src.slice(0, at) + "\n" + rows.join("\n") + src.slice(at);

fs.writeFileSync(file, src);
console.log(`Wrote ${rows.length} rows (wc-026..wc-${String(TARGET + 25).padStart(3, "0")}) into ${path.relative(process.cwd(), file)}.`);

