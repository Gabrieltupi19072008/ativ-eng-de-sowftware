class ApiError(Exception):
    """Erro de regra de negócio. Vira JSON no formato {ok: false, message, field?} que o front já entende.
    `extra` acrescenta chaves à resposta (ex.: lista de obras indisponíveis)."""

    def __init__(self, status: int, message: str, field: str | None = None, extra: dict | None = None):
        self.status = status
        self.message = message
        self.field = field
        self.extra = extra or {}
