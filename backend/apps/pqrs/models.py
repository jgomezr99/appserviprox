import datetime
from django.conf import settings
from django.db import models


class PQRReport(models.Model):
    TYPE_CHOICES = [
        ("queja", "Queja de Trato/Servicio"),
        ("reclamo", "Reclamo Técnico de Obra"),
        ("recurso_garantia", "Recurso de Garantía 6 Meses"),
        ("peticion", "Petición Formal"),
    ]

    STATUS_CHOICES = [
        ("radicado", "Radicado / En espera"),
        ("en_revision", "En Revisión Técnica / Jurídica"),
        ("conciliacion", "En Mesa de Conciliación"),
        ("resuelto", "Resuelto a Satisfacción"),
        ("sancionado", "Contratista Sancionado"),
    ]

    radicado_number = models.CharField(max_length=60, unique=True, db_index=True)
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pqr_reports",
    )
    client_name = models.CharField(max_length=150, blank=True, default="")
    client_phone = models.CharField(max_length=50, blank=True, default="")
    client_email = models.EmailField(blank=True, default="")
    client_document_id = models.CharField(max_length=50, blank=True, default="")
    client_address = models.CharField(max_length=255, blank=True, default="")

    contractor = models.ForeignKey(
        "professionals.ProfessionalProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pqr_complaints",
    )

    contractor_id_ref = models.CharField(max_length=100, default="carlos-mendoza", db_index=True)
    contractor_name = models.CharField(max_length=150, default="Ing. Carlos Mendoza")
    contractor_company = models.CharField(max_length=150, default="Mendoza Instalaciones Eléctricas RETIE")
    contractor_specialty = models.CharField(max_length=150, blank=True, default="Electricidad y Certificación RETIE")
    contractor_avatar = models.TextField(blank=True, default="")

    pqr_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="queja")
    reason = models.CharField(max_length=60, default="mala_calidad_obra")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="radicado", db_index=True)

    incident_date = models.DateField(default=datetime.date.today)
    amount_disputed = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    description = models.TextField()
    desired_resolution = models.TextField(
        default="Revisión técnica urgente, garantía vinculante y mediación formal por la Defensoría de Bogotá."
    )
    evidence_files = models.JSONField(default=list, blank=True)
    admin_resolution_notes = models.TextField(blank=True, default="")
    estimated_response_days = models.PositiveIntegerField(default=2)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "PQR / Reclamo"
        verbose_name_plural = "PQRS / Reclamos"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.radicado_number} - {self.contractor_company} ({self.status})"


class PQRMessage(models.Model):
    SENDER_CHOICES = [
        ("client", "Cliente"),
        ("contractor", "Contratista"),
        ("support_agent", "Agente Soporte"),
        ("system", "Sistema"),
    ]

    pqr = models.ForeignKey(PQRReport, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=30, choices=SENDER_CHOICES, default="client")
    sender_name = models.CharField(max_length=150, blank=True, default="")
    sender_role = models.CharField(max_length=100, blank=True, default="Cliente")
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Mensaje PQR"
        verbose_name_plural = "Mensajes PQR"
        ordering = ["timestamp"]

    def __str__(self):
        return f"{self.pqr.radicado_number} - {self.sender_name}: {self.text[:30]}"


class AppProblemReport(models.Model):
    STATUS_CHOICES = [
        ("recibido", "Recibido / En Análisis"),
        ("en_proceso", "En Corrección Técnica"),
        ("resuelto", "Corregido en Producción"),
    ]

    ticket_number = models.CharField(max_length=60, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="app_problems",
    )
    user_email = models.EmailField(blank=True, default="", db_index=True)
    category = models.CharField(max_length=50, default="error_mapa")
    category_label = models.CharField(max_length=100, default="Falla en Mapa / GPS Bogotá")
    description = models.TextField()
    device_info = models.CharField(max_length=150, blank=True, default="Android / Web")
    reported_by = models.CharField(max_length=150, blank=True, default="")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="recibido")
    response_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Problema Técnico de la App"
        verbose_name_plural = "Problemas Técnicos de la App"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.ticket_number} - {self.category_label} ({self.status})"
