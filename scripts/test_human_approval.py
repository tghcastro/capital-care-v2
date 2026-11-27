"""Tests for human_approval.py.

Each test builds a throwaway git repository with a base commit on `main` and a PR branch on top.
Run: python3 -m unittest discover -s scripts -p 'test_*.py' -v
"""

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import human_approval as ha  # noqa: E402

CONFIG = {
    "label": "owner-approved",
    "paths": [
        {"glob": "docs/tech/**", "reason": "Tech definitions"},
        {"glob": "**/AGENTS.md", "reason": "Agent instructions"},
    ],
}

PKG = {"name": "x", "packageManager": "pnpm@1.0.0", "dependencies": {"a": "^1.0.0"}, "devDependencies": {"b": "^1.0.0"}}

VITEST = """export default {
  test: { coverage: { thresholds: {
    statements: 85, branches: 80, functions: 85, lines: 85,
    'src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
  } } },
};
"""


def run(cwd, *args):
    subprocess.run(args, cwd=cwd, check=True, capture_output=True)


class Repo:
    def __init__(self, files):
        self.root = tempfile.mkdtemp()
        run(self.root, "git", "init", "-q", "-b", "main")
        run(self.root, "git", "config", "user.email", "t@t")
        run(self.root, "git", "config", "user.name", "t")
        files = {".github/human-approval.json": json.dumps(CONFIG), "README.md": "x\n", **files}
        self.commit(files, "base")
        self.base = self.rev()
        run(self.root, "git", "checkout", "-q", "-b", "pr")

    def write(self, files):
        for path, text in files.items():
            full = os.path.join(self.root, path)
            if text is None:
                os.remove(full)
                continue
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as f:
                f.write(text)

    def commit(self, files, msg="change"):
        self.write(files)
        run(self.root, "git", "add", "-A")
        run(self.root, "git", "commit", "-q", "-m", msg)
        return self.rev()

    def rev(self):
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=self.root, capture_output=True, text=True).stdout.strip()

    def gate(self, labels="", event="opened"):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = ha.main(["--base", self.base, "--head", self.rev(), "--labels", labels, "--event", event, "--root", self.root])
        return code, out.getvalue()

    def rules(self):
        return [t[0] for t in ha.evaluate(self.root, self.base, self.rev())[1]]

    def close(self):
        shutil.rmtree(self.root)


class Base(unittest.TestCase):
    files = {}

    def setUp(self):
        self.repo = Repo(dict(self.files))
        os.environ.pop("GITHUB_OUTPUT", None)
        os.environ.pop("GITHUB_STEP_SUMMARY", None)

    def tearDown(self):
        self.repo.close()


class TestGlob(unittest.TestCase):
    def test_globs(self):
        self.assertTrue(ha.glob_to_re("docs/tech/**").match("docs/tech/definitions/git.md"))
        self.assertTrue(ha.glob_to_re("**/AGENTS.md").match("AGENTS.md"))
        self.assertTrue(ha.glob_to_re("**/AGENTS.md").match("docs/tech/AGENTS.md"))
        self.assertFalse(ha.glob_to_re("**/AGENTS.md").match("docs/NOT_AGENTS.md"))
        self.assertFalse(ha.glob_to_re("docs/*.md").match("docs/a/b.md"))
        self.assertFalse(ha.glob_to_re(".nvmrc").match("x.nvmrc"))


class TestVerdict(Base):
    def test_unprotected_change_passes(self):
        self.repo.commit({"src/a.ts": "export const a = 1;\n"})
        code, out = self.repo.gate()
        self.assertEqual(code, 0, out)
        self.assertIn("PASS", out)

    def test_protected_path_fails_without_label(self):
        self.repo.commit({"docs/tech/definitions/git.md": "new rule\n"})
        code, out = self.repo.gate()
        self.assertEqual(code, 1)
        self.assertIn("waiting for the owner", out)

    def test_label_approves(self):
        self.repo.commit({"docs/tech/definitions/git.md": "new rule\n"})
        self.assertEqual(self.repo.gate(labels="foo,owner-approved")[0], 0)

    def test_label_does_not_count_on_synchronize(self):
        self.repo.commit({"AGENTS.md": "changed\n"})
        out_file = tempfile.mktemp()
        os.environ["GITHUB_OUTPUT"] = out_file
        try:
            code, _ = self.repo.gate(labels="owner-approved", event="synchronize")
            with open(out_file, encoding="utf-8") as f:
                outputs = f.read()
        finally:
            os.environ.pop("GITHUB_OUTPUT")
            os.remove(out_file)
        self.assertEqual(code, 1)
        self.assertIn("gated=true", outputs)
        self.assertIn("remove_label=true", outputs)

    def test_summary_is_written(self):
        self.repo.commit({"AGENTS.md": "a | b\n"})
        summary = tempfile.mktemp()
        os.environ["GITHUB_STEP_SUMMARY"] = summary
        try:
            self.repo.gate()
            with open(summary, encoding="utf-8") as f:
                text = f.read()
        finally:
            os.environ.pop("GITHUB_STEP_SUMMARY")
            os.remove(summary)
        self.assertIn("| path | Agent instructions | `AGENTS.md` |", text)
        self.assertIn("owner-approved", text)

    def test_rules_come_from_the_base_commit(self):
        # The PR empties the rules file; the base rules still gate the PR's own change.
        self.repo.commit({".github/human-approval.json": json.dumps({"paths": []}), "AGENTS.md": "changed\n"})
        self.assertIn("path", self.repo.rules())

    def test_deleted_protected_file_is_gated(self):
        self.repo.write({"docs/tech/a.md": "x\n"})
        run(self.repo.root, "git", "checkout", "-q", "main")
        self.repo.commit({"docs/tech/a.md": "x\n"}, "add on main")
        self.repo.base = self.repo.rev()
        run(self.repo.root, "git", "checkout", "-q", "-B", "pr")
        self.repo.commit({"docs/tech/a.md": None})
        self.assertIn("path", self.repo.rules())


class TestDependencies(Base):
    files = {"package.json": json.dumps(PKG), "apps/api/package.json": json.dumps(PKG)}

    def pkg(self, **changes):
        data = json.loads(json.dumps(PKG))
        for key, value in changes.items():
            data[key] = value
        return json.dumps(data)

    def test_version_bump_passes(self):
        self.repo.commit({"package.json": self.pkg(dependencies={"a": "^2.0.0"})})
        self.assertEqual(self.repo.rules(), [])

    def test_new_runtime_dependency_is_gated(self):
        self.repo.commit({"apps/api/package.json": self.pkg(dependencies={"a": "^1.0.0", "pino": "^9"})})
        self.assertEqual(self.repo.rules(), ["new-dependency"])

    def test_new_dev_dependency_is_gated(self):
        self.repo.commit({"package.json": self.pkg(devDependencies={"b": "^1.0.0", "c": "^1"})})
        self.assertEqual(self.repo.rules(), ["new-dependency"])

    def test_moving_dev_to_runtime_is_gated(self):
        self.repo.commit({"package.json": self.pkg(dependencies={"a": "^1.0.0", "b": "^1.0.0"}, devDependencies={})})
        self.assertEqual(self.repo.rules(), ["new-dependency"])

    def test_new_package_json_is_gated(self):
        self.repo.commit({"packages/new/package.json": json.dumps({"dependencies": {"z": "1"}})})
        self.assertEqual(self.repo.rules(), ["new-dependency"])

    def test_package_manager_change_is_gated(self):
        self.repo.commit({"package.json": self.pkg(packageManager="pnpm@2.0.0")})
        self.assertEqual(self.repo.rules(), ["new-dependency"])

    def test_unparsable_package_json_is_gated(self):
        self.repo.commit({"package.json": "{ not json"})
        self.assertEqual(self.repo.rules(), ["new-dependency"])

    def test_removed_dependency_passes(self):
        self.repo.commit({"package.json": self.pkg(devDependencies={})})
        self.assertEqual(self.repo.rules(), [])


class TestOverrides(Base):
    files = {"pnpm-workspace.yaml": "minimumReleaseAge: 1\n\noverrides:\n  'a>b': ^1.0.0\n\npackages:\n  - apps/api\n"}

    def test_new_override_is_gated(self):
        self.repo.commit({"pnpm-workspace.yaml": "overrides:\n  'a>b': ^1.0.0\n  c: ^2\npackages:\n  - apps/api\n"})
        self.assertEqual(self.repo.rules(), ["pnpm-override"])

    def test_changed_override_is_gated(self):
        self.repo.commit({"pnpm-workspace.yaml": "overrides:\n  'a>b': ^1.5.0\npackages:\n  - apps/api\n"})
        self.assertEqual(self.repo.rules(), ["pnpm-override"])

    def test_package_list_change_passes(self):
        self.repo.commit({"pnpm-workspace.yaml": "overrides:\n  'a>b': ^1.0.0\npackages:\n  - apps/api\n  - apps/web\n"})
        self.assertEqual(self.repo.rules(), [])


class TestBaseImage(Base):
    files = {
        "Dockerfile": "ARG NODE_VERSION=24.1.0\nFROM node:${NODE_VERSION}-bookworm AS base\nRUN echo hi\n",
        "docker-compose.yml": "services:\n  app:\n    image: capital-care:local\n",
    }

    def test_node_version_change_is_gated(self):
        self.repo.commit({"Dockerfile": "ARG NODE_VERSION=24.2.0\nFROM node:${NODE_VERSION}-bookworm AS base\nRUN echo hi\n"})
        self.assertEqual(self.repo.rules(), ["base-image", "base-image"])

    def test_new_from_is_gated(self):
        self.repo.commit({"Dockerfile": "ARG NODE_VERSION=24.1.0\nFROM node:${NODE_VERSION}-bookworm AS base\nFROM alpine:3 AS tools\nRUN echo hi\n"})
        self.assertEqual(self.repo.rules(), ["base-image"])

    def test_other_dockerfile_change_passes(self):
        self.repo.commit({"Dockerfile": "ARG NODE_VERSION=24.1.0\nFROM node:${NODE_VERSION}-bookworm AS base\nRUN echo bye\n"})
        self.assertEqual(self.repo.rules(), [])

    def test_compose_image_change_is_gated(self):
        self.repo.commit({"docker-compose.yml": "services:\n  app:\n    image: postgres:17\n"})
        self.assertEqual(self.repo.rules(), ["base-image", "base-image"])


class TestQualityGates(Base):
    files = {
        "vitest.config.ts": VITEST,
        "eslint.config.js": "export default [{ rules: { 'no-console': 'error' } }];\n",
        "src/a.test.ts": "it('works', () => {});\n",
        "src/a.ts": "export const a = 1;\n",
    }

    def test_lowered_threshold_is_gated(self):
        self.repo.commit({"vitest.config.ts": VITEST.replace("branches: 80", "branches: 70")})
        self.assertEqual(self.repo.rules(), ["coverage-lowered"])

    def test_raised_threshold_passes(self):
        self.repo.commit({"vitest.config.ts": VITEST.replace("branches: 80", "branches: 82")})
        self.assertEqual(self.repo.rules(), [])

    def test_removed_threshold_block_is_gated(self):
        text = VITEST.replace("    'src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },\n", "")
        self.repo.commit({"vitest.config.ts": text})
        self.assertEqual(self.repo.rules(), ["coverage-lowered"] * 4)

    def test_eslint_rule_off_is_gated(self):
        self.repo.commit({"eslint.config.js": "export default [{ rules: {\n  'no-console': 'off',\n} }];\n"})
        self.assertEqual(self.repo.rules(), ["lint-disabled"])

    def test_eslint_disable_comment_is_gated(self):
        self.repo.commit({"src/a.ts": "// eslint-disable-next-line no-console\nexport const a = 1;\n"})
        self.assertEqual(self.repo.rules(), ["lint-disabled"])

    def test_eslint_disable_in_markdown_passes(self):
        self.repo.commit({"notes.md": "Never use eslint-disable.\n"})
        self.assertEqual(self.repo.rules(), [])

    def test_eslint_disable_in_python_passes(self):
        self.repo.commit({"scripts/check.py": 'PATTERN = "eslint-disable"\n'})
        self.assertEqual(self.repo.rules(), [])

    def test_skipped_test_is_gated(self):
        self.repo.commit({"src/a.test.ts": "it.skip('works', () => {});\n"})
        self.assertEqual(self.repo.rules(), ["test-skipped"])

    def test_focused_test_is_gated(self):
        self.repo.commit({"src/a.test.ts": "it('works', () => {});\ndescribe.only('x', () => {});\n"})
        self.assertEqual(self.repo.rules(), ["test-skipped"])

    def test_skip_in_source_passes(self):
        self.repo.commit({"src/a.ts": "export const skip = list.skip(1);\n"})
        self.assertEqual(self.repo.rules(), [])


class TestMigrations(Base):
    files = {"modules/ledger/src/shared/persistence/migrations/0000_a.sql": "CREATE TABLE a (id int);\n"}

    def test_drop_table_is_gated(self):
        path = "modules/ledger/src/shared/persistence/migrations/0001_b.sql"
        self.repo.commit({path: "DROP TABLE `a`;--> statement-breakpoint\n"})
        self.assertEqual(self.repo.rules(), ["destructive-migration"])

    def test_rename_is_gated(self):
        path = "modules/ledger/src/shared/persistence/migrations/0001_b.sql"
        self.repo.commit({path: "ALTER TABLE `__new_a` RENAME TO `a`;\n"})
        self.assertEqual(self.repo.rules(), ["destructive-migration"])

    def test_additive_migration_passes(self):
        path = "modules/ledger/src/shared/persistence/migrations/0001_b.sql"
        self.repo.commit({path: "ALTER TABLE `a` ADD `name` text;\n"})
        self.assertEqual(self.repo.rules(), [])


if __name__ == "__main__":
    unittest.main()
