from django.contrib import admin

from .models import Service, ServiceCategory


class ServiceInline(admin.TabularInline):
    model = Service
    extra = 0


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon_key", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ServiceInline]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price_min", "price_max", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name", "description")
