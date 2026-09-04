from django.urls import path

from .views import CompleteOnboardingView, MeView, RegisterView

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path(
        "auth/onboarding/complete/",
        CompleteOnboardingView.as_view(),
        name="auth-onboarding-complete",
    ),
]
