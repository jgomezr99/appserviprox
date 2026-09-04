from rest_framework import permissions, viewsets

from .models import Household
from .serializers import HouseholdSerializer


class HouseholdViewSet(viewsets.ModelViewSet):
    queryset = Household.objects.none()
    serializer_class = HouseholdSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Household.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
