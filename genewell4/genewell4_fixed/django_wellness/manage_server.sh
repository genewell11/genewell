#!/bin/bash
cd "$(dirname "$0")"
python manage.py migrate --run-syncdb 2>&1
python manage.py runserver 0.0.0.0:8000
