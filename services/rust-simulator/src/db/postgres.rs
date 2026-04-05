use sqlx::PgPool;

pub async fn connect_and_migrate() -> anyhow::Result<PgPool> {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://zendash:zendash_dev@localhost:5432/zendash".into());

    let pool = PgPool::connect(&url).await?;
    sqlx::migrate!("./migrations/postgres")
        .run(&pool)
        .await?;

    tracing::info!("PostgreSQL migrations applied");
    Ok(pool)
}
