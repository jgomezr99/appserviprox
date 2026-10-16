"""Solo Caddy alcanza este puerto en la red privada Docker."""
import os
bind = "0.0.0.0:8000"
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
worker_class = "gthread"
threads = 2
timeout = 60
graceful_timeout = 30
max_requests = 1000
max_requests_jitter = 100
accesslog = "-"
# No registrar query strings, cuerpos ni Authorization.
access_log_format = '%(t)s %(m)s %(U)s %(s)s %(L)s'
errorlog = "-"
capture_output = True
forwarded_allow_ips = "*"
