from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0006_alter_storeproduct_category"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StoreProductImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="store-products/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="gallery", to="catalog.storeproduct")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.CreateModel(
            name="StoreProductReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("product_id_snapshot", models.CharField(max_length=64)),
                ("product_title", models.CharField(max_length=140)),
                ("product_price", models.PositiveIntegerField(default=0)),
                ("product_category", models.CharField(blank=True, max_length=40)),
                ("product_image", models.TextField(blank=True)),
                ("seller_id_snapshot", models.CharField(blank=True, max_length=64)),
                ("seller_name", models.CharField(max_length=140)),
                ("seller_email", models.EmailField(blank=True, max_length=254)),
                ("seller_phone", models.CharField(blank=True, max_length=40)),
                ("seller_role", models.CharField(blank=True, max_length=40)),
                ("reporter_name", models.CharField(max_length=140)),
                ("reporter_email", models.EmailField(blank=True, max_length=254)),
                ("reason", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("priority", models.CharField(choices=[("Alta", "Alta"), ("Media", "Media"), ("Baja", "Baja")], default="Media", max_length=10)),
                ("status", models.CharField(choices=[("pendiente", "Pendiente"), ("en_revision", "En revisión"), ("resuelto", "Resuelto"), ("desestimado", "Desestimado")], default="pendiente", max_length=20)),
                ("admin_response", models.TextField(blank=True)),
                ("admin_name", models.CharField(blank=True, max_length=140)),
                ("admin_responded_at", models.DateTimeField(blank=True, null=True)),
                ("action_taken", models.CharField(default="ninguna", max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reports", to="catalog.storeproduct")),
                ("reporter", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
