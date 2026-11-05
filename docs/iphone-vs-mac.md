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
| Savings | ✅ + archived list | ✅ account | ✅ pencil | ✅ archive / restore / delete | — |
| Investments | ✅ + archived list | 🟡 | ✅ | ✅ archive / restore / delete | Mutual-fund creation |
| Stocks (StockMarketDetails) | ✅ + search/filter, archived list | ✅ | ✅ archive/restore | ✅ | Custom columns, the news-and-AI half of "Refresh prices & news" (prices refresh from the phone) |
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
| NPS | ✅ | ✅ scheme, statement | ✅ | ✅ | — |
| Gold bonds (SGB) | 🟡 generic page | ✅ | ✅ | ✅ | Mac layout (holdings cards, interest schedule) |
| Savings account | 🟡 generic page | ✅ | ✅ | ✅ | Earnings distribution chart; linked RDs |
| Emergency fund | 🟡 generic page | ✅ | ✅ | ✅ | Mac layout |
| Policy | 🟡 generic page | ✅ premiums | ✅ | ✅ | Documents & receipts (upload/view), Mac layout |

## Spending

| Mac page | View | Add | Edit | Delete | Missing |
| --- | --- | --- | --- | --- | --- |
| Expenses (years) | ✅ | ❌ | — | — | Initialize a new year; import a bank statement |
| Month page | ✅ (velocity, card & wallet summaries added; parity-tested all 120 months) | ✅ tx | ✅ tx | ✅ tx | Financial tasks (fixed placeholder list on the Mac) |
| All transactions | ✅ | ✅ | ✅ | ✅ | Export |
| Spending analysis | ✅ | — | — | — | — |
| Money flow | ✅ | — | 🟡 | — | Classifying categories |
| Cards list | ✅ | ✅ card (new) | ✅ | ❌ | Delete a card |
| Single card | ✅ history, own transactions | ✅ tx | ✅ tx, baseline | ✅ tx | Statement import; monthly-history records (none exist in your data) |
| Card intelligence | ✅ | — | — | — | — |
| Budget limits | ✅ | ✅ main & sub categories | ✅ limits | ❌ | Rename / delete categories (they rewrite past transactions) |
| Recurring | ✅ | — | 🟡 | — | Overrides (cancel / ignore / watch) |
| Fuel, Grocery analytics | ✅ | — | — | — | — |
| Grocery builder | ✅ | ✅ category, item, brand, variant | — | ✅ | Rename, move an item, link brands to items |
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
| Metals / metal list | ✅ | ✅ | ✅ | ✅ | Lockers |
| Metal item | 🟡 photo | — | — | — | Photo gallery and bills (upload / delete) |
| Ornament gallery | ✅ | — | — | — | — |
| Assets, items, warranties | ✅ | ✅ | ✅ | ✅ | Item photo |
| DocuSetu | web page | | | | Native screen |

## Order of work

1. Done in this pass: **add** a goal, loan, person, watchlist entry, IPO application, tax year and card (one record, through the
   Mac's write guard; needs the Mac).
2. ~~Month page extras~~ — done.
3. Precious metals: items and manual rates done; photos and bills remain.
4. ~~Single card~~ — done (statement import stays on the Mac).
5. ~~Stocks list: add / archive / delete a holding~~ — done; savings & investment accounts archive / delete — done.
6. ~~Budget categories~~ add done (rename / delete stay on the Mac); Grocery builder add/delete — done (rename and linking stay on the Mac).
7. Account pages still on the generic layout (NPS done): SGB, savings account, emergency fund, policy (with documents).
8. Insurance profile and policies; salary employments; new expense year; statement import.
9. Deleting loans, people, cards and tax years (they link to other records, so each needs its own check).
