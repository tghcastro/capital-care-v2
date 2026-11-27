"""Tests for code_review_report.py.

Run: python3 -m unittest discover -s scripts -p 'test_*.py' -v
"""

import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import code_review_report as crr  # noqa: E402

BLOCKING = {"id": "F1", "severity": "blocking", "status": "open", "file": "apps/api/src/a.ts", "line": 3,
            "rule_ref": "docs/tech/definitions/api.md#errors", "summary": "Returns 500 for a validation error"}
SUGGESTION = {"id": "F2", "severity": "suggestion", "status": "open", "file": "apps/api/src/a.ts", "line": 9,
              "rule_ref": "", "summary": "Name could be clearer"}


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.dir)

    def path(self, name, content=None):
        p = os.path.join(self.dir, name)
        if content is not None:
            with open(p, "w", encoding="utf-8") as f:
                f.write(content if isinstance(content, str) else json.dumps(content))
        return p

    def report(self, mode, result=None, previous=None, labels="", event="opened"):
        args = ["report", "--mode", mode, "--labels", labels, "--event", event, "--head-sha", "abc1234def",
                "--body-out", self.path("body.md")]
        if result is not None:
            args += ["--output-file", self.path("out.json", result)]
        if previous is not None:
            args += ["--previous-file", self.path("prev.json", previous)]
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = crr.main(args)
        with open(self.path("body.md"), encoding="utf-8") as f:
            body = f.read()
        return code, body


def result(*findings, mode="full"):
    return {"reviewed_sha": "abc1234def", "mode": mode, "findings": list(findings), "rules_read": ["docs/tech/definitions/api.md"]}


class TestReview(Base):
    def test_no_findings_passes(self):
        code, body = self.report("review", result())
        self.assertEqual(code, 0)
        self.assertIn("No blocking findings", body)

    def test_suggestion_only_passes(self):
        code, body = self.report("review", result(SUGGESTION))
        self.assertEqual(code, 0)
        self.assertIn("Name could be clearer", body)

    def test_open_blocking_fails(self):
        code, body = self.report("review", result(BLOCKING, SUGGESTION))
        self.assertEqual(code, 1)
        self.assertIn("1 blocking finding(s) open", body)
        self.assertIn("review-override", body)

    def test_resolved_blocking_passes(self):
        self.assertEqual(self.report("review", result(dict(BLOCKING, status="resolved")))[0], 0)

    def test_override_passes(self):
        code, body = self.report("review", result(BLOCKING), labels="review-override")
        self.assertEqual(code, 0)
        self.assertIn("overridden by the owner", body)

    def test_override_does_not_count_on_synchronize(self):
        self.assertEqual(self.report("review", result(BLOCKING), labels="review-override", event="synchronize")[0], 1)

    def test_empty_output_fails(self):
        code, body = self.report("review", "")
        self.assertEqual(code, 1)
        self.assertIn("did not finish", body)

    def test_missing_output_file_fails(self):
        self.assertEqual(self.report("review")[0], 1)

    def test_malformed_output_fails(self):
        self.assertEqual(self.report("review", {"summary": "looks good"})[0], 1)

    def test_dropped_previous_blocking_is_carried_forward(self):
        previous = {"status": "reviewed", "reviewed_sha": "old", "findings": [BLOCKING]}
        code, body = self.report("review", result(SUGGESTION, mode="incremental"), previous=previous)
        self.assertEqual(code, 1)
        self.assertIn("carried over", body)

    def test_resolved_previous_blocking_passes(self):
        previous = {"status": "reviewed", "reviewed_sha": "old", "findings": [BLOCKING]}
        code, _ = self.report("review", result(dict(BLOCKING, status="resolved"), mode="incremental"), previous=previous)
        self.assertEqual(code, 0)


class TestDisabledAndLabels(Base):
    def test_disabled_waits_for_human(self):
        code, body = self.report("disabled")
        self.assertEqual(code, 1)
        self.assertIn("AUTO_REVIEW=off", body)
        self.assertIn("waiting for human review", body)

    def test_disabled_with_override_passes(self):
        code, body = self.report("disabled", labels="review-override")
        self.assertEqual(code, 0)
        self.assertIn("Reviewed by the owner", body)

    def test_labels_mode_rejudges_previous(self):
        previous = {"status": "reviewed", "reviewed_sha": "abc", "findings": [BLOCKING]}
        self.assertEqual(self.report("labels", previous=previous)[0], 1)
        self.assertEqual(self.report("labels", previous=previous, labels="review-override", event="labeled")[0], 0)

    def test_labels_mode_without_previous_fails(self):
        code, body = self.report("labels", previous={})
        self.assertEqual(code, 1)
        self.assertIn("No automated review has run", body)

    def test_dependabot_passes(self):
        self.assertEqual(self.report("dependabot")[0], 0)


class TestState(Base):
    def test_round_trip(self):
        _, body = self.report("review", result(BLOCKING))
        comment = self.path("comment.md", body)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            crr.main(["state", "--comment-file", comment, "--out", self.path("state.json")])
        self.assertIn("last_sha=abc1234def", out.getvalue())
        self.assertIn("last_status=reviewed", out.getvalue())
        with open(self.path("state.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["findings"][0]["id"], "F1")

    def test_summary_text_cannot_break_the_marker(self):
        _, body = self.report("review", result(dict(BLOCKING, summary="ends --> here | pipe")))
        self.assertEqual(crr.extract_state(body)["findings"][0]["summary"], "ends --> here | pipe")

    def test_no_previous_comment(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            crr.main(["state", "--comment-file", self.path("missing.md"), "--out", self.path("state.json")])
        self.assertIn("last_status=", out.getvalue())
        self.assertIsNone(crr.extract_state("no marker here"))


if __name__ == "__main__":
    unittest.main()
