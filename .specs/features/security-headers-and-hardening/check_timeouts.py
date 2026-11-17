"""Exit 0 only when every pipeline job declares the timeout-minutes the plan sets (AC 6)."""
import re
import sys

EXPECTED = {
    '.github/workflows/ci-cd.yml': {'test': 15, 'security': 10, 'build': 20, 'publish': 15},
    '.github/workflows/codeql.yml': {'analyze': 30},
}

bad = 0
for path, jobs in EXPECTED.items():
    text = open(path).read()
    declared = re.findall(r'^  ([a-z-]+):\n(?:    .*\n)*?    timeout-minutes: (\d+)\n', text, re.M)
    found = {name: int(value) for name, value in declared}
    all_jobs = re.findall(r'^  ([a-z-]+):\n    name:', text, re.M)
    for name, minutes in jobs.items():
        ok = found.get(name) == minutes
        print(f"{'ok' if ok else 'FAIL'} {path} {name}: expected {minutes}, found {found.get(name)}")
        bad += 0 if ok else 1
    extra = [j for j in all_jobs if j not in jobs]
    if extra:
        print(f'FAIL {path}: jobs with no expected limit: {extra}')
        bad += 1
sys.exit(1 if bad else 0)
