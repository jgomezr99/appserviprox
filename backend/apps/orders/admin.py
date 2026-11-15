from django.contrib import admin

from .models import Order, OrderEvent, Payment, Refund, Review, Withdrawal


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("reference", "order", "status", "payment_method", "amount_in_cents", "created_at")
    list_filter = ("status",)
    search_fields = ("reference", "client__email")


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ("id", "professional", "amount", "status", "created_at")
    list_filter = ("status",)


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "amount", "status", "created_at")
    list_filter = ("status",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "professional",
        "status",
        "payment_status",
        "scheduled_for",
        "final_price",
    )
    list_filter = ("status", "payment_status")
    search_fields = ("client__email", "professional__display_name")
    inlines = [OrderEventInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("order", "rating", "created_at")
    list_filter = ("rating",)
