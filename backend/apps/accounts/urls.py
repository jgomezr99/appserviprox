from django.urls import path

from .views import (
    BecomeClientView,
    BecomeProfessionalView,
    CompleteOnboardingView,
    ConfirmPasswordResetView,
    MeView,
    RegisterView,
    RequestPasswordResetView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/password-reset/request/", RequestPasswordResetView.as_view(), name="password-reset-request"),
    path("auth/password-reset/confirm/", ConfirmPasswordResetView.as_view(), name="password-reset-confirm"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
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
]
