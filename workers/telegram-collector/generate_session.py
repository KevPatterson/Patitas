#!/usr/bin/env python3
"""
Generador de StringSession para Telethon
Ejecuta este script UNA VEZ para generar la sesión.
La sesión generada debe guardarse en TELEGRAM_STRING_SESSION.
"""

import os
import sys
from telethon.sync import TelegramClient
from telethon.sessions import StringSession
from dotenv import load_dotenv

# Cargar .env si existe
load_dotenv()

def main():
    api_id = os.getenv('TELEGRAM_API_ID')
    api_hash = os.getenv('TELEGRAM_API_HASH')
    
    if not api_id or not api_hash:
        print('Error: TELEGRAM_API_ID y TELEGRAM_API_HASH deben estar en .env')
        print('Obténlos en https://my.telegram.org')
        sys.exit(1)
    
    try:
        api_id = int(api_id)
    except ValueError:
        print('Error: TELEGRAM_API_ID debe ser un número')
        sys.exit(1)
    
    print('Generando StringSession...')
    print('Se te pedirá:')
    print('  1. Tu número de teléfono (formato +535XXXXXXXX)')
    print('  2. Código de verificación que recibirás en Telegram')
    print('  3. Contraseña 2FA (si la tienes activada)')
    print()
    
    # StringSession se guarda en memoria, no en archivo
    with TelegramClient(StringSession(), api_id, api_hash) as client:
        session_string = client.session.save()
    
    print()
    print('=' * 60)
    print('STRING SESSION GENERADA (guárdala de forma segura):')
    print('=' * 60)
    print(session_string)
    print('=' * 60)
    print()
    print('Agrega esta línea a tu .env:')
    print(f'TELEGRAM_STRING_SESSION={session_string}')
    print()
    print('⚠️  NUNCA compartas esta sesión ni la subas a GitHub')
    print('⚠️  Permite acceso total a tu cuenta de Telegram')

if __name__ == '__main__':
    main()