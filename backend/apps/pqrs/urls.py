from rest_framework.routers import DefaultRouter
from .views import PQRViewSet, AppProblemViewSet

router = DefaultRouter()
router.register("pqrs", PQRViewSet, basename="pqr")
router.register("app-problems", AppProblemViewSet, basename="app-problem")

urlpatterns = router.urls

