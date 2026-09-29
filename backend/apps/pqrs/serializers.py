import datetime
import random
from rest_framework import serializers
from .models import PQRReport, PQRMessage, AppProblemReport


class PQRMessageSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(read_only=True)

    class Meta:
        model = PQRMessage
        fields = ["id", "sender", "sender_name", "sender_role", "text", "timestamp"]

    def to_representation(self, instance):
        return {
            "id": f"msg-{instance.id}",
            "sender": instance.sender,
            "senderName": instance.sender_name,
            "senderRole": instance.sender_role,
            "text": instance.text,
            "timestamp": instance.timestamp.isoformat(),
        }

    def to_internal_value(self, data):
        return {
            "sender": data.get("sender", "client"),
            "sender_name": data.get("senderName", data.get("sender_name", "")),
            "sender_role": data.get("senderRole", data.get("sender_role", "Cliente")),
            "text": data.get("text", "").strip(),
        }


class PQRReportSerializer(serializers.ModelSerializer):
    messages = PQRMessageSerializer(many=True, read_only=True)

    class Meta:
        model = PQRReport
        fields = [
            "id",
            "radicado_number",
            "client_name",
            "client_phone",
            "client_email",
            "client_document_id",
            "client_address",
            "contractor_id_ref",
            "contractor_name",
            "contractor_company",
            "contractor_specialty",
            "contractor_avatar",
            "pqr_type",
            "reason",
            "status",
            "incident_date",
            "amount_disputed",
            "description",
            "desired_resolution",
            "evidence_files",
            "admin_resolution_notes",
            "estimated_response_days",
            "created_at",
            "messages",
        ]

    def to_representation(self, instance):
        return {
            "id": f"pqr-{instance.id}",
            "radicadoNumber": instance.radicado_number,
            "status": instance.status,
            "type": instance.pqr_type,
            "reason": instance.reason,
            "contractorId": instance.contractor_id_ref,
            "contractorName": instance.contractor_name,
            "contractorCompany": instance.contractor_company,
            "contractorSpecialty": instance.contractor_specialty,
            "contractorAvatar": instance.contractor_avatar,
            "clientName": instance.client_name,
            "clientPhone": instance.client_phone,
            "clientEmail": instance.client_email,
            "clientDocumentId": instance.client_document_id,
            "clientAddress": instance.client_address,
            "incidentDate": str(instance.incident_date),
            "amountDisputed": float(instance.amount_disputed) if instance.amount_disputed else None,
            "description": instance.description,
            "desiredResolution": instance.desired_resolution,
            "evidenceFiles": instance.evidence_files or [],
            "adminResolutionNotes": instance.admin_resolution_notes,
            "estimatedResponseDays": instance.estimated_response_days,
            "createdAt": instance.created_at.isoformat(),
            "messages": [
                {
                    "id": f"msg-{m.id}",
                    "sender": m.sender,
                    "senderName": m.sender_name,
                    "senderRole": m.sender_role,
                    "text": m.text,
                    "timestamp": m.timestamp.isoformat(),
                }
                for m in instance.messages.all()
            ],
        }

    def to_internal_value(self, data):
        # Allow both camelCase from frontend and snake_case
        inc_date = data.get("incidentDate", data.get("incident_date"))
        if not inc_date:
            inc_date = datetime.date.today()

        amt = data.get("amountDisputed", data.get("amount_disputed"))
        if amt in ("", None, "null"):
            amt = None

        radicado = data.get("radicadoNumber", data.get("radicado_number"))
        if not radicado:
            year = datetime.date.today().year
            radicado = f"PQR-BOG-{year}-{random.randint(1000, 9999)}"

        return {
            "radicado_number": radicado,
            "client_name": data.get("clientName", data.get("client_name", "")),
            "client_phone": data.get("clientPhone", data.get("client_phone", "")),
            "client_email": data.get("clientEmail", data.get("client_email", "")),
            "client_document_id": data.get("clientDocumentId", data.get("client_document_id", "")),
            "client_address": data.get("clientAddress", data.get("client_address", "")),
            "contractor_id_ref": str(data.get("contractorId", data.get("contractor_id_ref", "carlos-mendoza"))),
            "contractor_name": data.get("contractorName", data.get("contractor_name", "Ing. Carlos Mendoza")),
            "contractor_company": data.get("contractorCompany", data.get("contractor_company", "Mendoza Instalaciones Eléctricas RETIE")),
            "contractor_specialty": data.get("contractorSpecialty", data.get("contractor_specialty", "Electricidad")),
            "contractor_avatar": data.get("contractorAvatar", data.get("contractor_avatar", "")),
            "pqr_type": data.get("type", data.get("pqr_type", "queja")),
            "reason": data.get("reason", "mala_calidad_obra"),
            "status": data.get("status", "radicado"),
            "incident_date": inc_date,
            "amount_disputed": amt,
            "description": data.get("description", "Reclamo formal radicado en la app."),
            "desired_resolution": data.get("desiredResolution", data.get("desired_resolution", "Mediación formal vinculante.")),
            "evidence_files": data.get("evidenceFiles", data.get("evidence_files", [])),
        }


class AppProblemReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppProblemReport
        fields = [
            "id",
            "ticket_number",
            "category",
            "category_label",
            "description",
            "device_info",
            "reported_by",
            "user_email",
            "status",
            "response_notes",
            "created_at",
        ]

    def to_representation(self, instance):
        return {
            "id": f"prob-{instance.id}",
            "ticketNumber": instance.ticket_number,
            "category": instance.category,
            "categoryLabel": instance.category_label,
            "description": instance.description,
            "deviceInfo": instance.device_info,
            "reportedBy": instance.reported_by,
            "userEmail": instance.user_email or (instance.user.email if instance.user else ""),
            "status": instance.status,
            "responseNotes": instance.response_notes,
            "createdAt": instance.created_at.isoformat(),
        }

    def to_internal_value(self, data):
        ticket = data.get("ticketNumber", data.get("ticket_number"))
        if not ticket:
            year = datetime.date.today().year
            ticket = f"APP-BUG-{year}-{random.randint(1000, 9999)}"

        return {
            "ticket_number": ticket,
            "category": data.get("category", "error_mapa"),
            "category_label": data.get("categoryLabel", data.get("category_label", "Falla Técnica")),
            "description": data.get("description", "Reporte de problema técnico."),
            "device_info": data.get("deviceInfo", data.get("device_info", "Android / Web")),
            "reported_by": data.get("reportedBy", data.get("reported_by", "")),
            "user_email": data.get("userEmail", data.get("user_email", "")),
            "status": data.get("status", "recibido"),
            "response_notes": data.get("responseNotes", data.get("response_notes", "")),
        }

