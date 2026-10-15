from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AdminPaymentListView, OrderViewSet, ReviewViewSet, WompiEventsView

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")
router.register("reviews", ReviewViewSet, basename="review")

urlpatterns = [
    path("payments/wompi/events/", WompiEventsView.as_view(), name="wompi-events"),
    path("admin/payments/", AdminPaymentListView.as_view(), name="admin-payments"),
] + router.urls
