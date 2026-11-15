"""Validación del certificado profesional que se exige al registrarse o cambiar a profesional."""
from rest_framework.exceptions import ValidationError

MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024
CERTIFICATE_SIGNATURES = {
    ".pdf": (b"%PDF",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
}


def validate_certificate_upload(upload, profession: str) -> None:
    """Exige profesión y un certificado PDF/JPG/PNG de hasta 5 MB cuyo contenido coincida con su extensión."""
    errors = {}
    if not 3 <= len(profession) <= 120:
        errors["profession"] = "Indica la profesión u oficio con el que trabajarás (3 a 120 caracteres)."
    if upload is None:
        errors["certificate"] = "Adjunta el certificado de tu profesión."
    else:
        extension = "." + upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else ""
        header = upload.read(8)
        upload.seek(0)
        if extension not in CERTIFICATE_SIGNATURES or not header.startswith(CERTIFICATE_SIGNATURES[extension]):
            errors["certificate"] = "El certificado debe ser un archivo PDF, JPG o PNG válido."
        elif upload.size > MAX_CERTIFICATE_BYTES:
            errors["certificate"] = "El certificado no puede superar 5 MB."
    if errors:
        raise ValidationError(errors)
