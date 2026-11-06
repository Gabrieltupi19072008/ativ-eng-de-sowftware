import json
import logging
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from fastapi import UploadFile

import config
from errors import ApiError

log = logging.getLogger("uvicorn.error")
CONTENT_TYPES = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

# Tipo real do arquivo, lido dos primeiros bytes (a extensão e o Content-Type enviados pelo navegador podem mentir).
def _detect(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def only_filled(files: list[UploadFile] | None) -> list[UploadFile]:
    """O navegador manda uma parte vazia quando nenhum arquivo é escolhido; ignora essas."""
    return [f for f in (files or []) if f.filename]


def read_images(files: list[UploadFile], field: str) -> list[tuple[bytes, str]]:
    """Valida todas as imagens antes de gravar qualquer uma."""
    images = []
    for upload in files:
        data = upload.file.read(config.MAX_IMAGE_BYTES + 1)
        if len(data) > config.MAX_IMAGE_BYTES:
            raise ApiError(413, f"Cada imagem pode ter no máximo {config.MAX_IMAGE_BYTES // (1024 * 1024)} MB.", field)
        ext = _detect(data)
        if not ext:
            raise ApiError(400, "Envie imagens JPG, PNG ou WEBP.", field)
        images.append((data, ext))
    return images


def remote_storage() -> bool:
    return bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_KEY)


def _public_prefix() -> str:
    return f"{config.SUPABASE_URL}/storage/v1/object/public/{config.SUPABASE_BUCKET}/"


def _supabase_headers() -> dict:
    return {"Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}", "apikey": config.SUPABASE_SERVICE_KEY}


def _upload_remote(data: bytes, ext: str) -> str:
    """Envia uma imagem ao Supabase Storage e devolve o endereço público (https://...)."""
    name = f"{uuid.uuid4().hex}{ext}"
    request = urllib.request.Request(
        f"{config.SUPABASE_URL}/storage/v1/object/{config.SUPABASE_BUCKET}/{name}", data=data, method="POST",
        headers={**_supabase_headers(), "Content-Type": CONTENT_TYPES[ext]},
    )
    urllib.request.urlopen(request, timeout=20).close()
    return _public_prefix() + name


def save_images(images: list[tuple[bytes, str]]) -> list[str]:
    """Guarda as imagens e devolve o endereço de cada uma: no Supabase (https://...) ou em UPLOAD_DIR com nome aleatório (/uploads/...)."""
    urls: list[str] = []
    if remote_storage():
        try:
            for data, ext in images:
                urls.append(_upload_remote(data, ext))
        except (urllib.error.URLError, OSError) as error:  # URLError cobre HTTPError; OSError cobre falha de rede e tempo esgotado
            log.error("Falha ao enviar imagem ao Supabase Storage: %s", error)
            remove_images(urls)  # não deixa meia obra gravada
            raise ApiError(502, "Não foi possível guardar as imagens agora. Tente de novo em instantes.", "images")
        return urls
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for data, ext in images:
        name = f"{uuid.uuid4().hex}{ext}"
        (config.UPLOAD_DIR / name).write_bytes(data)
        urls.append(f"/uploads/{name}")
    return urls


def remove_images(urls: list[str]) -> None:
    """Apaga as imagens (falhas aqui nunca derrubam a requisição: no pior caso sobra um arquivo órfão)."""
    remote = [u[len(_public_prefix()):] for u in urls if remote_storage() and u.startswith(_public_prefix())]
    if remote:
        request = urllib.request.Request(
            f"{config.SUPABASE_URL}/storage/v1/object/{config.SUPABASE_BUCKET}", data=json.dumps({"prefixes": remote}).encode(), method="DELETE",
            headers={**_supabase_headers(), "Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(request, timeout=20).close()
        except (urllib.error.URLError, OSError) as error:
            log.error("Falha ao apagar imagens no Supabase Storage: %s", error)
    for url in urls:
        if url.startswith("/uploads/"):
            try:
                (config.UPLOAD_DIR / Path(url).name).unlink(missing_ok=True)
            except OSError:
                pass
