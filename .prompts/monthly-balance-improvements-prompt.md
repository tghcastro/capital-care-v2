# Monthly Balance Improvements

**STATUS**: TO-DO

## Context

The first version of the transactions page was created and the base features are working as expected. However, carrying over the wallet balance between months was intentionally postponed.

## Workflow (`tlc-prd`)

- I want to create a comprehensive PRD that describes this feature so I can start implementation soon. Define acceptance scenarios in Gherkin **strictly** for acceptance tests.
- Identify and document edge cases (e.g., empty months between active months, combined filters, retroactive transaction edits/deletions)

## Requirements

- **Monthly & Wallet Balances**: Distinguish between "Current month" balance (net total of the selected month only) and "Wallet" balance (accumulative balance from all previous months up to the end of the selected month).
- **Accumulative Behavior**: A balance from one month must carry over to subsequent months. If there are no transactions in previous months, the initial balance is 0,00.
- **Daily Group Balance**: Each day with transactions displays a running balance. By default, this daily balance is accumulative across months.
- **Account Filter**: When filtering by account, both monthly/wallet balances and daily group balances must consider previous months, scoped exclusively to that specific account.
- **Category Filter**: When filtering by category, consider only the currently selected month (resetting the starting balance to 0,00 for the daily group balance) and hide the "Current month" and "Wallet" summary balances.

## Examples (Gherkin Reference)

  Background:
    Given I have these categories:
      | Category  |
      | Income    |
      | Housing   |
      | Groceries |
      | Transport |
      | Shopping  |
      | Health    |
      | Leisure   |
    And I have these accounts:
      | Account          |
      | Checking Account |
      | Credit Card      |
    And I have these following transactions:
      | Date       | Description       | Category | Account          | Amount  | Type    |
      | 2026-11-01 | Salary - Acme     | Income   | Checking Account | 3000,00 | Receipt |
      | 2026-11-10 | New office chair  | Shopping | Credit Card      | 229,00  | Debit   |
      | 2026-11-15 | Condo fees        | Housing  | Checking Account | 450,00  | Debit   |
      | 2026-12-01 | Salary - Acme     | Income   | Checking Account | 3000,00 | Receipt |
      | 2026-12-05 | Dentist           | Health   | Checking Account | 120,00  | Debit   |
      | 2026-12-10 | Wireless keyboard | Shopping | Credit Card      | 110,00  | Debit   |
      | 2026-12-15 | Condo fees        | Housing  | Checking Account | 450,00  | Debit   |
      | 2027-01-01 | Salary - Acme     | Income   | Checking Account | 3000,00 | Receipt |
      | 2027-01-01 | Dividends         | Income   | Checking Account | 1000,00 | Receipt |
      | 2027-01-05 | Condo fees        | Housing  | Checking Account | 450,00  | Debit   |
      | 2027-01-05 | Winter jacket     | Shopping | Credit Card      | 180,00  | Debit   |
      | 2027-01-05 | Gym               | Housing  | Checking Account | 50,00   | Debit   |
      | 2027-01-20 | Running shoes     | Shopping | Credit Card      | 150,00  | Debit   |

  Scenario: Balance is accumulative between months
    When I access transactions list
    Then November 2026 balance is
      | Balance       | Value   |
      | Current month | 2321,00 |
      | Wallet        | 2321,00 |
    And December 2026 balance is
      | Balance       | Value   |
      | Current month | 2320,00 |
      | Wallet        | 4641,00 |
    And January 2027 balance is
      | Balance       | Value   |
      | Current month | 3170,00 |
      | Wallet        | 7811,00 |

  Scenario: Daily balance is accumulative between months
    When I access transactions list
    Then daily group balance is
      | Date       | Balance |
      | 2026-11-01 | 3000,00 |
      | 2026-11-10 | 2771,00 |
      | 2026-11-15 | 2321,00 |
      | 2026-12-01 | 5321,00 |
      | 2026-12-05 | 5201,00 |
      | 2026-12-10 | 5091,00 |
      | 2026-12-15 | 4641,00 |
      | 2027-01-01 | 8641,00 |
      | 2027-01-05 | 7961,00 |
      | 2027-01-20 | 7811,00 |

  Scenario: Filtering account also is considered in balances
    When I filter transactions list by "Checking Account"
    Then only transactions for this account are displayed
    And daily group balance is
      | Date       | Balance |
      | 2026-11-01 | 3000,00 |
      | 2026-11-15 | 2550,00 |
      | 2026-12-01 | 5550,00 |
      | 2026-12-05 | 5430,00 |
      | 2026-12-15 | 4980,00 |
      | 2027-01-01 | 8980,00 |
      | 2027-01-05 | 8480,00 |
    And November 2026 balance is
      | Balance       | Value   |
      | Current month | 2550,00 |
      | Wallet        | 2550,00 |
    And December 2026 balance is
      | Balance       | Value   |
      | Current month | 2430,00 |
      | Wallet        | 4980,00 |
    And January 2027 balance is
      | Balance       | Value   |
      | Current month | 3500,00 |
      | Wallet        | 8480,00 |

  Scenario: Filtering by category considers only current month and hides summary balances
    Given the current month is "January 2027"
    When I filter transactions list by category "Shopping"
    Then only transactions for category "Shopping" in "January 2027" are displayed:
      | Date       | Description   | Category | Account     | Amount | Type  |
      | 2027-01-05 | Winter jacket | Shopping | Credit Card | 180,00 | Debit |
      | 2027-01-20 | Running shoes | Shopping | Credit Card | 150,00 | Debit |
    And daily group balance is
      | Date       | Balance |
      | 2027-01-05 | -180,00 |
      | 2027-01-20 | -330,00 |
    And Current month balance is not displayed
    And Wallet balance is not displayed
