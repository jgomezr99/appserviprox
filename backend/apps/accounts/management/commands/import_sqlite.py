"""Transfer a consistent SQLite snapshot to an empty PostgreSQL database."""
import hashlib
import json
from pathlib import Path
import sqlite3
from datetime import timezone as datetime_timezone

from django.apps import apps
from django.core.management import BaseCommand, CommandError, call_command
from django.db import connections, transaction
from django.utils.dateparse import parse_datetime, parse_time


EXCLUDED = {"contenttypes.contenttype", "auth.permission"}


def canonical_records(filename):
    records = json.loads(filename.read_text(encoding="utf-8"))
    for record in records:
        model = apps.get_model(record["model"])
        for name, value in record["fields"].items():
            field = model._meta.get_field(name)
            if value is not None and field.get_internal_type() == "DateTimeField":
                timestamp = parse_datetime(value)
                if timestamp.utcoffset() is not None:
                    timestamp = timestamp.astimezone(datetime_timezone.utc)
                record["fields"][name] = timestamp.isoformat(timespec="microseconds")
            elif value is not None and field.get_internal_type() == "TimeField":
                record["fields"][name] = parse_time(value).isoformat(timespec="microseconds")
            elif field.many_to_many:
                record["fields"][name] = sorted(value, key=lambda item: json.dumps(item, sort_keys=True))
    records.sort(key=lambda record: (record["model"], str(record["pk"])))
    content = json.dumps(records, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    counts = {}
    for record in records:
        counts[record["model"]] = counts.get(record["model"], 0) + 1
    return hashlib.sha256(content.encode()).hexdigest(), counts, len(records)


class Command(BaseCommand):
    help = "Import SQLite into empty PostgreSQL, preserving IDs and checking every serialized field."

    def add_arguments(self, parser):
        parser.add_argument("--sqlite", required=True, help="Existing SQLite file; never modified.")
        parser.add_argument("--output-dir", required=True, help="New private backup/report directory.")
        parser.add_argument("--verify-only", action="store_true", help="Compare without writing to PostgreSQL.")

    def handle(self, *args, **options):
        target = connections["default"]
        if target.vendor != "postgresql":
            raise CommandError("Configure SERVIPROX_DATABASE=postgres before running this command.")
        source = Path(options["sqlite"]).resolve()
        if not source.is_file():
            raise CommandError("The SQLite source file does not exist.")
        models = [model for model in apps.get_models()
                  if not model._meta.proxy and not model._meta.auto_created
                  and model._meta.label_lower not in EXCLUDED]
        if not options["verify_only"]:
            tables = set(target.introspection.table_names())
            for model in models:
                if model._meta.db_table in tables and model._base_manager.using("default").exists():
                    raise CommandError("Destination contains application data; use a new empty PostgreSQL database.")

        output = Path(options["output_dir"]).resolve()
        if output.exists():
            raise CommandError("Output directory already exists; choose a new private directory.")
        output.mkdir(parents=True, mode=0o700)
        snapshot = output / "source.sqlite3"
        try:
            with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as origin:
                with sqlite3.connect(snapshot) as copy:
                    origin.backup(copy)
            snapshot.chmod(0o600)
            with sqlite3.connect(snapshot) as copy:
                if copy.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise CommandError("SQLite integrity check failed.")
                if copy.execute("PRAGMA foreign_key_check").fetchone() is not None:
                    raise CommandError("SQLite contains invalid foreign keys; repair a copy before importing.")
            source_config = dict(target.settings_dict)
            source_config.update(ENGINE="django.db.backends.sqlite3", NAME=str(snapshot),
                                 USER="", PASSWORD="", HOST="", PORT="", OPTIONS={"timeout": 30},
                                 CONN_MAX_AGE=0)
            alias = "sqlite_transfer_source"
            if alias in connections.databases:
                raise CommandError("Source database alias already exists.")
            connections.databases[alias] = source_config
            fixture = output / "source.json"
            self.dump(alias, fixture)
            source_hash, source_counts, total = canonical_records(fixture)
            destination = output / "postgres.json"
            if not options["verify_only"]:
                call_command("migrate", interactive=False, verbosity=options["verbosity"])
                with transaction.atomic(using="default"):
                    call_command("loaddata", str(fixture), database="default", verbosity=options["verbosity"])
                    self.dump("default", destination)
                    self.compare(destination, source_hash, source_counts)
            else:
                self.dump("default", destination)
                self.compare(destination, source_hash, source_counts)
            sequences = 0
            with target.cursor() as cursor:
                for model in models:
                    pk = model._meta.pk
                    if pk.get_internal_type() not in {"AutoField", "BigAutoField", "SmallAutoField"}:
                        continue
                    table = model._meta.db_table
                    cursor.execute("SELECT pg_get_serial_sequence(%s, %s)", [table, pk.column])
                    sequence = cursor.fetchone()[0]
                    if not sequence:
                        continue
                    cursor.execute(f"SELECT COALESCE(MAX({target.ops.quote_name(pk.column)}), 0) FROM {target.ops.quote_name(table)}")
                    maximum = cursor.fetchone()[0]
                    # Identifier originates from PostgreSQL's catalog, not from command input.
                    quoted_sequence = ".".join(target.ops.quote_name(part) for part in sequence.split("."))
                    cursor.execute(f"SELECT last_value FROM {quoted_sequence}")
                    if cursor.fetchone()[0] < maximum:
                        raise CommandError("A PostgreSQL sequence is behind its imported IDs.")
                    sequences += 1
            report = {"verified": True, "verify_only": options["verify_only"],
                      "records": total, "model_counts": source_counts,
                      "data_sha256": source_hash, "sequences_checked": sequences,
                      "source_modified": False}
            (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(
                f"Verified {total} records across {len(source_counts)} models; {sequences} sequences checked."
            ))
            self.stdout.write(f"Private report: {output / 'report.json'}")
        finally:
            if "sqlite_transfer_source" in connections.databases:
                connections["sqlite_transfer_source"].close()

    @staticmethod
    def dump(alias, filename):
        call_command("dumpdata", "--all", "--natural-foreign", "--exclude=contenttypes",
                     "--exclude=auth.permission", f"--database={alias}", f"--output={filename}", verbosity=0)
        filename.chmod(0o600)

    @staticmethod
    def compare(filename, expected_hash, expected_counts):
        actual_hash, actual_counts, _ = canonical_records(filename)
        if actual_hash != expected_hash or actual_counts != expected_counts:
            raise CommandError("The complete source and PostgreSQL datasets differ; import rolled back.")
