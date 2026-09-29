from rest_framework.routers import DefaultRouter

from .views import DiagnosticQuestionViewSet, DiagnosticSessionViewSet

router = DefaultRouter()
router.register("diagnosis/questions", DiagnosticQuestionViewSet, basename="diagnostic-question")
router.register("diagnosis/sessions", DiagnosticSessionViewSet, basename="diagnostic-session")

urlpatterns = router.urls
