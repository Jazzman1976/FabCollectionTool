# FabCollectionTool — Code Audit

**Date:** 2026-09-22 · **Revision audited:** `a384652` (branch `develop`, version 1.1.5)

---

## Scope & method

A full static review of the application source: all 24 `.cs` files under
`src/FabCollectionTool/FabCollectionTool/` (~1,780 lines), plus `readme.md` and
`FabCollectionTool.csproj`. Every file was read end to end; each finding below cites the
code it is based on.

Paths are given relative to `src/FabCollectionTool/FabCollectionTool/`, except for
`readme.md` and `FabCollectionTool.csproj`, which are relative to the repository root.

**In scope:** correctness, logic defects, dead code, performance hot spots, and the gap
between documented and actual behaviour.

**Deliberately out of scope:** dependency and licence review, security, CI/build process,
release management, and test strategy. Three items noticed along the way are listed under
*Noted in passing* so they are not lost, but they were not investigated.

This audit **recommends** changes; it does not make them. No source file was modified.

---

## Summary

The tool does what it promises, and the export logic encodes a lot of hard-won domain
knowledge about how Fabrary, Cardmarket, Dragonshield and TCG Powertools each want their
data. That knowledge is the valuable part of this codebase, and it is well commented.

The central risk is not that the tool crashes — it is that it **silently produces wrong
output**. The spreadsheet-to-column mapping has two independent ways to bind a field to the
wrong column without saying anything (C1, C2); the set-abbreviation table has not kept pace
with the card sets, which quietly skews the Fabrary trade numbers (C14); and rows are
dropped by filters that report nothing to the user (D5). A wrong export looks exactly like
a right one until it has been imported somewhere else.

The second theme is fragility around the edges: any failure while writing an output file
terminates the program and discards the parsed collection (C13), and a malformed
`content.xml` throws past the only `try` block (C12).

**27 findings:** 19 on code and correctness, 8 on documentation and UX.

| Severity | Count | Meaning |
|---|---|---|
| High | 6 | Produces wrong data or ends the session |
| Medium | 12 | Degrades correctness in edge cases, performance, or misleads the user |
| Low | 9 | Cleanup, robustness, polish |

---

## Findings at a glance

| ID | Sev | Area | Finding | Location |
|----|-----|------|---------|----------|
| C1 | High | Parsing | Header positions stored as element index, data read by logical column index | `Classes/RowIndexMap.cs:41-158` |
| C2 | High | Parsing | Missing header silently aliases to column 0 | `Classes/RowIndexMap.cs:10-32` |
| C3 | Med | Parsing | Hard 31-column cap, contradicts the readme | `ParseOds.cs:376`, `Classes/RowIndexMap.cs:57` |
| C4 | Low | Parsing | `Sub3` mapped but never imported | `ParseOds.cs:382-403` |
| C5 | High | Cardmarket | Wrong replacement picked from irregular-cardname list | `Classes/CardmarketHelper.cs:53-58` |
| C6 | Med | Performance | JSON file re-read and re-parsed per card variant | `Classes/CardmarketHelper.cs:25-51` |
| C7 | Low | Design | Two JSON stacks and two DTOs for one file | `Classes/CardmarketHelper.cs:1`, `Cardmarket/CardmarketIrregularCardname.cs:18` |
| C8 | Med | Performance | `FixExceptions` ignores its parameter, runs once per row | `Extensions/FabraryDtoListExtensions.cs:163` |
| C9 | Med | Performance | List re-sorted inside the loop | `Classes/CardmarketWantsList.cs:68` |
| C10 | Med | Performance | Quadratic byte accumulation reading `content.xml` | `ParseOds.cs:305-315` |
| C11 | Med | Control flow | Menus recurse; error paths stack them | `Start.cs:5-25`, `ParseOds.cs:78,94,135-139` |
| C12 | High | Robustness | Misleading catch-all; XML parsing left unguarded | `ParseOds.cs:86-99` |
| C13 | High | Robustness | Unguarded output writes end the program | `ParseOds.cs:143,196,239,269` |
| C14 | High | Domain data | Set-abbreviation map is out of date, skews trade numbers | `Classes/AbbreviationSetnameMap.cs:11-28` |
| C15 | Low | Dead code | Unused members and always-empty export columns | several |
| C16 | Low | Robustness | Culture-sensitive `ToLower()` / `ToUpper()` | several |
| C17 | Low | Behaviour | Empty set input matches everything | `Classes/DragonshieldList.cs:14`, `TcgPowertools/TcgList.cs:17` |
| C18 | Med | Cardmarket | Rarity filter applied after de-duplication | `Classes/CardmarketWantsList.cs:61-65` |
| C19 | Low | Behaviour | Static import cache cannot be reset | `ParseOds.cs:17,60-66` |
| D1 | Med | Docs | Readme promises extra columns the parser ignores | `readme.md:62-63` |
| D2 | Med | Docs | Three of four export targets are undocumented | `readme.md:22-76` |
| D3 | Med | Docs | `cardmarket-irregular-cardnames.json` never explained | `Classes/CardmarketHelper.cs:25-46` |
| D4 | Med | Docs | Required ODS column headers documented only in code | `Classes/RowIndexMap.cs:63-156` |
| D5 | Med | UX | No summary after export; skipped rows invisible | `ParseOds.cs:150,216,246,276` |
| D6 | Low | UX | Prompts inconsistent about defaults | `ParseOds.cs:160,170,226,256` |
| D7 | Low | Docs | Path example is the author's machine | `readme.md:36` |
| D8 | Low | Docs | Output location described incorrectly | `readme.md:44-46` |

---

## Code & correctness

#### C1 · Header positions and data positions use different index spaces — *High*

`Classes/RowIndexMap.cs:41-158` vs. `ParseOds.cs:337-377`

Both loops walk the same kind of row and both maintain two counters: `i`, the position of
the cell *element*, and `j`, the logical spreadsheet column, which advances by
`number-columns-repeated` whenever a cell stands for a run of columns. `RowIndexMap`
computes `j` correctly (`RowIndexMap.cs:53`) and then discards it — every mapping is stored
as `i` (`Set = i`, `Edition = i`, …). `ImportRow` does the opposite: it keys
`cellIndexValues` by `j` (`ParseOds.cs:360,372`) and then looks values up using the
indices from `RowIndexMap`.

**Effect:** the two agree only as long as no cell in the header row carries
`number-columns-repeated` before the last data column. The current example sheet satisfies
that, so the bug is dormant — but a merged or repeated header cell, which LibreOffice
produces readily, shifts every mapping after it and the tool reads the wrong column for
every affected field, without any error.

**Fix:** store `j` instead of `i` in the `switch` in `RowIndexMap`, so both sides speak in
logical column indices. Better still, extract the repeat-aware walk into one shared helper
that yields `(columnIndex, value)` pairs and have both callers consume it — the duplicated
logic is what let the two drift apart.

#### C2 · A missing header silently aliases to column 0 — *High*

`Classes/RowIndexMap.cs:10-32`

Every index on `RowIndexMap` is a plain `int`, so an unmatched header name leaves the
property at its default of `0` — which is not an "unset" marker but a perfectly valid
column. `GetStringValue` (`Extensions/DictionaryExtensions.cs:5-10`) returns the value at
that index without complaint.

**Effect:** one typo in the spreadsheet header — `Backside name` instead of
`Backside Name`, a stray trailing space — and that field is populated from column 0 (the
`Set` column) for the whole import. Nothing is logged. The export looks plausible and is
wrong.

**Fix:** initialise all indices to `-1`, have `GetStringValue`/`GetIntegerValue` return the
empty default for negative indices, and report the unmatched headers to the user after
parsing — this pairs naturally with the import summary suggested in D5.

#### C3 · Hard 31-column cap in both parsers — *Medium*

`ParseOds.cs:376`, `Classes/RowIndexMap.cs:57`

Both loops carry `if (i > 30) break;`. In `RowIndexMap` the break sits *before* the
`switch`, so the cell at index 31 is never mapped even when it is reached.

**Effect:** columns past the 31st are ignored, silently. This directly contradicts
`readme.md:63` (see D1). The number 30 is also unexplained — it reads as a leftover guard
rather than a deliberate limit.

**Fix:** drop the cap, or raise it and derive it from the number of mapped columns. If a
limit is genuinely wanted, say so when it bites.

#### C4 · `Sub3` is mapped but never imported — *Low*

`Classes/RowIndexMap.cs:113-115`, `Classes/DataDto.cs:17`, `ParseOds.cs:382-403`

`RowIndexMap` resolves a `Sub3` column and `DataDto` has a `Sub3` property, but the object
initialiser in `ImportRow` assigns `Sub1` and `Sub2` and skips `Sub3`. The property is
therefore always `""`.

**Effect:** none today — nothing reads `Sub3`. It is a trap for whoever needs it next.

**Fix:** wire it up alongside `Sub2`, or delete all three occurrences.

#### C5 · Wrong replacement picked from the irregular-cardname list — *High*

`Classes/CardmarketHelper.cs:53-58`

The guard matches on both `GeneratedCardname` **and** `Setcode`; the lookup inside it
matches on `GeneratedCardname` alone:

```csharp
if (fixedCarnames.Any(fc
    => fc.GeneratedCardname == name
    && fc.Setcode == setcode))
{
    return fixedCarnames.First(fc => fc.GeneratedCardname == name).FixedCardname;
}
```

**Effect:** as soon as two entries share a generated name across different sets — exactly
the case this file exists to handle — the wrong `FixedCardname` is returned, and the
Cardmarket/TCG Powertools export names a card from the wrong set. The current JSON has no
such collision, so the defect is latent, but it is triggered by the ordinary act of adding
a second entry.

**Fix:** one lookup carrying both conditions:

```csharp
var fix = fixedCarnames.FirstOrDefault(fc
    => fc.GeneratedCardname == name && fc.Setcode == setcode);
return fix?.FixedCardname ?? name;
```

#### C6 · The irregular-cardname file is re-read and re-parsed per card variant — *Medium*

`Classes/CardmarketHelper.cs:25-51`, called from `TcgPowertools/TcgList.cs:110,129,148,167`

`GetName` performs `File.Exists`, possibly `File.CreateText`, then `File.ReadAllText` and
`JsonConvert.DeserializeObject` on **every** invocation — and it is invoked once per
foiling variant per card inside the `TcgList` loop.

**Effect:** thousands of file reads and JSON deserialisations for one export. It also means
a naming helper has the side effect of creating a file on disk, which is surprising.

**Fix:** load the list once into a lazily initialised static, and move the
create-if-missing step to an explicit initialisation at export start.

#### C7 · Two JSON stacks and two DTOs for the same file — *Low*

`Classes/CardmarketHelper.cs:1`, `Cardmarket/CardmarketIrregularCardname.cs:18`,
`Classes/CardmarketFixedCardnameDto.cs`

`cardmarket-irregular-cardnames.json` is read in two places: `CardmarketHelper` uses
Newtonsoft (`JsonConvert`), `CardmarketIrregularCardname.LoadFromFile` uses
`System.Text.Json`. The two DTOs (`CardmarketFixedCardnameDto` and
`CardmarketIrregularCardname`) declare identical properties.

**Effect:** the same file can be interpreted by two serialisers with different defaults —
notably property-name case sensitivity — so the two paths could diverge on a malformed
file. It also keeps the Newtonsoft dependency alive for a single call.

**Fix:** keep `System.Text.Json`, delete one DTO, and route both call sites through
`CardmarketIrregularCardname.LoadFromFile`. (Whether the Newtonsoft package reference can
then be dropped is a dependency question and outside this audit's scope.)

#### C8 · `FixExceptions` ignores its parameter and runs once per row — *Medium*

`Extensions/FabraryDtoListExtensions.cs:163-179`, called from `Fabrary/FabraryList.cs:42-51`

The method signature takes `DataDto dto`, but the body never reads it: it sweeps the entire
`FabraryDto` list and rewrites the treatment of two hard-coded card numbers. `FabraryList`
calls it inside a `foreach` over all data rows.

**Effect:** an idempotent whole-list pass is repeated once per input row — O(n²) work for a
result that is fixed after the first pass. Correct, but wasteful and misleading to read.

**Fix:** drop the parameter, call it once after the loops. The `extendedArtAsNormal` array
is also re-allocated inside the inner loop (`:168-171`) and belongs at class level next to
the other domain tables.

#### C9 · Cardmarket wants list re-sorted inside the loop — *Medium*

`Classes/CardmarketWantsList.cs:68`

`CardmarketDecklistDtos = CardmarketDecklistDtos.OrderBy(dto => dto.Name).ToList();` sits
inside the `foreach`, so the whole list is sorted and re-allocated on every input row.

**Effect:** O(n² log n) for a sort that only matters once. For a full collection this is one
of the slowest parts of the export.

**Fix:** move the line after the loop.

#### C10 · Quadratic byte accumulation while reading `content.xml` — *Medium*

`ParseOds.cs:305-315`

The entry is read in 2,000-byte chunks, and each chunk grows the result through
`Array.Resize` followed by `Array.Copy` — every chunk copies the entire accumulated buffer
again.

**Effect:** for a multi-megabyte `content.xml` (the example `.ods` is 880 KB compressed)
that is thousands of full-buffer copies. This is the reason for the "This may take some
time" notice at `ParseOds.cs:289`.

**Fix:** copy into a `MemoryStream` (`zipInputStream.CopyTo(ms)`), or read straight through
a `StreamReader`, or hand the stream to `XDocument.Load` and skip materialising the string
entirely.

#### C11 · Menus recurse instead of looping, and error paths stack them — *Medium*

`Start.cs:5-25`, `ParseOds.cs:22-55,78,94,135-139,178-182,230-235,260-265`

No menu ever returns. `Start.ShowMainMenu` calls `ParseOds.ShowMenu`, which calls
`ParseToFabrary`, which calls `Start.ShowMainMenu` again; an unrecognised key also recurses
(`ParseOds.cs:52`). The stack grows with every keystroke and only `Environment.Exit(0)`
(`Start.cs:14`) unwinds it.

This is compounded on the failure paths: `GetImportResult` calls `ShowMenu()` *and* returns
`null` (`ParseOds.cs:78,94`), and each caller then calls `ShowMenu()` again on the null
(`ParseOds.cs:135-139` and the three equivalents).

**Effect:** after a "file not found", the menu is displayed twice, and each nested frame
displays it again on the way out — the user sees the same prompt repeatedly for no visible
reason. The unbounded stack growth is unlikely to overflow in practice but is real.

**Fix:** drive both menus from a `while (true)` loop that returns to its caller; let
`GetImportResult` report failure through its return value only, and let the caller decide
what to print.

#### C12 · Misleading catch-all, and XML parsing left unguarded — *High*

`ParseOds.cs:86-99`

The `try` covers only `GetOdsContentXml`, and its `catch (Exception)` prints one message
for every possible cause: "Can't read file. Is it opened in another process?" — reported
identically for a corrupt archive, a missing `content.xml` (thrown deliberately at
`ParseOds.cs:302`), or an I/O error. Meanwhile `XDocument.Parse(contentXml)` at
`ParseOds.cs:99` sits *outside* the `try`.

**Effect:** users are sent to investigate a file lock that may have nothing to do with the
problem; and a malformed `content.xml` throws an unhandled `XmlException` that terminates
the application.

**Fix:** narrow the catch (`IOException` for the lock message), include
`exception.Message` for anything else, and bring `XDocument.Parse` inside the guarded
region.

#### C13 · Unguarded output writes end the program — *High*

`ParseOds.cs:143,196,239,269`

All four exporters open a hard-coded file name in the current directory —
`new StreamWriter("fabrary.csv")` and equivalents — with no existence check and no error
handling.

**Effect:** two consequences. An existing export is overwritten without warning. And if the
target file is open in Excel or LibreOffice — the common case, since the user has just been
looking at the previous export — the resulting `IOException` is unhandled and kills the
process, discarding the parsed collection so the whole `.ods` must be read again.
`readme.md:48` mentions this only as an aside ("File must not be opened in another process
when importing").

**Fix:** wrap each write in a `try`/`catch (IOException)`, report the path and the reason,
and return to the menu with the import cache intact. Print the absolute path that was
written (see D5, D8).

#### C14 · Set-abbreviation map is out of date, skewing trade numbers — *High*

`Classes/AbbreviationSetnameMap.cs:11-28`, `Classes/DataDto.cs:29-31`,
`Extensions/FabraryDtoListExtensions.cs:117-123`

The map ends at `ROS` ("Rosetta"). Later sets — `SUP`, `HNT`, and others — are absent, as
is `HP2`; `HP1` maps to "Crucible of War", which looks deliberate but is worth
re-confirming. `DataDto.IsReprint` is defined as "`FirstIn` is in the map **and** points at
a different set", so any card whose `First In` is not a key returns `false`.

**Effect:** in `SetExtrasForTrade`, `IsReprint` selects between keeping one copy
(`Math.Max(1, …)`) and keeping a full playset (`dto.Playset`). Cards from the missing sets
fall through to the playset branch, so Fabrary's "Extra for trade" is reported **too low**
— cards that are actually available for trade are not offered. The example spreadsheet
already contains SUP and HNT cards (commits `199dad5`, `a384652`), so this is live, not
hypothetical.

**Fix:** complete the map, and — since it will go stale again — make the gap visible:
collect `First In` values with no matching key during import and report them with the
import summary (D5).

#### C15 · Dead code and always-empty export columns — *Low*

Verified unused:

- `Classes/AbbreviationSetnameMap.cs:5-9` — the nested `Setnames` class with
  `HISTORY_PACK_1` / `HISTORY_PACK_2` is referenced nowhere. Note that `DataDto.IsHistory`
  (`DataDto.cs:33-34`) does its own `StartsWith("History")` instead of using them.
- `Classes/ImportResult.cs:18-28,48-52` — `GetNeedSet`, `GetLeftSet` and `GetNeedTotal`
  have no callers. `GetHaveSet`, `GetHaveTotal` and `GetLeftTotal` are used.
- `TcgPowertools/TcgDto.cs` — `CardmarketId`, `Condition`, `Language`, `IsSigned` and
  `Comment` are never assigned, so every row is exported with those columns empty.
- `Fabrary/FabraryDto.cs:50-54` — `WantInTrade`, `WantToBuy` and `ExtraForSell` are
  explicitly set to `null` in the constructor and never set anywhere else.

**Effect:** mostly noise, but the export DTOs raise a real question: are those columns
optional for the receiving tools, or is the import silently accepting incomplete rows?
Worth confirming once against each tool's import documentation.

**Fix:** delete the unused helpers and constants; for the DTO columns, either populate them
or record in a comment why they are intentionally blank.

#### C16 · Culture-sensitive case conversion — *Low*

`TcgPowertools/TcgList.cs:17,42-44`, `Classes/DragonshieldList.cs:14`,
`ParseOds.cs:26,70,171,297`

Set codes and rarities are compared through bare `ToLower()` / `ToUpper()`, which use the
current culture.

**Effect:** on a Turkish locale, `I` lowercases to `ı`, so rarity comparisons
(`"legendary"`, `"marvel"`, `"fabled"`) and set-code prefix matching fail — the export is
wrong on that machine and correct everywhere else.

**Fix:** `ToLowerInvariant()` / `ToUpperInvariant()`, or `StringComparison.OrdinalIgnoreCase`
where a comparison is what is meant.

#### C17 · Empty set input matches the entire collection — *Low*

`Classes/DragonshieldList.cs:14`, `TcgPowertools/TcgList.cs:17`

The filter is `dto.Id.StartsWith(pSetName.ToUpper())`, and `StartsWith("")` is true for
every string.

**Effect:** pressing ENTER at "Set to export" exports everything. For Dragonshield the rows
then carry `FolderName = ""` (`DragonshieldList.cs:59`), which may not be what the
importing tool expects. The Cardmarket prompt documents this behaviour explicitly
(`ParseOds.cs:160`); these two do not (see D6).

**Fix:** decide whether "all sets" is supported here. If yes, say so in the prompt and pick
a sensible folder name; if no, reject empty input.

#### C18 · Cardmarket rarity filter is applied after de-duplication — *Medium*

`Classes/CardmarketWantsList.cs:61-65` vs. `ParseOds.cs:201`

`CardmarketWantsList` de-duplicates by name and pitch, keeping the **first** printing
encountered, and carries that printing's `Rarity` into the DTO. The rarity filter the user
asked for is applied much later, while writing the file.

**Effect:** if a card exists in several printings with different rarities, whether it
survives the filter depends on which printing happened to be first in the spreadsheet. A
card the user explicitly asked for can vanish from the wants list entirely.

**Fix:** apply the rarity filter when building the list, before de-duplication — or make
de-duplication rarity-aware and let the write step do nothing but format.

#### C19 · Static import cache cannot be reset — *Low*

`ParseOds.cs:17,60-66`

`ImportResult` is a process-wide static, populated on first parse and returned unchanged
from then on (added deliberately in commit `62c7cdd` to avoid re-reading the file).

**Effect:** correct and fast for the common session, but there is no way to load a
different `.ods` or pick up edits without restarting the program — and no indication that
the data is cached, so a user who edits the sheet and re-exports gets the old data and no
warning.

**Fix:** add a menu entry to clear the cache, and print which file the cached result came
from when it is reused.

---

## Documentation & UX

#### D1 · Readme promises extra columns the parser ignores — *Medium*

`readme.md:62-63` states "You may add more cols if you like or delete existing non-blue
cols." The parser stops at column 31 (C3), and deleting a column that the code maps by name
triggers the silent aliasing of C2.

**Fix:** state the real constraints — which headers must exist, and where the column limit
sits — once C2 and C3 are resolved.

#### D2 · Three of the four export targets are undocumented — *Medium*

`readme.md:22-76` vs. `ParseOds.cs:157-278`

The readme describes the general flow and has a Fabrary section. There is nothing about
`cm-wants.txt` (Cardmarket), `dragonshield.csv`, or `tcgpowertools.csv`: not the set and
rarity prompts, not the setname / set-edition prompt added in 1.1.5 (`ParseOds.cs:170`),
not what each file is meant to be imported into, and not the fact that the Cardmarket
output is a *wants* list (missing cards) while the others are *collection* lists.

**Fix:** one short section per target: what it produces, what it is imported into, and what
the prompts mean.

#### D3 · The irregular-cardname file is never explained — *Medium*

`Classes/CardmarketHelper.cs:25-46`, `docs/cardmarket-irregular-cardnames.json`

`cardmarket-irregular-cardnames.json` is created next to the executable on the first
Cardmarket or TCG Powertools export, and a copy ships in `docs/`. It exists because
Cardmarket spells some cards differently than this tool generates them. Neither the readme
nor the file itself says so, and the first entry is a placeholder
(`"Setcode": "Setcode"`) that looks like leftover test data.

**Fix:** document it in the readme — what it is for, that it is user-extendable, and the
meaning of the three fields. Consider replacing the placeholder entry with a comment-style
first line or removing it.

#### D4 · Required column headers exist only in code — *Medium*

`Classes/RowIndexMap.cs:63-156`, `readme.md:24-25`

The exact header strings — `Set`, `Edition`, `First In`, `Id`, `Rarity`, `Talent`,
`Class1/2`, `Type1/2`, `Sub1/2/3`, `Art Treatment`, `Name`, `Backside Name`, `Pitch`,
`Peculiarity`, `Playset`, `ST`, `RF`, `CF`, `GF` — are the actual contract between the
spreadsheet and the tool. The readme only points at the example file and two screenshots.

**Effect:** a user building a sheet from scratch, or renaming a column, has no reference.
Combined with C2, getting it wrong fails silently.

**Fix:** a table in the readme listing each header, whether it is required, and what the
tool does with it.

#### D5 · No summary after an export; skipped rows are invisible — *Medium*

`ParseOds.cs:150,216,246,276`, `TcgPowertools/TcgList.cs:20-72`,
`Classes/CardmarketWantsList.cs:23`, `Classes/DragonshieldList.cs:17-22`

Each export ends with a single line — "fabrary.csv has been generated." — with no row
count, no path, and no mention of what was left out. The list builders discard rows for
several reasons without telling anyone: `Id` blank or `"0"`, `Id.Length != 6`
(`TcgList.cs:29`), special art treatments and high rarities (`TcgList.cs:41-47`), and an
inconsistent playset across sets — which is reported, but only to `Debug.WriteLine`
(`TcgList.cs:69`), invisible in a release build.

**Effect:** the user cannot tell the difference between "that card is not in the export
because the rules say so" and "that card is missing because something is wrong". This is
what makes C2 and C14 hard to notice.

**Fix:** collect skip reasons with counts during the build and print a summary: rows read,
rows written, rows skipped by reason, absolute output path, plus unmatched headers (C2) and
unknown set codes (C14).

#### D6 · Prompts are inconsistent about defaults — *Low*

`ParseOds.cs:160,165,170,226,256`

The Cardmarket prompts spell out "or just ENTER for all". The Dragonshield
(`ParseOds.cs:226`) and TCG Powertools (`ParseOds.cs:256`) prompts do not, although ENTER
there has the same effect (C17). The `[s]` / `[e]` / `[ENTER]` prompt at `ParseOds.cs:170`
silently treats any other key as "none".

**Fix:** make the three set prompts read the same way, and either echo the interpreted
choice back or re-prompt on an unrecognised key.

#### D7 · Path example is the author's machine — *Low*

`readme.md:36` gives `D:\Projects\FabCollectionTool\docs\example.ods` as the example path.
A generic placeholder reads better for anyone else.

#### D8 · Output location described incorrectly — *Low*

`readme.md:44-46` says the result appears "in the FabCollectionTool.exe folder". The
exporters write relative paths (`ParseOds.cs:143`), so files land in the **current working
directory**, which matches the executable's folder only when it is launched from there —
not when started from a shortcut or another directory.

**Fix:** correct the sentence, and print the absolute path on success (D5).

---

## Noted in passing (out of scope)

Observed while reading, **not** investigated as part of this audit:

- `FabCollectionTool.csproj:5` targets `net6.0`, which left Microsoft support in November 2024.
- `.github/workflows/` exists but is empty — there is no CI, and the repository contains no tests.
- `FabCollectionTool.csproj:9-11` sets `AssemblyVersion` and `FileVersion` to `0.0.1.0` while
  `Version` is `1.1.5`, so the built binary does not report its release version.

---

## Suggested order of work

**1 — Stop the silent wrong data.** C14, C5, C2, C1. These produce exports that look correct
and are not. C14 affects output today; C2 and C1 are the two ways a spreadsheet change can
corrupt an import without warning.

**2 — Survive failure, and say what happened.** C13, C12, C11, D5. The tool should not end
because a file was open, and it should report what it wrote and what it skipped. D5 is also
what makes the group-1 defects noticeable in future.

**3 — Clean up.** Performance: C6, C8, C9, C10 — all local, all mechanical. Then C3 with
D1, and the remaining low-severity items C4, C7, C15–C19 and D2–D4, D6–D8.

Documentation items D1–D4 are best written *after* the code changes in groups 1 and 2, so
the readme describes the behaviour that will actually ship.
