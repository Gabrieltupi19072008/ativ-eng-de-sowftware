import uuid
from pathlib import Path

from fastapi import UploadFile

import config
from errors import ApiError

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


def save_images(images: list[tuple[bytes, str]]) -> list[str]:
    """Grava em UPLOAD_DIR com nome aleatório e devolve o caminho público (/uploads/...)."""
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    urls: list[str] = []
    for data, ext in images:
        name = f"{uuid.uuid4().hex}{ext}"
        (config.UPLOAD_DIR / name).write_bytes(data)
        urls.append(f"/uploads/{name}")
    return urls


def remove_images(urls: list[str]) -> None:
    for url in urls:
        try:
            (config.UPLOAD_DIR / Path(url).name).unlink(missing_ok=True)
        except OSError:
            pass
