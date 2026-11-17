# Monthly Balance

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by tghcastro, 2026-11-17

## Situation

- Effort: in active construction
- Decision: committed by tghcastro, 2026-11-17. Carrying the balance over between months was intentionally postponed from the first version of the transactions page.
- In flight: this builds on the monthly transactions view from the [Transactions PRD](./transactions.md) and changes only how balances are calculated and shown. Transfers between accounts are a separate, later feature and stay out.
- At stake: cheap to undo. Balances are derived from transactions, nothing stored changes, and the tool has a single user.

## Problem

Construction. The transactions page shows one month at a time, and today every balance starts again at 0.00 on the first day of the month. So the "Final available balance" is really just that month's net total, not the money the owner has. To know how much money they actually have, the owner has to add up previous months themselves. That stops the page from replacing the old tool's monthly view, which is the cutover goal in the Transactions PRD.

Unmeasured: there is no usage data. This is the owner's own judgment from using the first version.

## Success

- Worked if: from the cutover month on, the owner reads how much money they have, overall or for one account, from the month's Final available balance, without adding up earlier months themselves.
- Going wrong: the owner checks a balance against an earlier month or a spreadsheet and finds a difference that isn't explained by an unsettled forecast.
- Review: end of the first full month after cutover - tghcastro.

## Boundary

In: the per-day running balance, the Monthly net total and the Final available balance on the transactions page, with no filter, with an account filter, with a category filter, and with both together. Also: empty months, months before the first transaction and after the last one, and changes to past transactions.

Out:
- Transfers between accounts (debit A, credit B) - a separate feature.
- Account opening balances - every account starts at 0.00 before its first transaction (see Open questions).
- Balances for a range of months, reports and charts - not needed for parity with the old tool.

Unchanged:
- The page still shows one month at a time, chosen by month and year.
- Labels stay as they are: the day group shows only "Balance <value>"; the summary shows "Total received", "Total debits", "Monthly net total" and "Final available balance".
- Money uses the application's standard format: thousands separator and two decimals, for example `3,000.00` and `-180.00`.

Terms: the **Monthly net total** is the net of the selected month only (receipts minus debits). The **Final available balance** is the closing balance: the closing balance of the previous month plus this month's net. The **running balance** is the balance shown after each day group.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| View a month, no filters | The running balance starts from the previous month's closing balance. The Final available balance is that opening balance plus the month's net. | Day balances and Final available balance that carry over from earlier months; Monthly net total for this month only |
| Month before the first transaction ever | The opening balance is 0.00. | Monthly net total 0.00 and Final available balance 0.00 |
| Empty month between active months | Nothing is listed. The previous closing balance carries forward unchanged to the next month. | Monthly net total 0.00; Final available balance equal to the previous month's |
| Month after the last transaction | Same as an empty month: the closing balance of the last month with transactions. | Final available balance equal to the last active month's |
| Several transactions on one day | One running balance after all of that day's transactions. | One "Balance" per day group |
| Account filter (one or several accounts) | Every balance is calculated from the selected accounts only, still carrying over from earlier months. | Day balances, Monthly net total and Final available balance for those accounts only |
| Category filter (one or several categories) | Only the selected month counts: the running balance starts at 0.00 on the first day of the month. Monthly net total and Final available balance are hidden. | Day balances for that category within the month; no Monthly net total, no Final available balance |
| Category and account filters together | The category rule applies (start at 0.00, summaries hidden), counting only transactions in both the selected categories and the selected accounts. | Day balances for that category in that account within the month |
| A past transaction is edited, deleted, or moved to another month or account | Every balance from that transaction's month on reflects the change. Nothing has to be recalculated by hand. | Updated balances in that month and all later months, and in the affected account's filtered view |
| Forecast and settled entries | Both count towards every balance, as they do today. | Balances that include forecasts |

## Acceptance scenarios

These describe business behaviour only. Boundary and validation checks belong to the implementation checks, not here.

```gherkin
Feature: Monthly balance carries over between months

  Background:
    Given I have these categories:
      | Category  |
      | Income    |
      | Housing   |
      | Groceries |
      | Shopping  |
      | Health    |
      | Leisure   |
    And I have these accounts:
      | Account          |
      | Checking Account |
      | Credit Card      |
    And I have these transactions:
      | Date       | Description       | Category  | Account          | Amount   | Type    |
      | 2026-11-01 | Salary - Acme     | Income    | Checking Account | 3,000.00 | Receipt |
      | 2026-11-10 | New office chair  | Shopping  | Credit Card      |   229.00 | Debit   |
      | 2026-11-15 | Condo fees        | Housing   | Checking Account |   450.00 | Debit   |
      | 2026-12-01 | Salary - Acme     | Income    | Checking Account | 3,000.00 | Receipt |
      | 2026-12-05 | Dentist           | Health    | Checking Account |   120.00 | Debit   |
      | 2026-12-10 | Wireless keyboard | Shopping  | Credit Card      |   110.00 | Debit   |
      | 2026-12-15 | Condo fees        | Housing   | Checking Account |   450.00 | Debit   |
      | 2027-01-01 | Salary - Acme     | Income    | Checking Account | 3,000.00 | Receipt |
      | 2027-01-01 | Dividends         | Income    | Checking Account | 1,000.00 | Receipt |
      | 2027-01-05 | Condo fees        | Housing   | Checking Account |   450.00 | Debit   |
      | 2027-01-05 | Winter jacket     | Shopping  | Credit Card      |   180.00 | Debit   |
      | 2027-01-05 | Gym               | Leisure   | Checking Account |    50.00 | Debit   |
      | 2027-01-12 | Supermarket       | Groceries | Checking Account |   200.00 | Debit   |
      | 2027-01-20 | Running shoes     | Shopping  | Credit Card      |   150.00 | Debit   |
      | 2027-01-25 | Supermarket       | Groceries | Credit Card      |    80.00 | Debit   |
      | 2027-03-01 | Salary - Acme     | Income    | Checking Account | 3,000.00 | Receipt |

  Rule: Without filters, balances carry over from all earlier months

    Scenario Outline: Monthly net total and Final available balance per month
      When I view "<Month>"
      Then the Monthly net total is "<Monthly net total>"
      And the Final available balance is "<Final available balance>"

      Examples:
        | Month         | Monthly net total | Final available balance |
        | October 2026  | 0.00              | 0.00                    |
        | November 2026 | 2,321.00          | 2,321.00                |
        | December 2026 | 2,320.00          | 4,641.00                |
        | January 2027  | 2,890.00          | 7,531.00                |
        | February 2027 | 0.00              | 7,531.00                |
        | March 2027    | 3,000.00          | 10,531.00               |
        | April 2027    | 0.00              | 10,531.00               |

    Scenario: The first month with transactions starts from 0.00
      When I view "November 2026"
      Then the day balances are:
        | Date       | Balance  |
        | 2026-11-01 | 3,000.00 |
        | 2026-11-10 | 2,771.00 |
        | 2026-11-15 | 2,321.00 |

    Scenario: The running balance continues from the previous month's closing balance
      When I view "December 2026"
      Then the day balances are:
        | Date       | Balance  |
        | 2026-12-01 | 5,321.00 |
        | 2026-12-05 | 5,201.00 |
        | 2026-12-10 | 5,091.00 |
        | 2026-12-15 | 4,641.00 |

    Scenario: A day with several transactions shows one balance after all of them
      When I view "January 2027"
      Then the day balances are:
        | Date       | Balance  |
        | 2027-01-01 | 8,641.00 |
        | 2027-01-05 | 7,961.00 |
        | 2027-01-12 | 7,761.00 |
        | 2027-01-20 | 7,611.00 |
        | 2027-01-25 | 7,531.00 |

    Scenario: An empty month between active months carries the balance forward
      When I view "February 2027"
      Then no transactions are listed
      And the Final available balance is "7,531.00"
      When I view "March 2027"
      Then the day balances are:
        | Date       | Balance   |
        | 2027-03-01 | 10,531.00 |

  Rule: An account filter scopes balances to that account, still carrying over

    Scenario Outline: Balances for "Checking Account" per month
      Given I filter by account "Checking Account"
      When I view "<Month>"
      Then the Monthly net total is "<Monthly net total>"
      And the Final available balance is "<Final available balance>"

      Examples:
        | Month         | Monthly net total | Final available balance |
        | November 2026 | 2,550.00          | 2,550.00                |
        | December 2026 | 2,430.00          | 4,980.00                |
        | January 2027  | 3,300.00          | 8,280.00                |
        | February 2027 | 0.00              | 8,280.00                |

    Scenario: The running balance continues from the account's previous closing balance
      Given I filter by account "Checking Account"
      When I view "January 2027"
      Then only "Checking Account" transactions are listed
      And the day balances are:
        | Date       | Balance  |
        | 2027-01-01 | 8,980.00 |
        | 2027-01-05 | 8,480.00 |
        | 2027-01-12 | 8,280.00 |

  Rule: A category filter considers only the selected month and hides the summary balances

    Scenario: Filtering by a category starts the running balance at 0.00
      Given I filter by category "Shopping"
      When I view "January 2027"
      Then only these transactions are listed:
        | Date       | Description   | Category | Account     | Amount | Type  |
        | 2027-01-05 | Winter jacket | Shopping | Credit Card | 180.00 | Debit |
        | 2027-01-20 | Running shoes | Shopping | Credit Card | 150.00 | Debit |
      And the day balances are:
        | Date       | Balance |
        | 2027-01-05 | -180.00 |
        | 2027-01-20 | -330.00 |
      And the Monthly net total is not displayed
      And the Final available balance is not displayed

    Scenario: Category and account filters together follow the category rule
      Given I filter by category "Groceries"
      And I filter by account "Checking Account"
      When I view "January 2027"
      Then only these transactions are listed:
        | Date       | Description | Category  | Account          | Amount | Type  |
        | 2027-01-12 | Supermarket | Groceries | Checking Account | 200.00 | Debit |
      And the day balances are:
        | Date       | Balance |
        | 2027-01-12 | -200.00 |
      And the Monthly net total is not displayed
      And the Final available balance is not displayed

  Rule: Changing a past transaction updates every later balance

    Scenario: Editing the amount of a past transaction
      When I change the amount of "Dentist" on 2026-12-05 to "220.00"
      Then the Final available balance of "December 2026" is "4,541.00"
      And the Final available balance of "January 2027" is "7,431.00"
      And the day balance of 2027-01-01 is "8,541.00"

    Scenario: Deleting a past transaction
      When I delete "New office chair" on 2026-11-10
      Then the Final available balance of "November 2026" is "2,550.00"
      And the Final available balance of "December 2026" is "4,870.00"
      And the Final available balance of "January 2027" is "7,760.00"

    Scenario: Moving a past transaction to the next month
      When I change the date of "Condo fees" on 2026-12-15 to 2027-01-02
      Then "December 2026" has Monthly net total "2,770.00" and Final available balance "5,091.00"
      And "January 2027" has Monthly net total "2,440.00" and Final available balance "7,531.00"

    Scenario: Moving a past transaction to another account
      When I change the account of "Wireless keyboard" on 2026-12-10 to "Checking Account"
      And I filter by account "Checking Account"
      Then the Final available balance of "December 2026" is "4,870.00"
      And the Final available balance of "January 2027" is "8,170.00"
```

## Open questions

1. Account opening balances - default taken: every account starts at 0.00. Money held before the first month is recorded as a Receipt transaction in that month.
2. Total received and Total debits under a category filter - default taken: still shown, covering that month's listed transactions only. Only the Monthly net total and the Final available balance are hidden.
3. Forecasts in balances - default taken: forecast and settled entries both count, as today. A balance from settled entries only is not part of this round.
