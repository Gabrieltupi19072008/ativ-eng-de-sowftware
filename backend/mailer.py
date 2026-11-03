"""Envio de e-mail (SMTP). Sem SMTP configurado, o texto vai para o terminal da API: serve para testar em desenvolvimento."""
import logging
import smtplib
from email.message import EmailMessage

import config

log = logging.getLogger("uvicorn.error")


def send_mail(to: str, subject: str, body: str) -> None:
    """Nunca levanta erro: quem chama roda em segundo plano e a resposta da API não pode depender do e-mail."""
    if not config.SMTP_HOST:
        if config.ENVIRONMENT.lower() == "production":
            log.error("E-mail não enviado: configure SMTP_HOST no .env (para %s, assunto: %s).", to, subject)
        else:
            log.warning("E-mail simulado (SMTP não configurado)\n  Para: %s\n  Assunto: %s\n  %s", to, subject, body.replace("\n", "\n  "))
        return
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = config.SMTP_FROM, to, subject
    message.set_content(body)
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if config.SMTP_USER:
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception:
        log.exception("Falha ao enviar e-mail para %s", to)
