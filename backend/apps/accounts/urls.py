from django.urls import path

from .admin_views import (
    AdminActionView,
    AdminNotificationListView,
    AdminOverviewView,
    AdminRolesPermissionsView,
    AdminUsersListView,
)
from .platform_views import (
    AdminDeleteAccountView,
    AdminPlatformSettingsView,
    AdminSystemActionView,
    PublicPlatformSettingsView,
)
from .views import (
    BecomeClientView,
    BecomeProfessionalView,
    CompleteOnboardingView,
    ConfirmPasswordResetView,
    DeleteAccountView,
    MeView,
    RegisterView,
    RequestPasswordResetView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/password-reset/request/", RequestPasswordResetView.as_view(), name="password-reset-request"),
    path("auth/password-reset/confirm/", ConfirmPasswordResetView.as_view(), name="password-reset-confirm"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/me/delete/", DeleteAccountView.as_view(), name="auth-delete-account"),
    path(
        "auth/become-professional/",
        BecomeProfessionalView.as_view(),
        name="auth-become-professional",
    ),
    path(
        "auth/become-client/",
        BecomeClientView.as_view(),
        name="auth-become-client",
    ),
    path(
        "auth/onboarding/complete/",
        CompleteOnboardingView.as_view(),
        name="auth-onboarding-complete",
    ),
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/action/", AdminActionView.as_view(), name="admin-action"),
    path("platform/settings/", PublicPlatformSettingsView.as_view(), name="platform-settings"),
    path("admin/settings/", AdminPlatformSettingsView.as_view(), name="admin-settings"),
    path("admin/accounts/<str:kind>/<int:pk>/", AdminDeleteAccountView.as_view(), name="admin-delete-account"),
    path("admin/system-action/", AdminSystemActionView.as_view(), name="admin-system-action"),
    path("admin/users/", AdminUsersListView.as_view(), name="admin-users"),
    path("admin/roles/", AdminRolesPermissionsView.as_view(), name="admin-roles"),
    path("admin/notifications/", AdminNotificationListView.as_view(), name="admin-notifications"),
    path("notifications/", AdminNotificationListView.as_view(), name="notifications-list"),
]
