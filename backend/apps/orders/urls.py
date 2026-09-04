from rest_framework.routers import DefaultRouter

from .views import OrderViewSet, ReviewViewSet

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")
router.register("reviews", ReviewViewSet, basename="review")

urlpatterns = router.urls
