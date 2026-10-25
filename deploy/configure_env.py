#!/usr/bin/env python3
"""Create a private, non-overwriting production environment after cloning."""
import argparse
import os
from pathlib import Path
import re
import secrets
import subprocess
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-domain", required=True, help="Public hostname for the GCP API.")
    parser.add_argument("--email", required=True, help="Certificate operator email.")
    parser.add_argument("--frontend-origin", default="https://serviproxweb.netlify.app")
    parser.add_argument("--output", default=".env.production")
    parser.add_argument("--release", help="Defaults to the checked-out Git commit.")
    args = parser.parse_args()
    domain = args.api_domain.strip().lower()
    if (not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", domain)
            or "." not in domain or domain in {"127.0.0.1", "localhost"}
            or ".." in domain):
        parser.error("--api-domain must be a public hostname, without https:// or a path.")
    try:
        origin = urlsplit(args.frontend_origin)
        origin.port
    except ValueError:
        parser.error("--frontend-origin has an invalid hostname or port.")
    if (any(character.isspace() for character in args.frontend_origin)
            or origin.scheme != "https" or not origin.hostname or origin.username or origin.password
            or origin.path or origin.query or origin.fragment):
        parser.error("--frontend-origin must be an exact HTTPS origin without a trailing slash.")
    if not re.fullmatch(r"[^\s=@]+@[^\s=@]+\.[^\s=@]+", args.email):
        parser.error("--email must be a valid operator email.")
    root = Path(__file__).resolve().parent.parent
    release = args.release
    if not release:
        try:
            release = subprocess.check_output(
                ["git", "rev-parse", "--short=12", "HEAD"], cwd=root, text=True
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            parser.error("Cannot identify the Git commit; provide --release explicitly.")
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}", release):
        parser.error("Invalid release tag.")
    overrides = {
        "API_DOMAIN": domain,
        "ACME_EMAIL": args.email,
        "SERVIPROX_RELEASE": release,
        "DJANGO_SECRET_KEY": secrets.token_hex(32),
        "POSTGRES_PASSWORD": secrets.token_urlsafe(48),
        "DJANGO_ALLOWED_HOSTS": f"{domain},127.0.0.1",
        "CSRF_TRUSTED_ORIGINS": f"https://{domain}",
        "CORS_ALLOWED_ORIGINS": f"{args.frontend_origin},https://localhost,capacitor://localhost",
        "FRONTEND_URL": args.frontend_origin,
    }
    lines = []
    for line in (root / ".env.production.example").read_text(encoding="utf-8").splitlines():
        key, separator, _ = line.partition("=")
        lines.append(f"{key}={overrides[key]}" if separator and key in overrides else line)
    output = Path(args.output).resolve()
    try:
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        parser.error(f"{output.name} already exists; preserving the existing environment.")
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines) + "\n")
    print(f"Created {output.name} with PostgreSQL, Netlify origin and independent generated secrets.")
    print("Complete the SMTP settings before enabling password-recovery emails.")


if __name__ == "__main__":
    main()
