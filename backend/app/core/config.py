from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    strava_client_id: str
    strava_client_secret: str
    strava_redirect_uri: str
    strava_verify_token: str
    supabase_url: str
    supabase_service_key: str
    groq_api_key: str
    redis_url: str
    celery_broker_url: str
    sentry_dsn: str
    secret_key: str
    frontend_url: str
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
