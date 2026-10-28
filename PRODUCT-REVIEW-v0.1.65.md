# Manokshmi RestroBill – Product Review and Improvement Scope

Written as a product manager review. Rule followed: nothing that exists today is removed or changed in behaviour. Everything below is either already added in v0.1.65 or is a proposal for later.

## 1. Shipped in v0.1.65 (additive)

| Feature | What staff see | Safety |
|---|---|---|
| Kitchen notes on KOT | A 📝 button on every cart line. Tap it, tap chips (Less oil, Less spicy, More spicy, Medium spicy, No onion, No garlic, Extra gravy, Less salt, Less sweet, Extra crispy, Jain, Serve hot, Serve first, Pack separately), or type a custom note. Keys 1-9 toggle chips, Enter = Done, Esc = cancel. | Same dish with different notes becomes separate lines, so nothing merges wrongly. |
| Most-used notes first | Chips reorder themselves by how often each is used on this PC. | Local ordering only. |
| Edit notes in Settings | Settings > Kitchen Notes: rename, move up/down, delete, add, reset to standard list. Saves immediately. | Stored in the database; old shops get the standard list automatically. |
| KOT print | Note prints under the dish, no prices. If a note is changed after the dish was already sent, the KOT prints a CHANGE line so the kitchen sees the update. | Tested. |
| Cash received + change | For Cash bills a helper appears under the totals: Exact, round-up buttons (e.g. 350, 400, 500, 1000, 2000), Clear, and "Return: ₹x" or "Short by: ₹x". Enter in the field saves the bill if enough cash was given. Alt+C jumps to the field. | Display only: it never changes the bill total or payment mode. Hidden for UPI/Card/Split. |

Database change: one new migration (0008) that only ADDS columns. Existing bills, running orders and settings were tested to survive the upgrade untouched.

## 2. UI issues found (to fix later, without changing existing behaviour)

Priority: H = high, M = medium, L = low.

| # | Issue | Why it matters | Suggested fix | Pri |
|---|---|---|---|---|
| 1 | Red "gap/missing bill" warning is visible to all staff | Staff and customers see technical alarms; recovery is meant to be silent | Show only to owner/admin login | H |
| 2 | Cash received is not saved on the bill or printed | Disputes about change cannot be checked later | Store cash received and change on the bill (needs a new migration) and optionally print them on the receipt | H |
| 3 | No order-level kitchen note (e.g. "table in a hurry") | Only per-dish notes exist | Add one note box per order that prints on KOT header | M |
| 4 | Deleted/cleared bills cannot be brought back from the screen | Owner mistake = permanent | "Restore deleted bill" in History (owner only), using the journal that already exists | M |
| 5 | Backup copies and journal files grow forever | About 1.5 GB after one year at 40 bills/day | Compress copies, keep fewer, prune old journal | M |
| 6 | No owner health check | Owner cannot see in one place if saving is fine | Settings card: last save time, last backup, gaps found, placeholders | M |
| 7 | Billing is mouse-heavy for fast counters | Slower peak-hour billing | See section 3 | M |
| 8 | Only local copies of data | A dead disk loses everything | Cloud/offsite copy of each bill plus an alert if it fails | H (next big step) |
| 9 | Parcel flow needed the table list (fixed in 0.1.62) | Already solved with the top "New Parcel" button | Keep | Done |

## 3. Fast billing and cash handling: what can be done

Already in v0.1.65: cash quick buttons, change/short display, Enter to save, Alt+C.

Proposed next, all optional and additive:

1. Keyboard-first billing: type-to-search dish, Enter to add, + / - to change quantity, F-key to save and print, so a cashier never needs the mouse.
2. "Repeat last order" and "Favourites" row at the top for the most-sold dishes (auto-ranked like the notes).
3. Quantity by number: type "3" then pick a dish to add 3.
4. Tap-to-split by guests with an equal-split calculator.
5. Remember last payment mode per session so the common one is already selected.
6. Cash drawer summary at close: expected cash vs counted cash, with note-by-note counting (₹500 x n, ₹200 x n ...) and difference shown.
7. Rounding option (nearest ₹1 / ₹5) shown clearly on the bill.
8. Duplicate-click protection on Save Bill (disable for 1 second) to prevent double bills in a rush.
9. Big-button "touch mode" for tablets and touch monitors.
10. Running total banner always visible at the bottom while scrolling long carts.

## 4. How it was tested

- Notes: add, edit, merge/split of lines, KOT print with and without notes, CHANGE line, restart persistence, saved on bill and bill items.
- Cash helper: visibility rules (Cash only), quick amounts, return and short maths, Enter saves only when cash is enough, bill unchanged.
- Settings: add, rename, reorder, delete, reset, survives restart.
- Upgrade: a database built with migrations 1-7 and real bills/running orders upgraded to 0008 with nothing lost.
- Crash safety: app killed at 36 different points while saving a bill with notes. No lost, duplicated or half-saved bills.

## 5. Not covered / honest limits

- Printing was tested through the app's print routine, not on a physical thermal printer. Test one KOT on the real printer before updating the hotel.
- No software can promise literally 100%. Cloud copy (item 8) is what closes the remaining gap.

## 6. Release steps

1. `git ls-remote --tags origin` and confirm v0.1.65 is not already taken (use the next free number if it is, and update the version in the four files).
2. In PowerShell, from the project folder: `git add -A`, `git commit -m "v0.1.65 kitchen notes and cash helper"`, `git tag v0.1.65`, `git push origin main --tags`.
3. Wait for the green GitHub Actions build, publish the draft release.
4. Install on your own PC first. Copy `restaurant.db` from `%APPDATA%` as a backup before installing, because this update adds database columns.
5. Test: add a note, send KOT, take a cash bill, then update the hotel.
