from django.db.models import Count, Q
from rest_framework import viewsets

from .models import Service, ServiceCategory
from .serializers import (
    ServiceCategoryListSerializer,
    ServiceCategorySerializer,
    ServiceSerializer,
)


class ServiceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    search_fields = ["name", "description", "keywords"]
    serializer_class = ServiceCategorySerializer

    def get_queryset(self):
        return (
            ServiceCategory.objects.filter(is_active=True)
            .annotate(
                professionals_count=Count(
                    "professional_services",
                    filter=Q(professional_services__profile__is_active=True),
                    distinct=True,
                )
            )
            .prefetch_related("services")
            # El GROUP BY del annotate descarta Meta.ordering: lo reponemos para
            # que la paginacion de DRF sea estable.
            .order_by("sort_order", "name")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ServiceCategoryListSerializer
        return ServiceCategorySerializer


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServiceSerializer
    filterset_fields = ["category", "category__slug"]
    search_fields = ["name", "description"]
    queryset = Service.objects.filter(is_active=True).select_related("category")
