from rest_framework.routers import DefaultRouter

from .views import ServiceCategoryViewSet, ServiceViewSet, StoreProductViewSet

router = DefaultRouter()
router.register("categories", ServiceCategoryViewSet, basename="category")
router.register("services", ServiceViewSet, basename="service")
router.register("store/products", StoreProductViewSet, basename="store-product")

urlpatterns = router.urls
