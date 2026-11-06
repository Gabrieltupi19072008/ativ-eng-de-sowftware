"""Textos dos e-mails. Estilos inline e fontes do sistema (Georgia): os leitores de e-mail ignoram CSS externo e fontes da web."""
from html import escape


def password_reset_email(name: str, link: str, minutes: int) -> tuple[str, str]:
    """Devolve (texto simples, HTML) do e-mail de recuperação de senha. O texto serve de reserva para quem lê sem HTML."""
    first_name = name.split()[0] if name.strip() else ""
    text = (
        f"Olá, {first_name}!\n\nRecebemos um pedido para redefinir a senha da sua conta. Use o link abaixo (vale por {minutes} minutos e só funciona uma vez):\n\n{link}\n\n"
        "Se não foi você, ignore este e-mail: a sua senha continua a mesma."
    )
    safe_link = escape(link, quote=True)
    html = f"""<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f7f5f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #dedad1;">
<tr><td align="center" style="padding:32px 28px 28px;font-family:Helvetica,Arial,sans-serif;color:#201f1c;">
<div style="font-family:Georgia,'Times New Roman',serif;font-weight:bold;letter-spacing:2px;text-transform:uppercase;font-size:16px;">Nambá Galerie<span style="color:#af7a3d;">.</span></div>
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;margin:22px 0 10px;">Crie uma nova senha</h1>
<p style="font-size:14px;line-height:1.6;color:#716e67;margin:0 0 22px;">{escape(f"Olá, {first_name}! " if first_name else "")}Recebemos um pedido para redefinir a senha da sua conta. Clique no botão para escolher uma nova.</p>
<a href="{safe_link}" style="display:inline-block;background:#af7a3d;color:#ffffff;text-decoration:none;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold;padding:14px 28px;">Criar nova senha</a>
<p style="font-size:12px;line-height:1.6;color:#716e67;margin:24px 0 0;">O link vale por {minutes} minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p>
<p style="font-size:11px;line-height:1.6;color:#9a968c;margin:18px 0 0;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all;">{safe_link}</span></p>
</td></tr></table>
</td></tr></table>
</body></html>"""
    return text, html
