import os
from pathlib import Path
from dotenv import load_dotenv
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv()

# SECURITY WARNING: keep the secret key used in production secret!
#SECRET_KEY = 'django-insecure-ae)mt582mhtd2dv(#$2a#_+%y-i+fz$3l)n+nln5rd0r%t85lf'
SECRET_KEY = os.getenv('SECRET_KEY')

# Vérification de sécurité
if not SECRET_KEY:
    raise ValueError("SECRET_KEY not found in environment variables")

# SECURITY WARNING: don't run with debug turned on in production!
# Lu dans le .env (DEBUG=False en production : une page d'erreur de debug montre des valeurs internes)
DEBUG = os.getenv('DEBUG', 'True').strip().lower() in ('1', 'true', 'yes', 'on')

USE_X_FORWARDED_HOST = True
# nginx transmet X-Forwarded-Proto : derrière HTTPS, Django sait que la requête est sécurisée
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Noms et adresses acceptés, séparés par des virgules (.env). Pour ouvrir le site depuis un téléphone du même
# réseau, ajouter l'adresse IP locale du PC, par exemple : ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.20
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'googlesheet',
    'profiles',
    'accounts',
    'corsheaders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
]

ROOT_URLCONF = 'overfolio.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


WSGI_APPLICATION = 'overfolio.wsgi.application'


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'overfoliodb'),
        'USER': os.environ.get('POSTGRES_USER', 'overfoliouser'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'overfoliopwd'),
        'HOST': os.environ.get('DB_HOST', 'db'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# CORS Configuration
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173'
).split(',')

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# REST Framework (une seule définition : une seconde écrasait la première)
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    # Lecteurs (parsers) par défaut de DRF : JSON, formulaire, multipart (comportement inchangé)
    # API publique : sans connexion, le site marche comme avant (profil et données du site)
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    # Session Django (connexion avec Google) : avec une session ouverte, les requêtes qui modifient
    # exigent le jeton CSRF (en-tête X-CSRFToken, envoyé par frontend/src/lib/api.js)
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# Session et CSRF (connexion avec Google)
# COOKIE_SECURE=True en production (site servi en HTTPS) : cookies envoyés seulement en HTTPS
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'False').strip().lower() in ('1', 'true', 'yes', 'on')
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'  # Lax : le cookie suit le retour de Google (navigation de premier niveau)
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30  # 30 jours
# Origines acceptées pour les requêtes qui modifient (le proxy de Vite change l'hôte : son origine doit y être)
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CSRF_TRUSTED_ORIGINS', ','.join(CORS_ALLOWED_ORIGINS)).split(',')
    if origin.strip()
]

# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Optionnel : dossiers statiques supplémentaires
STATICFILES_DIRS = [
    BASE_DIR / 'static',
] if (BASE_DIR / 'static').exists() else []

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
