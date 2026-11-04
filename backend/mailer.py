"""Envio de e-mail (Brevo por API ou SMTP). Sem provedor configurado, o texto vai para o terminal da API: serve para testar em desenvolvimento."""
import json
import logging
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

import config

log = logging.getLogger("uvicorn.error")


def deliver_brevo(to: str, subject: str, body: str) -> None:
    """Envia pela API do Brevo (HTTPS). Erros sobem com o motivo que o Brevo devolveu."""
    payload = json.dumps({
        "sender": {"name": config.BREVO_SENDER_NAME, "email": config.BREVO_SENDER_EMAIL},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body,
    }).encode()
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email", data=payload, method="POST",
        headers={"api-key": config.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json"},
    )
    try:
        urllib.request.urlopen(request, timeout=8).close()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Brevo recusou o envio (HTTP {error.code}): {error.read().decode(errors='replace')[:300]}") from None


def deliver(to: str, subject: str, body: str) -> None:
    """Envia de verdade e deixa o erro subir (usado pelo scripts/test_email.py para mostrar o motivo da falha).
    Usa o Brevo se houver chave; senão SMTP. No SMTP, porta 465 usa SSL direto e as demais (587, 25) usam STARTTLS."""
    if config.BREVO_API_KEY:
        return deliver_brevo(to, subject, body)
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = config.SMTP_FROM, to, subject
    message.set_content(body)
    if config.SMTP_PORT == 465:
        smtp = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
    else:
        smtp = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
        smtp.starttls()
    with smtp:
        if config.SMTP_USER:
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(message)


def send_mail(to: str, subject: str, body: str) -> None:
    """Nunca levanta erro: quem chama roda em segundo plano e a resposta da API não pode depender do e-mail."""
    if not config.BREVO_API_KEY and not config.SMTP_HOST:
        if config.ENVIRONMENT.lower() == "production":
            log.error("E-mail não enviado: configure BREVO_API_KEY ou SMTP_HOST no .env (para %s, assunto: %s).", to, subject)
        else:
            log.warning("E-mail simulado (nenhum provedor configurado)\n  Para: %s\n  Assunto: %s\n  %s", to, subject, body.replace("\n", "\n  "))
        return
    try:
        deliver(to, subject, body)
        log.info("E-mail enviado para %s (%s)", to, subject)
    except Exception:
        log.exception("Falha ao enviar e-mail para %s", to)
