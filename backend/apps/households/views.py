from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import UserRole

from .models import Household
from .serializers import HouseholdSerializer


class HouseholdViewSet(viewsets.ModelViewSet):
    queryset = Household.objects.none()
    serializer_class = HouseholdSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != UserRole.CLIENT:
            return Household.objects.none()
        return Household.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.role != UserRole.CLIENT:
            raise PermissionDenied("Solo los clientes pueden gestionar viviendas.")
        serializer.save(owner=self.request.user)
