#!/bin/bash
cd /Users/castrth/workspace/capital-care/modules/ledger
npm test -- src/category/__test__/category.create.test.ts src/category/__test__/category.uniqueness.test.ts src/category/__test__/category.list.test.ts src/category/__test__/category.update.test.ts src/category/__test__/category.delete.test.ts --reporter=verbose 2>&1
