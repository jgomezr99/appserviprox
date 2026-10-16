from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.diagnosis.engine import suggest_services
from apps.diagnosis.models import DiagnosticQuestion, DiagnosticOption, DiagnosticSession
from apps.households.models import Household
from apps.service_requests.models import ServiceRequest


class OrientedSearchTests(TestCase):
    def setUp(self):
        self.category = ServiceCategory.objects.create(
            name="Plomería",
            slug="plomeria",
            keywords=["fuga de agua", "goteo"],
        )
        self.other_category = ServiceCategory.objects.create(
            name="Electricidad",
            slug="electricidad",
            keywords=["corto", "enchufe"],
            sort_order=1,
        )
        self.repair = Service.objects.create(
            category=self.category,
            name="Reparación de fuga",
            slug="reparacion-fuga",
            keywords=["fuga de agua", "tubería rota", "grifo goteando"],
        )
        self.drain = Service.objects.create(
            category=self.category,
            name="Destape de desagüe",
            slug="destape-desague",
            keywords=["desagüe tapado"],
        )
        self.inactive = Service.objects.create(
            category=self.category,
            name="Servicio inactivo",
            slug="servicio-inactivo",
            keywords=["fuga de agua"],
            is_active=False,
        )

    def test_suggests_service_across_case_and_diacritics(self):
        result = suggest_services("TENGO una FÚGA de AGUA debajo del lavaplatos")

        self.assertEqual(result.service, self.repair)
        self.assertEqual(result.category, self.category)
        self.assertIn("fuga de agua", result.service_ranking[0]["matched_terms"])
        self.assertNotIn(self.inactive.id, [item["id"] for item in result.service_ranking])

    def test_no_match_does_not_invent_a_suggestion(self):
        result = suggest_services("Necesito aprender a tocar guitarra")

        self.assertIsNone(result.category)
        self.assertIsNone(result.service)
        self.assertEqual(result.confidence, 0)
        self.assertEqual(result.service_ranking, [])

    def test_service_ranking_is_stable_when_scores_tie(self):
        earlier_name = Service.objects.create(
            category=self.category,
            name="Ajuste de fuga",
            slug="ajuste-fuga",
            keywords=["goteo especial"],
        )
        later_name = Service.objects.create(
            category=self.category,
            name="Revisión de fuga",
            slug="revision-fuga",
            keywords=["goteo especial"],
        )

        result = suggest_services("goteo especial")

        ids = [item["id"] for item in result.service_ranking]
        self.assertLess(ids.index(earlier_name.id), ids.index(later_name.id))

    def test_guided_question_weights_continue_to_suggest_categories(self):
        question = DiagnosticQuestion.objects.create(
            code="test-problem",
            text="¿Qué sucede?",
        )
        option = DiagnosticOption.objects.create(
            question=question,
            value="electrical",
            label="Problema eléctrico",
            weights={"electricidad": 4},
        )

        result = suggest_services("Necesito ayuda en casa", [option.id])

        self.assertEqual(result.category, self.other_category)
        self.assertIsNone(result.service)

    def test_diagnosis_endpoint_returns_ranked_service_suggestions(self):
        response = APIClient().post(
            "/api/v1/diagnosis/sessions/",
            {"description": "Tengo una fuga de agua"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["suggested_service"]["id"], self.repair.id)
        self.assertEqual(response.data["service_ranking"][0]["id"], self.repair.id)
        self.assertEqual(response.data["suggested_category"]["id"], self.category.id)

    def test_suggestion_followed_is_measured_at_service_level(self):
        session = DiagnosticSession.objects.create(
            description="Fuga de agua",
            suggested_category=self.category,
            suggested_service=self.repair,
        )
        request = ServiceRequest(
            diagnostic_session=session,
            suggested_category=self.category,
            selected_category=self.category,
            selected_service=self.drain,
        )

        self.assertFalse(request.followed_suggestion)

    def test_selected_suggestion_creates_request_and_confirms_session(self):
        user = User.objects.create_user(
            email="client@example.com",
            username="oriented-client",
            password="test-password",
            role=UserRole.CLIENT,
        )
        household = Household.objects.create(
            owner=user,
            label="Casa",
            city="Bogotá",
            neighborhood="Kennedy",
        )
        session = DiagnosticSession.objects.create(
            description="Tengo una fuga de agua",
            suggested_category=self.category,
            suggested_service=self.repair,
        )
        api = APIClient()
        api.force_authenticate(user=user)

        response = api.post(
            "/api/v1/requests/",
            {
                "household": household.id,
                "diagnostic_session": session.id,
                "selected_service": self.repair.id,
                "professional": None,
                "description": "Tengo una fuga de agua",
                "urgency": "this_week",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        session.refresh_from_db()
        self.assertEqual(session.user_id, user.id)
        self.assertEqual(session.status, DiagnosticSession.Status.CONFIRMED)
        self.assertTrue(response.data["followed_suggestion"])

    def test_client_cannot_attach_another_users_diagnostic_session(self):
        first_user = User.objects.create_user(
            email="first@example.com",
            username="first-client",
            password="test-password",
            role=UserRole.CLIENT,
        )
        second_user = User.objects.create_user(
            email="second@example.com",
            username="second-client",
            password="test-password",
            role=UserRole.CLIENT,
        )
        household = Household.objects.create(
            owner=second_user,
            label="Casa",
            city="Bogotá",
            neighborhood="Kennedy",
        )
        session = DiagnosticSession.objects.create(
            user=first_user,
            description="Tengo una fuga de agua",
            suggested_category=self.category,
            suggested_service=self.repair,
        )
        api = APIClient()
        api.force_authenticate(user=second_user)

        response = api.post(
            "/api/v1/requests/",
            {
                "household": household.id,
                "diagnostic_session": session.id,
                "selected_service": self.repair.id,
                "description": "Tengo una fuga de agua",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
