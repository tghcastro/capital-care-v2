"""Pipeline obligations of the security-headers-and-hardening feature. Exit 0 only when they hold.

  timeouts   every job declares the timeout-minutes the plan sets, and no job lacks one (AC 6)
  checkouts  every actions/checkout step sets persist-credentials: false (AC 10)
  docs       docs/tech/definitions/ci-cd.md lists the same limits and both overrides (AC 9)
"""
import re
import sys

EXPECTED = {
    '.github/workflows/ci-cd.yml': {'test': 15, 'security': 10, 'build': 20, 'publish': 15},
    '.github/workflows/codeql.yml': {'analyze': 30},
}
DOC = 'docs/tech/definitions/ci-cd.md'


def jobs_of(text):
    """Return {job key: block text} for every key directly under `jobs:`."""
    body = text.split('\njobs:\n', 1)[1]
    parts = re.split(r'^  ([A-Za-z0-9_-]+):[ \t]*$', body, flags=re.M)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}


def timeouts():
    bad = 0
    for path, expected in EXPECTED.items():
        jobs = jobs_of(open(path).read())
        for name, block in jobs.items():
            found = re.search(r'^    timeout-minutes: (\d+)\s*$', block, re.M)
            value = int(found.group(1)) if found else None
            want = expected.get(name)
            ok = want is not None and value == want
            print(f"{'ok' if ok else 'FAIL'} {path} {name}: expected {want}, found {value}")
            bad += 0 if ok else 1
        for name in expected:
            if name not in jobs:
                print(f'FAIL {path}: expected job {name} not found')
                bad += 1
    return bad


def checkouts():
    bad = 0
    for path in EXPECTED:
        text = open(path).read()
        steps = re.split(r'^      - ', text, flags=re.M)[1:]
        found = [s for s in steps if s.lstrip().startswith('uses: actions/checkout@')]
        for step in found:
            ok = re.search(r'^          persist-credentials: false\s*$', step, re.M) is not None
            print(f"{'ok' if ok else 'FAIL'} {path}: checkout step persist-credentials false = {ok}")
            bad += 0 if ok else 1
        if not found:
            print(f'FAIL {path}: no actions/checkout step found')
            bad += 1
    return bad


def docs():
    text = open(DOC).read()
    bad = 0
    for path, expected in EXPECTED.items():
        workflow = path.rsplit('/', 1)[1]
        for name, minutes in expected.items():
            row = re.search(rf'^\|\s*{name}\s*\|\s*{re.escape(workflow)}\s*\|\s*(\d+)\s*\|', text, re.M | re.I)
            ok = row is not None and int(row.group(1)) == minutes
            print(f"{'ok' if ok else 'FAIL'} doc row {workflow} {name}: expected {minutes}, found {row.group(1) if row else None}")
            bad += 0 if ok else 1
    for needle in ('@esbuild-kit/core-utils>esbuild', 'minimatch@>=10.0.0 <11.0.1'):
        ok = needle in text
        print(f"{'ok' if ok else 'FAIL'} doc mentions override {needle}")
        bad += 0 if ok else 1
    return bad


MODES = {'timeouts': timeouts, 'checkouts': checkouts, 'docs': docs}

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode not in MODES:
        sys.exit(f'usage: check_pipeline.py {"|".join(MODES)}')
    sys.exit(1 if MODES[mode]() else 0)
