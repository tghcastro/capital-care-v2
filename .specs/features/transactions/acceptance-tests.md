# Transactions - Acceptance Tests

Behaviour only, in the owner's words. These scenarios explain how Transactions work; they do not check field limits, empty values or error codes (the checks cover those). Amounts are written with a decimal comma. Where the day matters, the scenario says what day it is. The names below (categories, accounts, descriptions) are sample data for reading; the system does not depend on them.

**Related:** [plan.md](plan.md) - [`.prd/transactions.md`](../../../.prd/transactions.md)

```gherkin
Feature: Transactions
  A transaction is money I spent or received, or a forecast of money I will
  pay or receive. I record it once and the system shows it in the right months.

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
```

## Recording a transaction

```gherkin
Feature: Recording a one-off transaction

  Scenario: A purchase appears in the month it was made
    When I record this transaction:
      | Date       | Description      | Category | Account     | Amount | Type  |
      | 2026-11-10 | New office chair | Shopping | Credit Card | 229,00 | Debit |
    Then November 2026 shows:
      | Date       | Description      | Category | Account     | Amount | Type  | Status   |
      | 2026-11-10 | New office chair | Shopping | Credit Card | 229,00 | Debit | Forecast |
    And October 2026 shows nothing
    And December 2026 shows nothing

  Scenario: Money received is recorded as a receipt
    When I record this transaction:
      | Date       | Description    | Category | Account          | Amount  | Type    |
      | 2026-11-01 | Salary - Acme  | Income   | Checking Account | 3000,00 | Receipt |
    Then November 2026 shows:
      | Date       | Description    | Category | Account          | Amount  | Type    | Status   |
      | 2026-11-01 | Salary - Acme  | Income   | Checking Account | 3000,00 | Receipt | Forecast |

  Scenario: A new transaction is always a forecast until I say it was paid
    Given today is 2026-11-12
    When I record this transaction:
      | Date       | Description | Category | Account          | Amount | Type  |
      | 2026-11-03 | Dentist     | Health   | Checking Account | 120,00 | Debit |
    Then November 2026 shows "Dentist" on 2026-11-03 as Forecast
```

## Seeing a month

```gherkin
Feature: Seeing a month

  Scenario: A month shows every entry, paid or not, from the first day to the last
    Given today is 2026-11-20
    And I have these transactions:
      | Date       | Description      | Amount  | Status       |
      | 2026-11-01 | Salary - Acme    | 3000,00 | Settled |
      | 2026-11-05 | Condo fees       | 450,00  | Settled |
      | 2026-11-10 | New office chair | 229,00  | Forecast     |
      | 2026-11-28 | Gym              | 50,00   | Forecast     |
    When I look at November 2026
    Then I see all four entries, in date order
    And the entry on 2026-11-10 is still listed as Forecast, even though that day has passed

  Scenario: I can look at months in the past and in the future
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05
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
      | Date       | Description | Category | Account          | Amount | Type  | Recurrence |
      | 2026-11-05 | Condo fees  | Housing  | Checking Account | 450,00 | Debit | Monthly    |
    Then each month from November 2026 on shows "Condo fees" on the 5th
    And October 2026 shows nothing
    And no earlier month shows it either

  Scenario: An annual transaction appears once a year
    When I record this transaction:
      | Date       | Description       | Category  | Account          | Amount  | Type  | Recurrence |
      | 2026-11-05 | Vehicle insurance | Transport | Checking Account | 1200,00 | Debit | Annually   |
    Then November 2026 shows it on 2026-11-05
    And December 2026 shows nothing
    And November 2027 shows it on 2027-11-05
    And November 2025 and every earlier month show nothing

  Scenario: A weekly transaction repeats every seven days
    When I record a weekly transaction "Cleaning service" starting 2026-11-05
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
    And the days before 2026-11-05, including 2026-10-29, show nothing

  Scenario: A daily transaction appears every day
    When I record a daily transaction "Coffee" starting 2026-11-29
    Then November 2026 shows it on 2026-11-29 and 2026-11-30
    And December 2026 shows it on all 31 days
    And 2026-11-28 and every earlier day show nothing

  Scenario: A recurring transaction does not appear before its start, even in the same month
    When I record a monthly transaction "Gym" starting 2026-11-20
    Then November 2026 shows it only on 2026-11-20
    And the days of November before the 20th show nothing

  Scenario Outline: A monthly transaction that starts on a day some months do not have
    Given I have a monthly transaction "Internet bill" starting <start>
    Then <month> shows it on <day>

    Examples:
      | start      | month         | day        |
      | 2026-01-31 | January 2026  | 2026-01-31 |
      | 2026-01-31 | February 2026 | 2026-02-28 |
      | 2026-01-31 | March 2026    | 2026-03-31 |
      | 2026-01-31 | April 2026    | 2026-04-30 |
      | 2028-01-31 | February 2028 | 2028-02-29 |

  Scenario Outline: An annual transaction that starts on 29 February
    Given I have an annual transaction "Tennis club fee" starting 2024-02-29
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
      | Date       | Description | Category  | Account          | Amount | Type  | Instalment |
      | 2026-11-15 | Car loan    | Transport | Checking Account | 650,00 | Debit | 17 of 48   |
    Then November 2026 shows "Car loan" on 2026-11-15 as instalment 17 of 48
    And December 2026 shows "Car loan" on 2026-12-15 as instalment 18 of 48
    And October 2026 shows nothing
    And no earlier month shows it either

  Scenario: Instalments stop after the last one
    Given I have recorded "Car loan" starting 2026-11-15 as instalment 17 of 48
    Then June 2029 shows "Car loan" on 2029-06-15 as instalment 48 of 48
    And July 2029 shows nothing

  Scenario: A purchase that has just started
    When I record "Laptop" on 2026-11-15 as instalment 1 of 10
    Then August 2027 shows "Laptop" on 2027-08-15 as instalment 10 of 10
    And September 2027 shows nothing

  Scenario: Instalments are never paid by themselves
    Given today is 2026-11-12
    And I have recorded "Car loan" starting 2026-01-15 as instalment 8 of 48
    When I look at November 2026
    Then "Car loan" on 2026-11-15 is instalment 18 of 48, still Forecast
    And the earlier instalments I never checked are still Forecast too
```

## Confirming that something was paid

```gherkin
Feature: Settling (checking) a transaction

  Background:
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05

  Scenario: I check an entry after comparing it with my account
    Given today is 2026-11-06
    When I settle "Condo fees" on 2026-11-05
    Then November 2026 shows "Condo fees" on 2026-11-05 as Settled
    And December 2026 shows "Condo fees" on 2026-12-05 as Forecast

  Scenario: Nothing is checked unless I check it
    Given today is 2027-03-01
    When I look at November 2026
    Then "Condo fees" on 2026-11-05 is still Forecast

  Scenario: What I really paid is different from the forecast
    When I settle "Condo fees" on 2026-12-05 with the amount 462,50
    Then November 2026 shows it with 450,00 as Forecast
    And December 2026 shows it with 462,50 as Settled
    And January 2027 shows it with 450,00 as Forecast

  Scenario: I checked the wrong entry
    Given I settled "Condo fees" on 2026-12-05 with the amount 462,50
    When I undo the settlement of 2026-12-05
    Then December 2026 shows it with 450,00 as Forecast

  Scenario: I can check an entry before its day arrives
    Given today is 2026-11-01
    When I settle "Condo fees" on 2026-11-05
    Then November 2026 shows it as Settled
```

## Changing a transaction

```gherkin
Feature: Changing a transaction

  Background:
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05

  Scenario: A forecast change reaches the following months
    When I change "Condo fees" on 2026-12-05 to 480,00
    Then November 2026 shows 450,00
    And December 2026 shows 480,00
    And January 2027 shows 480,00

  Scenario: A change does not touch what I already paid
    Given I settled "Condo fees" on 2027-01-05 with 450,00
    When I change "Condo fees" on 2026-12-05 to 480,00
    Then January 2027 still shows 450,00 as Settled
    And February 2027 shows 480,00 as Forecast

  Scenario: Changing something I already paid changes only that one
    Given I settled "Condo fees" on 2026-11-05 with 450,00
    When I change "Condo fees" on 2026-11-05 to 455,00
    Then November 2026 shows 455,00 as Settled
    And December 2026 shows 450,00 as Forecast

  Scenario: A later change replaces an earlier plan for the future
    Given I changed "Condo fees" on 2027-01-05 to 500,00
    When I change "Condo fees" on 2026-12-05 to 480,00
    Then December 2026 shows 480,00
    And January 2027 shows 480,00

  Scenario: Changing the first occurrence changes the whole series
    When I change "Condo fees" on 2026-11-05 to 430,00
    Then November 2026 shows 430,00
    And every later month shows 430,00

  Scenario: Moving a transaction to another account or category
    When I change "Condo fees" on 2026-12-05 to use the account "Credit Card" and the category "Shopping"
    Then November 2026 shows "Checking Account" and "Housing"
    And December 2026 and the months after show "Credit Card" and "Shopping"
```

## Stopping and deleting

```gherkin
Feature: Stopping and deleting transactions

  Scenario: Stopping a subscription keeps the past
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05
    And I settled "Gym" on 2026-11-05
    When I stop "Gym" from 2027-01-05
    Then November 2026 shows "Gym" as Settled
    And December 2026 shows "Gym" as Forecast
    And January 2027 shows nothing
    And every month after shows nothing

  Scenario: Stopping from the very first occurrence removes it completely
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05
    When I stop "Gym" from 2026-11-05
    Then no month shows "Gym"

  Scenario: Deleting a one-off removes it
    Given I have a one-off transaction "New office chair" on 2026-11-10
    When I delete it
    Then November 2026 shows nothing

  Scenario: Stopping instalments
    Given I have recorded "Car loan" starting 2026-11-15 as instalment 17 of 48
    When I stop "Car loan" from 2027-03-15
    Then February 2027 shows "Car loan" as instalment 20 of 48
    And March 2027 shows nothing

  Scenario: A mistake in the past can still be removed
    Given today is 2026-11-12
    And I have a one-off transaction "Entered by mistake" on 2026-10-05
    When I delete it
    Then October 2026 shows nothing
```

## When a category or an account goes away

```gherkin
Feature: Removing a category or an account that transactions use

  Scenario: Transactions stay when their category is deleted
    Given I have these transactions:
      | Date       | Description     | Category  | Account          | Amount |
      | 2026-11-05 | Condo fees      | Housing   | Checking Account | 450,00 |
      | 2026-11-12 | Weekly shopping | Groceries | Checking Account | 80,00  |
    When I delete the category "Housing"
    Then November 2026 shows "Condo fees" with no category, for 450,00 on Checking Account
    And "Weekly shopping" still shows the category "Groceries"

  Scenario: Transactions stay when their account is deleted
    Given I have a monthly transaction "Gym" of 50,00 on the account "Credit Card" starting 2026-11-05
    And I settled "Gym" on 2026-11-05
    When I delete the account "Credit Card"
    Then every month still shows "Gym", with no account
    And November 2026 still shows it as Settled
```

## A month in my life

One story that puts the pieces together.

```gherkin
Feature: November 2026 from start to finish

  Scenario: Setting up and living through the month
    Given today is 2026-11-01
    When I record these transactions:
      | Date       | Description       | Category  | Account          | Amount  | Type    | Recurrence / Instalment |
      | 2026-11-01 | Salary - Acme     | Income    | Checking Account | 3000,00 | Receipt | Monthly                 |
      | 2026-11-05 | Condo fees        | Housing   | Checking Account | 450,00  | Debit   | Monthly                 |
      | 2026-11-05 | Vehicle insurance | Transport | Checking Account | 1200,00 | Debit   | Annually                |
      | 2026-11-10 | New office chair  | Shopping  | Credit Card      | 229,00  | Debit   |                         |
      | 2026-11-15 | Laptop            | Shopping  | Credit Card      | 180,00  | Debit   | 1 of 10                 |
    Then November 2026 shows these entries, in date order, all as Forecast:
      | Date       | Description       | Amount  |
      | 2026-11-01 | Salary - Acme     | 3000,00 |
      | 2026-11-05 | Condo fees        | 450,00  |
      | 2026-11-05 | Vehicle insurance | 1200,00 |
      | 2026-11-10 | New office chair  | 229,00  |
      | 2026-11-15 | Laptop            | 180,00  |

    Given today is 2026-11-16
    And I compared my accounts and found all five paid, the insurance at 1235,00
    When I settle all five entries, entering 1235,00 for the insurance
    Then November 2026 shows all five as Settled
    And the insurance shows 1235,00

    When I look at December 2026
    Then I see the salary, the condo fees and the laptop (instalment 2 of 10), all as Forecast
    And I do not see the vehicle insurance
    And I do not see the office chair
```
