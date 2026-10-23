# jevcells

[img](path)

Jev in your cells

# TOC
- [About](#about)
- [Install](#install)
- [Formulas](#formulas)
- [How it behaves](#how-it-behaves)
- [Development](#development)
- [Todo](#todo)

# About

jevcells is a Google Sheets add-on where a formula asks Jev, the TypeSafe model that gives back a probability for each answer you define instead of writing text, a question about every row of a range. There is already a good add-on for the basic yes/no, choice and score formulas (jev-sheets by Cab14bacc), so the point of this one is the formulas that do a job, rank a range on weighted criteria in one request, match rows to a lookup list like a fuzzy VLOOKUP, tag each row with every label that applies, and pick a value such as an email out of a cell from candidates found in it so nothing is ever invented, with the basics included so one install covers it. It may not be perfect but it's better than nothing.

Not affiliated with TypeSafe or Google.

# Install

Until the marketplace listing is up, open a sheet, Extensions, Apps Script, create files named core.gs, client.gs, functions.gs, sidebar.gs and Sidebar.html and paste the matching files from dist/ in, replace the manifest with appsscript.json (Project Settings, show the manifest), save and reload the sheet. A Jev menu appears, Set API key opens a sidebar, the key is stored in your user properties and never in the sheet.

With clasp, copy .clasp.json.example to .clasp.json with the script id from the Apps Script editor, then npm run push.

# Formulas

```
=JEV_PROB(A2:A50, "Is this a complaint?")                       probability of yes per row
=JEV_IF(A2:A50, "Is this urgent?", 0.7)                         TRUE or FALSE at a threshold
=JEV_CHOICE(A2:A50, "billing, technical, sales")                one option, UNSURE or NONE
=JEV_SCORE(A2:A50, "How urgent?", "low, medium, high")          1 to N, can land between
=JEV_TAGS(A2:A50, "urgent, billing, bug", 0.5)                  every label that applies
=JEV_PICK(A2:A50, "the email address", "[\w.]+@[\w.]+")         a value selected from the cell
=JEV_RANK(A2:A20, "How good for a group?, How cheap?", "3, 1")  two columns, score 1 to 5 and rank
=JEV_MATCH(A2:A50, Sheet2!A2:A200, 0.5)                         the lookup entry that is the same thing
```

Options, levels, labels, criteria and weights take a comma separated string or a range. A range of several columns is read as one item per row with the first row as headers when it looks like one, so name, description and price get judged together.

# How it behaves

Every row is its own request except JEV_RANK, which sends the whole range as one request with one score per item per criterion and averages them in code with your weights, so Jev never sees the weights and changing one is a recalculation, not a new judgment. Requests go out in batches of twenty through UrlFetchApp.fetchAll with retries on a rate limit, identical questions on identical text are cached for six hours per user so a recalculation doesn't re-bill, and one formula takes at most 500 cells since Sheets gives a custom function thirty seconds. JEV_PICK and JEV_MATCH work by giving Jev a numbered list of candidates and reading the number back, so the result is always a real value from the cell or the lookup range. Errors show in the cell as #JEV and a reason. The text of every cell you point a formula at goes to TypeSafe.

# Development

```bash
npm install
npm test        # vitest over src/core.js, the pure builders and shapers, no key needed
npm run build   # dist/ with the .gs files and the manifest
```

src/core.js has no Apps Script in it, src/client.js is the UrlFetchApp and cache layer, src/functions.js is the custom functions, src/sidebar.js the menu and key sidebar.

# Todo

- [ ] Add the image
- [ ] Workspace Marketplace listing, needs the OAuth consent screen and a privacy page
- [ ] A JEV_ASK that takes a questions json for anything the named formulas don't cover
- [ ] Row level cache keys so editing one cell doesn't re-ask the others
