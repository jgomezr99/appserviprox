from django.contrib import admin

from .models import Order, OrderEvent, Review


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "professional", "status", "scheduled_for", "final_price")
    list_filter = ("status",)
    search_fields = ("client__email", "professional__display_name")
    inlines = [OrderEventInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("order", "rating", "created_at")
    list_filter = ("rating",)
