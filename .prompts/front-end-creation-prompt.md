# Front-End Layer

Using **tlc-spec-lean**, let's start implementing the web pages for our API. This application should consume the **Category**, **Account**, and **Transactions** APIs. Below are the specifications for the initial page.

## Workflow (`tlc-spec-lean`)
Use `tlc-spec-lean` to plan and implement this feature. Note that we do not have a separate PRD or feature document for this task, as it represents the web layer for the APIs we created previously.

## Page Definitions
The layout **MUST** follow the design specifications located in `/docs/tech/definitions/design.md`. Below is the functional description of the application to be built.

## Initial Page: Transactions

### Header & User Context
* Display the main site title.
* Include a small section showing the currently signed-in user. *(For now, hardcode the same user used in our API tests and display this user's info in the UI.)*

### Transactions List Header (Controls)
Directly below the header, include the top control bar for the transactions list with the following features:
* **Date Filter:** Provide a clear, user-friendly filter for selecting months and years, making it easy to navigate between different periods.
* **Quick-Add Transaction Form:** Include a compact form to quickly create one-off transactions. This form should also allow expanding or adding more details so the user can create any type of transaction (both one-off and recurring).

### Transactions List
Directly below the controls, display the transactions list with the following specifications:
* **Grouping Date:** Group transactions by date and formatted as `DD/MM/YYYY - Weekday name` (e.g., `16/11/2026 - Monday`).
* **Row Details:** Each transaction item must display:
  * **Description:** The transaction description.
  * **Account:** The associated account name.
  * **Category:** The assigned category name.
  * **Amount:** The transaction value (indicating credit or debit).
  * **Status Icons:** Visual icons indicating whether the transaction is **recurring** and whether it is **settled**.
* **Sorting:** Transactions must always be ordered chronologically by date.

* **Daily Running Balance:** At the end of each date group, display the current available balance after applying that day's transactions. *(Example: If the starting available balance is `1,000.00` and the first day's group has a debit of `100.35` and a credit of `500.01`, the running available balance shown after that group should be `1,399.66`.)*

### Transactions List Footer
At the bottom of the transactions list, include a summary footer with the following features:
* **Monthly Summary:** Display the aggregated totals for the selected month, including:
  * **Total Received (Credits)**
  * **Total Debits (Expenses)**
  * **Monthly Net Total** (Received minus Debits)
  * **Final Available Balance**
* **Navigation:** Provide an easy-to-access **"Back to top"** button or link so the user can quickly scroll back to the top of the page.

### Account and Category Visualization

#### Categories
* **Category List:** Display all available categories ordered alphabetically, with the first level of child categories (subcategories) expanded by default, if any exist.
* **Uncategorized Option:** Always display an **"Uncategorized"** item at the top of the list. Selecting this filters for transactions that do not have an assigned category.
* **Multi-Select Filtering:** Users can click on one or more categories to filter the transactions list accordingly.
* **Add Category:** Display a button to create a new category, which opens a creation form.
* **Edit and Delete:** Allow users to edit or delete any category, except for the default **"Uncategorized"** item.

#### Accounts
* **Account List & Behavior:** Accounts must follow the exact same behavior as categories (alphabetical order, an **"Unassigned"** option at the top if applicable, multi-select filtering, and add/edit/delete actions), except that accounts have a flat structure with no child/sub-accounts.

## Rules

- You should not create new APIs 
