"""Respuestas publicas sin trazas ni mensajes internos."""
import logging
from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework.views import exception_handler
logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response
    logger.error("Error interno en la API", exc_info=(type(exc), exc, exc.__traceback__))
    return Response({"detail": "Error interno del servidor."}, status=500)


def bad_request(request, exception):
    return JsonResponse({"detail": "Solicitud invalida."}, status=400)


def permission_denied(request, exception):
    return JsonResponse({"detail": "Acceso denegado."}, status=403)


def not_found(request, exception):
    return JsonResponse({"detail": "Recurso no encontrado."}, status=404)


def server_error(request):
    return JsonResponse({"detail": "Error interno del servidor."}, status=500)
