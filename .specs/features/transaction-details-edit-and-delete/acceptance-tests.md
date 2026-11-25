# Transaction Details, Edit and Delete - Acceptance Tests

Behaviour only, in the owner's words. These scenarios explain how opening, changing, deleting and ending transactions work in the web page, and how series totals and notes behave. They do not check field limits, empty values or error codes (the checks cover those, including the 2000-character limit on notes). Amounts are written with a decimal comma. Where the day matters, the scenario says what day it is. The names below (categories, accounts, descriptions) are sample data for reading; the system does not depend on them.

Totals of an occurrence, for instalment number n, series amount a and last instalment N of that series:

- Up to this instalment = n × a
- Total = N × a
- Left = Total − Up to this instalment

**Related:** [`.prd/transaction-details-edit-and-delete.md`](../../../.prd/transaction-details-edit-and-delete.md) - [Transactions acceptance tests](../transactions/acceptance-tests.md)

```gherkin
Feature: Transaction details, edit and delete
  I open a transaction to see all of it, fix mistakes, remove what should not
  be there, end a series, see how much is left on a purchase in instalments,
  and keep notes next to each entry.

  Background:
    Given I have these categories:
      | Category  |
      | Housing   |
      | Shopping  |
      | Health    |
      | Transport |
    And I have these accounts:
      | Account          |
      | Checking Account |
      | Credit Card      |
```

## Seeing the details

```gherkin
Feature: Seeing the details of a transaction

  Scenario: I open a row to see everything about a transaction
    Given I have recorded "Car loan" of 650,00 on 2026-11-15 as instalment 17 of 48, with:
      | Type  | Category  | Account          | Notes                     |
      | Debit | Transport | Checking Account | Contract 4471, Acme Bank. |
    When I open the details of "Car loan" on 2026-11-15
    Then I see:
      | Date       | Description | Amount | Type  | Account          | Category  | Status   | Instalment | Notes                     |
      | 2026-11-15 | Car loan    | 650,00 | Debit | Checking Account | Transport | Forecast | 17 of 48   | Contract 4471, Acme Bank. |
    And I see its totals

  Scenario: I close the details again
    Given I have a one-off transaction "Dentist" on 2026-11-20
    And I opened the details of "Dentist"
    When I close them
    Then I see only the row of "Dentist"

  Scenario: A recurring transaction shows how it repeats
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05
    When I open the details of "Condo fees" on 2026-12-05
    Then I see that it repeats Monthly

  Scenario: From the details I can start editing
    Given I have a one-off transaction "Dentist" on 2026-11-20
    When I open the details of "Dentist"
    And I choose to edit it
    Then I see "Dentist" ready to change, with its current values
```

## Changing a transaction

```gherkin
Feature: Changing a transaction

  Scenario: Fixing a mistake in a one-off that is not paid yet
    Given I have a one-off transaction "Dentst" of 120,00 on 2026-11-20 on the account "Credit Card"
    When I change it to "Dentist", 130,00, on the account "Checking Account"
    Then November 2026 shows "Dentist" on 2026-11-20 with 130,00 on "Checking Account", as Forecast

  Scenario: Fixing a mistake in something I already paid keeps it paid
    Given I have a one-off transaction "New office chair" of 229,00 on 2026-11-10
    And I settled it
    When I change its category to "Health"
    Then November 2026 shows "New office chair" with the category "Health", still Settled

  Scenario: I am told what a change will reach before I save it
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05
    And I settled "Condo fees" on 2026-11-05
    And I have a one-off transaction "Dentist" on 2026-11-20
    Then before saving I am told the change applies to:
      | What I change              | Applies to                    |
      | "Condo fees" on 2026-12-05 | this one and every later one  |
      | "Condo fees" on 2026-11-05 | only this one                 |
      | "Dentist"                  | only this one                 |

  Scenario: Changing a future instalment from the month it changes
    Given today is 2026-11-25
    And I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100
    When I change "Solar panels" on 2027-06-15 (instalment 17) to 25,00
    Then instalments 10 to 16, from 2026-11-15 to 2027-05-15, still show 20,00
    And instalments 17 to 100, from 2027-06-15 to 2034-05-15, show 25,00
    And instalments 10 to 16 are now one series that ends at instalment 16
    And instalments 17 to 100 are a new series

  Scenario: Changing something paid that was part of a series changes only that one
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05
    And I settled "Gym" on 2026-12-05
    When I change "Gym" on 2026-12-05 to 55,00
    Then December 2026 shows "Gym" with 55,00 as Settled
    And November 2026 and January 2027 show "Gym" with 50,00 as Forecast
```

## Settling splits a series

```gherkin
Feature: What settling does to a series

  Background:
    Given I recorded "Sofa" of 300,00 on 2027-01-10 as instalment 1 of 12
    And today is 2027-07-01
    And I settled instalments 1 to 6, from January to June 2027

  Scenario: What I already paid leaves the series
    When I open the details of "Sofa" on 2027-03-10
    Then I see it as Settled, instalment 3 of 12
    And I see no totals
    And the series of "Sofa" now runs from instalment 7 to instalment 12

  Scenario: Paying one instalment early splits the series around it
    When I settle "Sofa" on 2027-10-10 (instalment 10)
    Then instalment 10 is Settled and shows no totals
    And instalments 7 to 9 are one series
    And instalments 11 to 12 are another series

  Scenario: Undoing the settlement does not put the series back together
    Given I settled "Sofa" on 2027-10-10 (instalment 10)
    When I undo the settlement of 2027-10-10
    Then October 2027 shows "Sofa" as Forecast, on its own
    And it shows no totals
    And instalments 7 to 9 and instalments 11 to 12 are still two separate series

  Scenario: Settling is always my choice
    Given today is 2027-12-31
    When I look at September 2027
    Then "Sofa" on 2027-09-10 is still Forecast and part of its series
```

## Deleting and ending

```gherkin
Feature: Deleting a one-off and ending a series

  Scenario: Deleting a one-off asks me first
    Given I have a one-off transaction "Entered by mistake" on 2026-11-10
    When I delete it
    Then I am asked to confirm
    When I confirm
    Then November 2026 shows nothing on 2026-11-10

  Scenario: I change my mind about a delete
    Given I have a one-off transaction "Dentist" on 2026-11-20
    When I delete it
    And I cancel
    Then November 2026 still shows "Dentist" on 2026-11-20

  Scenario: Something I already paid can be deleted too
    Given I have a one-off transaction "New office chair" on 2026-11-10
    And I settled it
    When I delete it and confirm
    Then November 2026 shows nothing on 2026-11-10

  Scenario: Ending a series from a chosen instalment
    Given I recorded "Sofa" of 300,00 on 2027-01-10 as instalment 1 of 12
    And today is 2027-07-01
    And I settled instalments 1 to 6
    When I end "Sofa" from 2027-09-10 (instalment 9) and confirm
    Then July and August 2027 show "Sofa" as instalments 7 and 8, Forecast
    And September to December 2027 show nothing
    And January to June 2027 still show "Sofa" as Settled

  Scenario: Ending a series does not remove what I already paid ahead
    Given I recorded "Sofa" of 300,00 on 2027-01-10 as instalment 1 of 12
    And today is 2027-07-01
    And I settled "Sofa" on 2027-10-10 (instalment 10)
    When I end "Sofa" from 2027-09-10 (instalment 9) and confirm
    Then September, November and December 2027 show nothing
    And October 2027 still shows "Sofa" as Settled

  Scenario: Ending a series asks me first
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05
    When I end "Gym" from 2027-01-05
    And I cancel
    Then January 2027 still shows "Gym"
```

## Series totals

```gherkin
Feature: How much is left on a series

  Scenario Outline: The totals follow the instalment I am looking at
    Given I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100
    When I open the details of "Solar panels" on <date>
    Then I see Up to this instalment <up to>, Total <total> and Left <left>

    Examples:
      | date       | instalment | up to   | total   | left    |
      | 2026-11-15 | 10         | 200,00  | 2000,00 | 1800,00 |
      | 2027-06-15 | 17         | 340,00  | 2000,00 | 1660,00 |
      | 2034-05-15 | 100        | 2000,00 | 2000,00 | 0,00    |

  Scenario: A series entered part way counts the instalments before it
    Given I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100
    When I open the details of "Solar panels" on 2026-11-15
    Then the Total is 2000,00, the value of all 100 instalments

  Scenario: Settling does not change the totals of what is still in the series
    Given I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100
    And I settled instalments 10 to 16
    When I open the details of "Solar panels" on 2027-06-15
    Then I see Up to this instalment 340,00, Total 2000,00 and Left 1660,00

  Scenario Outline: After a change, each part of the series has its own totals
    Given I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100
    And I changed "Solar panels" on 2027-06-15 (instalment 17) to 25,00
    When I open the details of "Solar panels" on <date>
    Then I see Up to this instalment <up to>, Total <total> and Left <left>

    Examples:
      | date       | instalment | up to   | total   | left    |
      | 2026-12-15 | 11         | 220,00  | 320,00  | 100,00  |
      | 2027-05-15 | 16         | 320,00  | 320,00  | 0,00    |
      | 2027-06-15 | 17         | 425,00  | 2500,00 | 2075,00 |
      | 2034-05-15 | 100        | 2500,00 | 2500,00 | 0,00    |

  Scenario Outline: After paying one early, each part of the series has its own totals
    Given I recorded "Sofa" of 300,00 on 2027-01-10 as instalment 1 of 12
    And I settled instalments 1 to 6
    And I settled "Sofa" on 2027-10-10 (instalment 10)
    When I open the details of "Sofa" on <date>
    Then I see <totals>

    Examples:
      | date       | instalment | totals                                                       |
      | 2027-07-10 | 7          | Up to this instalment 2100,00, Total 2700,00 and Left 600,00 |
      | 2027-10-10 | 10         | no totals                                                    |
      | 2027-11-10 | 11         | Up to this instalment 3300,00, Total 3600,00 and Left 300,00 |

  Scenario: A series with no end has no totals
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05
    When I open the details of "Condo fees" on 2026-12-05
    Then I see no totals

  Scenario: A one-off has no totals
    Given I have a one-off transaction "Dentist" on 2026-11-20
    When I open the details of "Dentist"
    Then I see no totals
```

## Notes

```gherkin
Feature: Notes on a transaction

  Scenario: Notes are optional
    When I record a one-off transaction "Dentist" on 2026-11-20 without notes
    Then the details of "Dentist" show no notes

  Scenario: Notes can take several lines
    When I record a one-off transaction "New office chair" on 2026-11-10 with the notes:
      """
      Bought at the outlet store.
      Warranty until 2028-11-10.
      Receipt in the blue folder.
      """
    Then the details of "New office chair" show the three lines, as I wrote them

  Scenario: Every occurrence of a series shows the same notes
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05 with the notes "Unit 302"
    When I open the details of "Condo fees" on 2027-04-05
    Then I see the notes "Unit 302"

  Scenario: Changing the notes on one occurrence changes them on all of the series
    Given I have a monthly transaction "Condo fees" of 450,00 starting 2026-11-05 with the notes "Unit 302"
    When I change the notes of "Condo fees" on 2027-01-05 to "Unit 302, parking space 14"
    Then "Condo fees" on 2026-11-05, 2026-12-05 and 2027-04-05 all show "Unit 302, parking space 14"
    And "Condo fees" is still one series

  Scenario: After a split, each part keeps its own copy of the notes
    Given I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100 with the notes "Installer: SunCo"
    And I changed "Solar panels" on 2027-06-15 (instalment 17) to 25,00
    When I change the notes of "Solar panels" on 2027-06-15 to "Installer: SunCo. New rate from June."
    Then instalments 17 to 100 show "Installer: SunCo. New rate from June."
    And instalments 10 to 16 still show "Installer: SunCo"

  Scenario: Something I paid keeps its own copy of the notes
    Given I have a monthly transaction "Gym" of 50,00 starting 2026-11-05 with the notes "Plan: basic"
    And I settled "Gym" on 2026-11-05
    When I change the notes of "Gym" on 2026-12-05 to "Plan: premium"
    Then "Gym" on 2026-11-05 still shows "Plan: basic"
    And "Gym" on 2026-12-05 and 2027-01-05 show "Plan: premium"

  Scenario: Moving the date of an instalment keeps its notes and totals
    Given I have recorded "Solar panels" of 20,00 on 2026-11-15 as instalment 10 of 100 with the notes "Installer: SunCo"
    When I move "Solar panels" on 2027-06-15 (instalment 17) to 2027-06-20
    Then June 2027 shows "Solar panels" on 2027-06-20 as instalment 17 of 100
    And its details show the notes "Installer: SunCo"
    And its details show Up to this instalment 340,00, Total 2000,00 and Left 1660,00
    And instalments 18 to 100 are on the 20th of their months
    And instalment 11, on 2026-12-15, now shows Total 320,00 and Left 100,00
```

## A purchase from start to finish

One story that puts the pieces together.

```gherkin
Feature: A sofa paid in 12 instalments

  Scenario: Living with an instalment purchase through the year
    Given today is 2027-01-10
    When I record "Sofa" of 300,00 on 2027-01-10 as instalment 1 of 12, with the notes "Store: HomeCo, order 8812"
    Then the details of "Sofa" on 2027-01-10 show Up to this instalment 300,00, Total 3600,00 and Left 3300,00
    And every instalment shows the notes "Store: HomeCo, order 8812"

    Given today is 2027-07-01
    And I settled instalments 1 to 6 after checking my account each month
    When I open the details of "Sofa" on 2027-07-10
    Then I see Up to this instalment 2100,00, Total 3600,00 and Left 1500,00
    And the settled instalments show no totals

    When I settle "Sofa" on 2027-10-10 early, because I paid it ahead
    Then the details of "Sofa" on 2027-07-10 show Total 2700,00 and Left 600,00
    And the details of "Sofa" on 2027-11-10 show Total 3600,00 and Left 300,00

    When I end "Sofa" from 2027-12-10 (instalment 12) and confirm, because the store forgave the last one
    Then December 2027 shows nothing
    And October 2027 still shows "Sofa" as Settled
    And November 2027 shows "Sofa" as instalment 11 of 12, Forecast
```
