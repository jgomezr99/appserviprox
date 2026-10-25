import json
from pathlib import Path
import tempfile

from django.test import SimpleTestCase

from .management.commands.import_sqlite import canonical_records


class TransferComparisonTests(SimpleTestCase):
    def digest(self, model, fields):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "fixture.json"
            fixture.write_text(json.dumps([{"model": model, "pk": 1, "fields": fields}]))
            return canonical_records(fixture)[0]

    def test_equivalent_timestamp_formats_and_offsets_match(self):
        self.assertEqual(
            self.digest("accounts.user", {"date_joined": "2026-10-09T03:10:02.000Z"}),
            self.digest("accounts.user", {"date_joined": "2026-10-08T22:10:02-05:00"}),
        )

    def test_different_microseconds_remain_different(self):
        self.assertNotEqual(
            self.digest("accounts.user", {"date_joined": "2026-10-09T03:10:02.000001Z"}),
            self.digest("accounts.user", {"date_joined": "2026-10-09T03:10:02.000002Z"}),
        )

    def test_many_to_many_order_does_not_change_relationships(self):
        self.assertEqual(
            self.digest("accounts.user", {"groups": [["support"], ["operations"]]}),
            self.digest("accounts.user", {"groups": [["operations"], ["support"]]}),
        )

    def test_json_array_order_is_preserved(self):
        self.assertNotEqual(
            self.digest("accounts.platformsettings", {"data": {"order": [1, 2]}}),
            self.digest("accounts.platformsettings", {"data": {"order": [2, 1]}}),
        )
