from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_hirings import (
    AdminHiringAssignView,
    AdminHiringCancelView,
    AdminHiringDetailView,
    AdminHiringListView,
    AdminHiringNoteView,
    AdminHiringPqrView,
    AdminHiringProfessionalsView,
    AdminHiringRequestsView,
    AdminHiringSummaryView,
)
from .finance_views import (
    AdminFinanceReportView,
    AdminPaymentConnectionView,
    AdminPaymentDetailView,
    AdminPaymentHealthView,
    AdminPaymentStatsView,
    AdminFinanceSummaryView,
    AdminPaymentListView,
    AdminPaymentVerifyView,
    AdminPayoutListView,
    AdminPayoutSettleView,
    AdminRefundListView,
    AdminRefundResolveView,
    AdminWithdrawalListView,
    AdminWithdrawalResolveView,
    ClientPaymentHistoryView,
    ClientPaymentReceiptView,
    PaymentHoldView,
    ProfessionalEarningsView,
    ProfessionalWithdrawalView,
)
from .views import OrderViewSet, ReviewViewSet, WompiEventsView

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")
router.register("reviews", ReviewViewSet, basename="review")

urlpatterns = [
    path("payments/wompi/events/", WompiEventsView.as_view(), name="wompi-events"),
    path("payments/history/", ClientPaymentHistoryView.as_view(), name="payment-history"),
    path("payments/<int:pk>/receipt/", ClientPaymentReceiptView.as_view(), name="payment-receipt"),
    path("payments/hold/", PaymentHoldView.as_view(), name="payment-hold"),
    path("professional/earnings/", ProfessionalEarningsView.as_view(), name="professional-earnings"),
    path("professional/withdrawals/", ProfessionalWithdrawalView.as_view(), name="professional-withdrawals"),
    path("admin/hirings/", AdminHiringListView.as_view(), name="admin-hirings"),
    path("admin/hirings/summary/", AdminHiringSummaryView.as_view(), name="admin-hirings-summary"),
    path("admin/hirings/requests/", AdminHiringRequestsView.as_view(), name="admin-hirings-requests"),
    path("admin/hirings/requests/<int:request_id>/professionals/", AdminHiringProfessionalsView.as_view(), name="admin-hirings-professionals"),
    path("admin/hirings/requests/<int:request_id>/assign/", AdminHiringAssignView.as_view(), name="admin-hirings-assign"),
    path("admin/hirings/<int:pk>/", AdminHiringDetailView.as_view(), name="admin-hiring-detail"),
    path("admin/hirings/<int:pk>/cancel/", AdminHiringCancelView.as_view(), name="admin-hiring-cancel"),
    path("admin/hirings/<int:pk>/notes/", AdminHiringNoteView.as_view(), name="admin-hiring-notes"),
    path("admin/hirings/<int:pk>/pqr/", AdminHiringPqrView.as_view(), name="admin-hiring-pqr"),
    path("admin/payments/health/", AdminPaymentHealthView.as_view(), name="admin-payment-health"),
    path("admin/payments/stats/", AdminPaymentStatsView.as_view(), name="admin-payment-stats"),
    path("admin/payments/test-connection/", AdminPaymentConnectionView.as_view(), name="admin-payment-connection"),
    path("admin/payments/", AdminPaymentListView.as_view(), name="admin-payments"),
    path("admin/payments/<int:pk>/", AdminPaymentDetailView.as_view(), name="admin-payment-detail"),
    path("admin/payments/<int:pk>/verify/", AdminPaymentVerifyView.as_view(), name="admin-payment-verify"),
    path("admin/finance/summary/", AdminFinanceSummaryView.as_view(), name="admin-finance-summary"),
    path("admin/finance/report/", AdminFinanceReportView.as_view(), name="admin-finance-report"),
    path("admin/payouts/", AdminPayoutListView.as_view(), name="admin-payouts"),
    path("admin/payouts/settle/", AdminPayoutSettleView.as_view(), name="admin-payouts-settle"),
    path("admin/withdrawals/", AdminWithdrawalListView.as_view(), name="admin-withdrawals"),
    path("admin/withdrawals/<int:pk>/resolve/", AdminWithdrawalResolveView.as_view(), name="admin-withdrawal-resolve"),
    path("admin/refunds/", AdminRefundListView.as_view(), name="admin-refunds"),
    path("admin/refunds/<int:pk>/resolve/", AdminRefundResolveView.as_view(), name="admin-refund-resolve"),
] + router.urls
