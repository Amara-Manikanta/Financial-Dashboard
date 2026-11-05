# iPhone vs Mac — page-by-page differences

Audit of every Mac page (`src/pages/*.jsx`) against its iPhone screen (`ios/Kubera/Features`).
"Matches" means the same figures (parity-tested against the Mac's own code), the same sections and the same
actions. Layout is native iPhone (cards, one column) rather than a copy of the desktop grid — the goal is the
same content and the same things you can do.

Legend: ✅ matches · 🟡 shown but something is missing · ❌ not on the iPhone

## Overview

| Mac page | View | Add | Edit | Delete | What is missing on the iPhone |
| --- | --- | --- | --- | --- | --- |
| Dashboard | ✅ | — | — | — | Investment ledger quick-add (Mac `handleSaveTransaction`) |
| Savings | ✅ | ✅ account | 🟡 pencil | ❌ | Archive / unarchive / delete an account; archived list |
| Investments | ✅ | 🟡 | 🟡 | ❌ | Archive / delete an account, archived list; mutual-fund creation |
| Stocks (StockMarketDetails) | ✅ + search/filter | ❌ | 🟡 | ❌ | Add / delete a holding, archive toggle, custom columns, "Refresh all prices & news" |
| Stock page | ✅ | ✅ tx | ✅ tx | ✅ tx | — |
| Loans & Lents | ✅ | ✅ loan, person (new) | ✅ | ❌ | Delete a loan or a person |
| Person page | ✅ | ✅ tx | ✅ tx | ✅ tx | Delete the person |

## Accounts

| Mac page | View | Add | Edit | Delete | Missing |
| --- | --- | --- | --- | --- | --- |
| Fixed deposits / single deposit | ✅ | ✅ | ✅ renew, close | ✅ | TDS deductions list on a deposit |
| Recurring deposits / single RD | ✅ | ✅ | ✅ | ✅ | Classic-table view (cards hold the same data) |
| PPF | ✅ | ✅ + Add interest | ✅ | ✅ | — |
| PF | ✅ | ✅ | ✅ (UAN via pencil) | ✅ | — |
| Mutual fund | ✅ | ✅ tx | ✅ tx, Refresh NAV | ✅ tx | Composition panels; archive toggle is in the pencil |
| NPS | 🟡 generic page | ✅ | ✅ | ✅ | Allocation chart, scheme holdings and statements layout |
| Gold bonds (SGB) | 🟡 generic page | ✅ | ✅ | ✅ | Mac layout (holdings cards, interest schedule) |
| Savings account | 🟡 generic page | ✅ | ✅ | ✅ | Earnings distribution chart; linked RDs |
| Emergency fund | 🟡 generic page | ✅ | ✅ | ✅ | Mac layout |
| Policy | 🟡 generic page | ✅ premiums | ✅ | ✅ | Documents & receipts (upload/view), Mac layout |

## Spending

| Mac page | View | Add | Edit | Delete | Missing |
| --- | --- | --- | --- | --- | --- |
| Expenses (years) | ✅ | ❌ | — | — | Initialize a new year; import a bank statement |
| Month page | 🟡 categories + income | ✅ tx | ✅ tx | ✅ tx | Credit-card summary, wallets summary, spending velocity, statement info, financial tasks |
| All transactions | ✅ | ✅ | ✅ | ✅ | Export |
| Spending analysis | ✅ | — | — | — | — |
| Money flow | ✅ | — | 🟡 | — | Classifying categories |
| Cards list | ✅ | ✅ card (new) | ✅ | ❌ | Delete a card |
| Single card | 🟡 history | ❌ | ❌ | ❌ | Card expense rows add/edit/delete, carry-forward baseline, statement import |
| Card intelligence | ✅ | — | — | — | — |
| Budget limits | ✅ | ❌ categories | ✅ limits | ❌ | Add / rename / delete main and sub categories |
| Recurring | ✅ | — | 🟡 | — | Overrides (cancel / ignore / watch) |
| Fuel, Grocery analytics | ✅ | — | — | — | — |
| Grocery builder | 🟡 read-only | ❌ | ❌ | ❌ | Add / rename / delete categories and items |
| Data health | ✅ | — | — | — | — |

## Investing, income, planning

| Mac page | View | Add | Edit | Delete | Missing |
| --- | --- | --- | --- | --- | --- |
| Stock analyst, Research | ✅ | — | — | — | Pasting / importing research (Mac only by design) |
| Watchlist | ✅ | ✅ (new) | ✅ | ✅ | Alerts editing |
| IPO applications | ✅ | ✅ (new) | ✅ | ✅ | — |
| Returns, Capital gains, Dividends, Free holdings, Nifty overlap | ✅ | — | — | — | — |
| Salary | ✅ | ❌ new month | ✅ month | ❌ | Employments, custom salary fields |
| Taxes | ✅ | ✅ (new) | ✅ | ❌ | Delete a tax year |
| Goals | ✅ | ✅ (new) | ✅ | ✅ | — |
| Insurance analysis | ✅ | ❌ | ❌ | ❌ | Financial & family profile, add/delete policies |
| Cashflow, Net worth history | ✅ | — | — | — | — |

## Gold, silver, assets

| Mac page | View | Add | Edit | Delete | Missing |
| --- | --- | --- | --- | --- | --- |
| Metals / metal list | ✅ | ❌ | ❌ | ❌ | Add / edit / delete items, manual rates, lockers |
| Metal item | 🟡 photo | ❌ | ❌ | ❌ | Photo gallery and bills (upload / delete) |
| Ornament gallery | ✅ | — | — | — | — |
| Assets, items, warranties | ✅ | ✅ | ✅ | ✅ | Item photo |
| DocuSetu | web page | | | | Native screen |

## Order of work

1. Done in this pass: **add** a goal, loan, person, watchlist entry, IPO application, tax year and card (one record, through the
   Mac's write guard; needs the Mac).
2. Month page extras (card and wallet summaries, spending velocity, statement info).
3. Precious metals editing (items, manual rates, photos, bills).
4. Single card: expense rows and carry-forward baseline.
5. Stocks list: add / archive / delete a holding; savings & investment accounts: archive / delete.
6. Budget categories and Grocery builder editing.
7. Account pages still on the generic layout: NPS, SGB, savings account, emergency fund, policy (with documents).
8. Insurance profile and policies; salary employments; new expense year; statement import.
9. Deleting loans, people, cards and tax years (they link to other records, so each needs its own check).
