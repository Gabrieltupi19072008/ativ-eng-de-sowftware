"""Testa o envio de e-mail com as configurações SMTP do backend/.env, sem criar conta nem pedir senha.

Uso (dentro de backend/):   .venv/bin/python scripts/test_email.py seu@email.com
Se algo estiver errado, mostra o motivo (usuário/senha recusados, porta errada, etc.)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
import mailer


def main() -> int:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print("Uso: .venv/bin/python scripts/test_email.py seu@email.com")
        return 2
    if config.BREVO_API_KEY:
        if not config.BREVO_SENDER_EMAIL:
            print("BREVO_SENDER_EMAIL está vazio no backend/.env (use o e-mail verificado no Brevo).")
            return 1
        print(f"Enviando de {config.BREVO_SENDER_EMAIL} via Brevo para {sys.argv[1]}...")
    elif config.SMTP_HOST:
        print(f"Enviando de {config.SMTP_FROM} via {config.SMTP_HOST}:{config.SMTP_PORT} para {sys.argv[1]}...")
    else:
        print("Nenhum provedor no backend/.env: o e-mail não seria enviado de verdade. Preencha BREVO_* ou SMTP_* (veja .env.example).")
        return 1
    try:
        mailer.deliver(sys.argv[1], "Teste de e-mail — Nambá Galerie", "Se você recebeu esta mensagem, o envio de e-mails da Nambá Galerie está funcionando.")
    except Exception as error:  # mostra o motivo exato para quem está configurando
        print(f"FALHOU: {type(error).__name__}: {error}")
        return 1
    print("Enviado! Confira a caixa de entrada (e o spam).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
