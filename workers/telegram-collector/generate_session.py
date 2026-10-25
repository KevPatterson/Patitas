#!/usr/bin/env python3
"""
Generador de StringSession para Telethon.

Las credenciales se leen SIEMPRE de variables de entorno (o del `.env` local,
que está ignorado por git). Nunca se escriben en el código.

Uso:
    python generate_session.py                # imprime la sesión por stdout
    python generate_session.py --write-env    # además la guarda en .env
    python generate_session.py --check        # valida la sesión existente

Variables:
    TELEGRAM_API_ID          (obligatoria)
    TELEGRAM_API_HASH        (obligatoria)
    TELEGRAM_PHONE           (opcional; si falta, Telethon lo pide por consola)
    TELEGRAM_STRING_SESSION  (solo para --check)

La cadena resultante debe guardarse como secret TELEGRAM_STRING_SESSION en
GitHub Actions. Es equivalente a la contraseña de la cuenta: no la compartas.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

ENV_PATH = Path(__file__).parent / ".env"

# Cargar .env sin sobrescribir variables ya presentes en el entorno.
load_dotenv(ENV_PATH, override=False)


def _fail(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(1)


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        _fail(f"falta la variable de entorno {name}")
    return value


def _api_credentials() -> tuple[int, str]:
    raw_id = _require("TELEGRAM_API_ID")
    api_hash = _require("TELEGRAM_API_HASH")

    try:
        api_id = int(raw_id)
    except ValueError:
        _fail("TELEGRAM_API_ID debe ser un número entero")

    if not re.fullmatch(r"[0-9a-fA-F]{32}", api_hash):
        _fail("TELEGRAM_API_HASH debe tener 32 caracteres hexadecimales")

    return api_id, api_hash


def _write_session_to_env(session: str) -> None:
    """Guarda la sesión en .env preservando el resto de variables."""
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()

    updated = False
    for index, line in enumerate(lines):
        if line.startswith("TELEGRAM_STRING_SESSION="):
            lines[index] = f"TELEGRAM_STRING_SESSION={session}"
            updated = True
            break

    if not updated:
        lines.append(f"TELEGRAM_STRING_SESSION={session}")

    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        ENV_PATH.chmod(0o600)
    except OSError:
        pass
    print(f"Sesión guardada en {ENV_PATH} (permisos restringidos).")


def _check_session() -> None:
    raw = _require("TELEGRAM_STRING_SESSION")
    try:
        session = StringSession(raw)
    except ValueError as exc:
        _fail(f"la cadena no es una StringSession válida: {exc}")

    print(f"Longitud: {len(raw)} caracteres")
    print(f"Tiene auth_key: {session.auth_key is not None}")
    print(f"Data center: {session.dc_id}")
    if session.auth_key is None:
        _fail("la cadena no contiene una auth_key utilizable")


def _generate(write_env: bool) -> None:
    api_id, api_hash = _api_credentials()
    phone = os.getenv("TELEGRAM_PHONE", "").strip() or None

    print("Generando StringSession...")
    print("Telethon pedirá el código de verificación (y la contraseña 2FA si aplica).")
    if not phone:
        print("No se definió TELEGRAM_PHONE: se pedirá el teléfono por consola.")
    print()

    with TelegramClient(StringSession(), api_id, api_hash) as client:
        client.start(phone=phone)
        session_string = client.session.save()

    print()
    print("=" * 60)
    print("STRING SESSION GENERADA (guárdala de forma segura):")
    print("=" * 60)
    print(session_string)
    print("=" * 60)
    print()
    print("Guárdala como secret TELEGRAM_STRING_SESSION en GitHub Actions.")
    if write_env:
        _write_session_to_env(session_string)
    else:
        print("Puedes guardarla en tu .env local con: --write-env")
    print("NUNCA la compartas ni la subas a GitHub.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera o valida la StringSession de Telethon")
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="guarda la sesión generada en el .env local",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="valida la TELEGRAM_STRING_SESSION existente sin conectarse",
    )
    args = parser.parse_args()

    if args.check:
        _check_session()
        return

    _generate(args.write_env)


if __name__ == "__main__":
    main()
