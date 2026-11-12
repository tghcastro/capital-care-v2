# Transactions - Acceptance Tests

Behaviour only, in the owner's words. These scenarios explain how Transactions work; they do not check field limits, empty values or error codes (the checks cover those). Amounts are written as in the owner's examples. Where the day matters, the scenario says what day it is.

**Related:** [plan.md](plan.md) - [`.prd/transactions.md`](../../../.prd/transactions.md)

```gherkin
Feature: Transactions
  A transaction is money I spent or received, or a forecast of money I will
  pay or receive. I record it once and the system shows it in the right months.

  Background:
    Given I have these categories:
      | Category          |
      | House Maintenance |
      | Receipt           |
      | Super Market      |
      | Basic Costs       |
    And I have these accounts:
      | Account       |
      | Credit Card A |
      | Santander     |
```

## Recording a transaction

```gherkin
Feature: Recording a one-off transaction

  Scenario: A purchase appears in the month it was made
    When I record this transaction:
      | Date        | Description                    | Category          | Account       | Amount | Type  |
      | 2026-11-10  | Market chair New office chair  | House Maintenance | Credit Card A | 229,00 | Debit |
    Then November 2026 shows:
      | Date        | Description                    | Category          | Account       | Amount | Type  | Status   |
      | 2026-11-10  | Market chair New office chair  | House Maintenance | Credit Card A | 229,00 | Debit | Forecast |
    And October 2026 shows nothing
    And December 2026 shows nothing

  Scenario: Money received is recorded as a receipt
    When I record this transaction:
      | Date        | Description                  | Category | Account   | Amount  | Type    |
      | 2026-11-01  | My Company - Monthly Income  | Receipt  | Santander | 1000,00 | Receipt |
    Then November 2026 shows:
      | Date        | Description                  | Category | Account   | Amount  | Type    | Status   |
      | 2026-11-01  | My Company - Monthly Income  | Receipt  | Santander | 1000,00 | Receipt | Forecast |

  Scenario: A new transaction is always a forecast until I say it was paid
    Given today is 2026-11-12
    When I record this transaction:
      | Date        | Description    | Category      | Account   | Amount | Type  |
      | 2026-11-03  | Monthly Condo fees | Basic Costs | Santander | 20,00  | Debit |
    Then November 2026 shows "Monthly Condo fees" on 2026-11-03 as Forecast
```

## Seeing a month

```gherkin
Feature: Seeing a month

  Scenario: A month shows every entry, paid or not, from the first day to the last
    Given today is 2026-11-20
    And I have these transactions:
      | Date        | Description                    | Amount | Status       |
      | 2026-11-01  | My Company - Monthly Income    | 1000,00 | Consolidated |
      | 2026-11-05  | Monthly Condo fees             | 20,00   | Consolidated |
      | 2026-11-10  | Market chair New office chair  | 229,00  | Forecast     |
      | 2026-11-28  | Gym                            | 50,00   | Forecast     |
    When I look at November 2026
    Then I see all four entries, in date order
    And the entry on 2026-11-10 is still listed as Forecast, even though that day has passed

  Scenario: I can look at months in the past and in the future
    Given I have a monthly transaction "Monthly Condo fees" of 20,00 starting 2026-11-05
    Then I can look at November 2026 and see it
    And I can look at November 2027 and see it
    And I see nothing for October 2026

  Scenario: Entries on the same day are listed by description
    Given I have these transactions on 2026-11-05:
      | Description |
      | Gym         |
      | condo       |
    When I look at November 2026
    Then "condo" is listed before "Gym" on 2026-11-05

  Scenario: Only my own transactions are listed
    Given I have a transaction "Gym" on 2026-11-05
    And another person has a transaction "Rent" on 2026-11-05
    When I look at November 2026
    Then I see "Gym"
    And I do not see "Rent"
```

## Recurring transactions

```gherkin
Feature: Transactions that repeat with no end

  Scenario: A monthly transaction repeats every month
    When I record this transaction:
      | Date        | Description         | Category    | Account   | Amount | Type  | Recurrence |
      | 2026-11-05  | Monthly Condo fees  | Basic Costs | Santander | 20,00  | Debit | Monthly    |
    Then each month from November 2026 on shows "Monthly Condo fees" on the 5th
    And October 2026 shows nothing

  Scenario: An annual transaction appears once a year
    When I record this transaction:
      | Date        | Description              | Category    | Account   | Amount | Type  | Recurrence |
      | 2026-11-05  | Anually Vehicle Insurance | Basic Costs | Santander | 20,00  | Debit | Annually   |
    Then November 2026 shows it on 2026-11-05
    And December 2026 shows nothing
    And November 2027 shows it on 2027-11-05

  Scenario: A weekly transaction repeats every seven days
    When I record a weekly transaction "Cleaning" starting 2026-11-05
    Then November 2026 shows it on:
      | 2026-11-05 |
      | 2026-11-12 |
      | 2026-11-19 |
      | 2026-11-26 |
    And December 2026 shows it on:
      | 2026-12-03 |
      | 2026-12-10 |
      | 2026-12-17 |
      | 2026-12-24 |
      | 2026-12-31 |

  Scenario: A daily transaction appears every day
    When I record a daily transaction "Coffee" starting 2026-11-29
    Then November 2026 shows it on 2026-11-29 and 2026-11-30
    And December 2026 shows it on all 31 days

  Scenario Outline: A monthly transaction that starts on a day some months do not have
    Given I have a monthly transaction "Rent" starting <start>
    Then <month> shows it on <day>

    Examples:
      | start      | month         | day        |
      | 2026-01-31 | January 2026  | 2026-01-31 |
      | 2026-01-31 | February 2026 | 2026-02-28 |
      | 2026-01-31 | March 2026    | 2026-03-31 |
      | 2026-01-31 | April 2026    | 2026-04-30 |
      | 2028-01-31 | February 2028 | 2028-02-29 |

  Scenario Outline: An annual transaction that starts on 29 February
    Given I have an annual transaction "Club fee" starting 2024-02-29
    Then <month> shows it on <day>

    Examples:
      | month         | day        |
      | February 2025 | 2025-02-28 |
      | February 2026 | 2026-02-28 |
      | February 2028 | 2028-02-29 |
```

## Instalments

```gherkin
Feature: Purchases paid in instalments

  Scenario: A purchase that is part way through its instalments
    When I record this transaction:
      | Date        | Description | Category          | Account   | Amount | Type  | Instalment |
      | 2026-11-15  | New car     | House Maintenance | Santander | 100,00 | Debit | 97 of 504  |
    Then November 2026 shows "New car" on 2026-11-15 as instalment 97 of 504
    And December 2026 shows "New car" on 2026-12-15 as instalment 98 of 504
    And October 2026 shows nothing

  Scenario: Instalments stop after the last one
    Given I have recorded "New car" starting 2026-11-15 as instalment 97 of 504
    Then October 2060 shows "New car" on 2060-10-15 as instalment 504 of 504
    And November 2060 shows nothing

  Scenario: A purchase that has just started
    When I record "New sofa" on 2026-11-15 as instalment 1 of 10
    Then August 2027 shows "New sofa" on 2027-08-15 as instalment 10 of 10
    And September 2027 shows nothing

  Scenario: Instalments are never paid by themselves
    Given today is 2026-11-12
    And I have recorded "New car" starting 2026-01-15 as instalment 10 of 504
    When I look at November 2026
    Then "New car" on 2026-11-15 is instalment 20 of 504, still Forecast
    And the earlier instalments I never checked are still Forecast too
```

## Confirming that something was paid

```gherkin
Feature: Consolidating (checking) a transaction

  Background:
    Given I have a monthly transaction "Monthly Condo fees" of 20,00 starting 2026-11-05

  Scenario: I check an entry after comparing it with my account
    Given today is 2026-11-06
    When I consolidate "Monthly Condo fees" on 2026-11-05
    Then November 2026 shows "Monthly Condo fees" on 2026-11-05 as Consolidated
    And December 2026 shows "Monthly Condo fees" on 2026-12-05 as Forecast

  Scenario: Nothing is checked unless I check it
    Given today is 2027-03-01
    When I look at November 2026
    Then "Monthly Condo fees" on 2026-11-05 is still Forecast

  Scenario: What I really paid is different from the forecast
    When I consolidate "Monthly Condo fees" on 2026-12-05 with the amount 22,00
    Then November 2026 shows it with 20,00 as Forecast
    And December 2026 shows it with 22,00 as Consolidated
    And January 2027 shows it with 20,00 as Forecast

  Scenario: I checked the wrong entry
    Given I consolidated "Monthly Condo fees" on 2026-12-05 with the amount 22,00
    When I undo the consolidation of 2026-12-05
    Then December 2026 shows it with 20,00 as Forecast

  Scenario: I can check an entry before its day arrives
    Given today is 2026-11-01
    When I consolidate "Monthly Condo fees" on 2026-11-05
    Then November 2026 shows it as Consolidated
```

## Changing a transaction

```gherkin
Feature: Changing a transaction

  Background:
    Given I have a monthly transaction "Monthly Condo fees" of 20,00 starting 2026-11-05

  Scenario: A forecast change reaches the following months
    When I change "Monthly Condo fees" on 2026-12-05 to 25,00
    Then November 2026 shows 20,00
    And December 2026 shows 25,00
    And January 2027 shows 25,00

  Scenario: A change does not touch what I already paid
    Given I consolidated "Monthly Condo fees" on 2027-01-05 with 20,00
    When I change "Monthly Condo fees" on 2026-12-05 to 25,00
    Then January 2027 still shows 20,00 as Consolidated
    And February 2027 shows 25,00 as Forecast

  Scenario: Changing something I already paid changes only that one
    Given I consolidated "Monthly Condo fees" on 2026-11-05 with 20,00
    When I change "Monthly Condo fees" on 2026-11-05 to 21,00
    Then November 2026 shows 21,00 as Consolidated
    And December 2026 shows 20,00 as Forecast

  Scenario: A later change replaces an earlier plan for the future
    Given I changed "Monthly Condo fees" on 2027-01-05 to 30,00
    When I change "Monthly Condo fees" on 2026-12-05 to 25,00
    Then December 2026 shows 25,00
    And January 2027 shows 25,00

  Scenario: Changing the first occurrence changes the whole series
    When I change "Monthly Condo fees" on 2026-11-05 to 18,00
    Then November 2026 shows 18,00
    And every later month shows 18,00

  Scenario: Moving a transaction to another account or category
    When I change "Monthly Condo fees" on 2026-12-05 to use the account "Credit Card A" and the category "House Maintenance"
    Then November 2026 shows "Santander" and "Basic Costs"
    And December 2026 and the months after show "Credit Card A" and "House Maintenance"
```

## Stopping and deleting

```gherkin
Feature: Stopping and deleting transactions

  Scenario: Stopping a subscription keeps the past
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05
    And I consolidated "Gym" on 2026-11-05
    When I stop "Gym" from 2027-01-05
    Then November 2026 shows "Gym" as Consolidated
    And December 2026 shows "Gym" as Forecast
    And January 2027 shows nothing
    And every month after shows nothing

  Scenario: Stopping from the very first occurrence removes it completely
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05
    When I stop "Gym" from 2026-11-05
    Then no month shows "Gym"

  Scenario: Deleting a one-off removes it
    Given I have a one-off transaction "Market chair New office chair" on 2026-11-10
    When I delete it
    Then November 2026 shows nothing

  Scenario: Stopping instalments
    Given I have recorded "New car" starting 2026-11-15 as instalment 97 of 504
    When I stop "New car" from 2027-03-15
    Then February 2027 shows "New car" as instalment 100 of 504
    And March 2027 shows nothing

  Scenario: A mistake in the past can still be removed
    Given today is 2026-11-12
    And I have a one-off transaction "Typo" on 2026-10-05
    When I delete it
    Then October 2026 shows nothing
```

## When a category or an account goes away

```gherkin
Feature: Removing a category or an account that transactions use

  Scenario: Transactions stay when their category is deleted
    Given I have these transactions:
      | Date        | Description   | Category    | Account   | Amount |
      | 2026-11-05  | Monthly Condo fees | Basic Costs | Santander | 20,00 |
      | 2026-11-12  | Weekly shopping    | Super Market | Santander | 80,00 |
    When I delete the category "Basic Costs"
    Then November 2026 shows "Monthly Condo fees" with no category, for 20,00 on Santander
    And "Weekly shopping" still shows the category "Super Market"

  Scenario: Transactions stay when their account is deleted
    Given I have a monthly transaction "Gym" of 50,00 on the account "Credit Card A" starting 2026-11-05
    And I consolidated "Gym" on 2026-11-05
    When I delete the account "Credit Card A"
    Then every month still shows "Gym", with no account
    And November 2026 still shows it as Consolidated
```

## A month in my life

One story that puts the pieces together, using the owner's own examples.

```gherkin
Feature: November 2026 from start to finish

  Scenario: Setting up and living through the month
    Given today is 2026-11-01
    When I record these transactions:
      | Date        | Description                    | Category          | Account       | Amount  | Type    | Recurrence / Instalment |
      | 2026-11-01  | My Company - Monthly Income    | Receipt           | Santander     | 1000,00 | Receipt | Monthly                 |
      | 2026-11-05  | Monthly Condo fees             | Basic Costs       | Santander     | 20,00   | Debit   | Monthly                 |
      | 2026-11-05  | Anually Vehicle Insurance      | Basic Costs       | Santander     | 20,00   | Debit   | Annually                |
      | 2026-11-10  | Market chair New office chair  | House Maintenance | Credit Card A | 229,00  | Debit   |                         |
      | 2026-11-15  | New car                        | House Maintenance | Santander     | 100,00  | Debit   | 1 of 10                 |
    Then November 2026 shows these entries, in date order, all as Forecast:
      | Date        | Description                    | Amount  |
      | 2026-11-01  | My Company - Monthly Income    | 1000,00 |
      | 2026-11-05  | Anually Vehicle Insurance      | 20,00   |
      | 2026-11-05  | Monthly Condo fees             | 20,00   |
      | 2026-11-10  | Market chair New office chair  | 229,00  |
      | 2026-11-15  | New car                        | 100,00  |

    Given today is 2026-11-16
    And I compared my account and found all five paid, the insurance at 22,00
    When I consolidate all five entries, entering 22,00 for the insurance
    Then November 2026 shows all five as Consolidated
    And the insurance shows 22,00

    When I look at December 2026
    Then I see the income, the condo fees and the new car (instalment 2 of 10), all as Forecast
    And I do not see the vehicle insurance
    And I do not see the office chair
```
