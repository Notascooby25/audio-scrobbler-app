import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The app is written in UK English. This scans the text people read (quoted strings and JSX text)
// in the frontend source for common American spellings. Code names such as `color`, CSS
// properties, class names and API fields are not text and are left alone: a match must be a whole
// word, not part of a longer name (background-color, accent_color) and not a CSS property.
const SRC = __dirname;

const US_WORDS = [
  "colors?",
  "colored",
  "coloring",
  "colorful",
  "favorites?",
  "customiz\\w*",
  "catalogs?",
  "authoriz\\w*",
  "normaliz\\w*",
  "analyz\\w*",
  "optimiz\\w*",
  "recogniz\\w*",
  "summariz\\w*",
  "personaliz\\w*",
  "prioritiz\\w*",
  "organiz\\w*",
  "visualiz\\w*",
  "synchroniz\\w*",
  "initializ\\w*",
  "utiliz\\w*",
  "emphasiz\\w*",
  "behaviors?",
  "neighbors?",
  "gray",
  "canceled",
  "canceling",
  "traveled",
  "traveling",
  "labeled",
  "labeling",
  "theater",
  "centered",
  "centering",
];

// American -> UK, so the failure message says what to write instead.
const US_TO_UK = [
  [/^colored$/i, "coloured"],
  [/^color(s|ing|ful)?$/i, "colour…"],
  [/^favorite/i, "favourite…"],
  [/^customiz/i, "customis…"],
  [/^catalog/i, "catalogue…"],
  [/^authoriz/i, "authoris…"],
  [/^normaliz/i, "normalis…"],
  [/^analyz/i, "analys…"],
  [/^optimiz/i, "optimis…"],
  [/^recogniz/i, "recognis…"],
  [/^summariz/i, "summaris…"],
  [/^personaliz/i, "personalis…"],
  [/^prioritiz/i, "prioritis…"],
  [/^organiz/i, "organis…"],
  [/^visualiz/i, "visualis…"],
  [/^synchroniz/i, "synchronis…"],
  [/^initializ/i, "initialis…"],
  [/^utiliz/i, "utilis…"],
  [/^emphasiz/i, "emphasis…"],
  [/^behavior/i, "behaviour…"],
  [/^neighbor/i, "neighbour…"],
  [/^gray$/i, "grey"],
  [/^cancel(ed|ing)$/i, "cancelled / cancelling"],
  [/^travel(ed|ing)$/i, "travelled / travelling"],
  [/^label(ed|ing)$/i, "labelled / labelling"],
  [/^theater$/i, "theatre"],
  [/^center(ed|ing)$/i, "centred / centring"],
];

// Only the American forms are listed (-ize, -yze, color…), so UK spellings such as "customise" or
// "analyse" never match.
const WORD = new RegExp(`(?<![-_\\w$.])(${US_WORDS.join("|")})(?![-_\\w]|\\s*:)`, "gi");
// "authorized" etc. appearing as part of API paths or header names are not prose.
const NOT_PROSE = /^[\w./:-]+$|^\s*[\w-]+\s*:\s*[^\s]|^\s*\w+\s*\(/;

const STRING = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\\n]|\\.)*)`|>([^<>{}\n]+)</g;

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return /\.(jsx?|html)$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) ? [full] : [];
  });
}

// Plain JSX text sits on lines of its own, with no quotes or tags to find it by.
function proseLine(line) {
  const trimmed = line.trim();
  if (!/^[A-Za-z(]/.test(trimmed) || /[<>{}=;]/.test(trimmed)) return null;
  if (/^(import|export|const|let|var|return|function|if|else|for|while|case)\b/.test(trimmed)) {
    return null;
  }
  if (/^[\w.$]+\(/.test(trimmed)) return null; // a function call, not a sentence
  if (/&&|\|\||^[a-z]+[A-Z]\w*\b/.test(trimmed)) return null; // an expression or a camelCase name
  return trimmed;
}

export function findAmericanSpellings(source) {
  const found = [];
  source.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    const segments = [];
    for (const match of line.matchAll(STRING)) {
      const text = match[1] ?? match[2] ?? match[3] ?? match[4];
      if (text && /\s/.test(text.trim()) && !NOT_PROSE.test(text)) segments.push(text);
    }
    const prose = proseLine(line);
    if (prose) segments.push(prose);
    for (const text of segments) {
      for (const word of text.matchAll(WORD)) {
        const uk = US_TO_UK.find(([pattern]) => pattern.test(word[0]));
        found.push(
          `line ${index + 1}: "${word[0]}" -> ${uk ? uk[1] : "UK spelling"} in: ${text.trim().slice(0, 90)}`
        );
      }
    }
  });
  return found;
}

describe("UK English spelling in the text people read", () => {
  it("the detector flags American spellings and ignores code names", () => {
    expect(findAmericanSpellings('const a = "Choose your favorite colors";')).toHaveLength(2);
    expect(findAmericanSpellings("<p>Customize your catalog</p>")).toHaveLength(2);
    expect(findAmericanSpellings('const a = "Choose your favourite colours";')).toHaveLength(0);
    expect(
      findAmericanSpellings("transition: 'background-color 0.15s, border-color 0.15s'")
    ).toHaveLength(0);
    expect(findAmericanSpellings('const b = { color: "red", accent_color: x };')).toHaveLength(0);
    expect(findAmericanSpellings('fetch("/auth/spotify/authorize")')).toHaveLength(0);
    expect(findAmericanSpellings("// the favorite colour is a comment")).toHaveLength(0);
  });

  it("has no American spellings in the frontend source", () => {
    const problems = [];
    for (const file of listFiles(SRC)) {
      const found = findAmericanSpellings(fs.readFileSync(file, "utf-8"));
      for (const entry of found) problems.push(`${path.relative(SRC, file)} ${entry}`);
    }
    expect(problems).toEqual([]);
  });
});
