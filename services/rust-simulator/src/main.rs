use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

mod db;
mod kafka;
mod models;
mod observe;
mod simulator;
mod transformer;

#[derive(Parser)]
#[command(name = "zendash-simulator", about = "AI agent event simulator and transformer")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate historical agent events into TimescaleDB and publish to Kafka
    Simulate {
        /// Also start the transformer and real-time mode after simulation
        #[arg(long)]
        then_serve: bool,
    },
    /// Consume events from Kafka and write baked tables to PostgreSQL
    #[cfg(feature = "kafka")]
    Transform,
    /// Run everything: simulate history, start transformer, generate real-time events
    All,

    /// Seed 3 days of history, then poll new sessions every 30s. Lightweight dev mode.
    Poll,

    // --- Observation tools ---

    /// Show TimescaleDB stats: event counts, session breakdown, date range
    Status,
    /// Show Kafka topic stats: partition offsets, consumer lag, message counts
    KafkaMonitor,
    /// Show PostgreSQL baked table stats: row counts, aggregated metrics, quality
    Verify,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("zendash_simulator=info".parse()?))
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Simulate { then_serve } => {
            tracing::info!("connecting to TimescaleDB...");
            let tsdb = db::timescale::connect_and_migrate().await?;

            tracing::info!("running simulator...");
            simulator::run_historical(&tsdb).await?;

            if then_serve {
                tracing::info!("starting transformer and real-time mode...");
                run_all_after_simulate(tsdb).await?;
            }
        }
        #[cfg(feature = "kafka")]
        Commands::Transform => {
            tracing::info!("connecting to PostgreSQL...");
            let pg = db::postgres::connect_and_migrate().await?;

            tracing::info!("starting transformer...");
            transformer::run(&pg).await?;
        }
        Commands::All => {
            tracing::info!("connecting to TimescaleDB...");
            let tsdb = db::timescale::connect_and_migrate().await?;

            tracing::info!("running simulator...");
            simulator::run_historical(&tsdb).await?;

            run_all_after_simulate(tsdb).await?;
        }
        Commands::Poll => {
            tracing::info!("connecting to TimescaleDB...");
            let tsdb = db::timescale::connect_and_migrate().await?;

            tracing::info!("seeding 3 days of history...");
            simulator::run_seed(&tsdb, 3, 300).await?;

            tracing::info!("connecting to PostgreSQL...");
            let pg = db::postgres::connect_and_migrate().await?;

            tracing::info!("copying reference data...");
            transformer::copy_reference_data(&tsdb, &pg).await?;

            tracing::info!("backfilling baked tables...");
            simulator::backfill_to_postgres(&tsdb, &pg).await?;

            tracing::info!("polling: new sessions every 30s...");
            simulator::run_poll(&tsdb, &pg).await?;
        }
        Commands::Status => observe::status().await?,
        Commands::KafkaMonitor => observe::kafka_monitor().await?,
        Commands::Verify => observe::verify().await?,
    }

    Ok(())
}

async fn run_all_after_simulate(tsdb: sqlx::PgPool) -> anyhow::Result<()> {
    tracing::info!("connecting to PostgreSQL...");
    let pg = db::postgres::connect_and_migrate().await?;

    tracing::info!("copying reference data to PostgreSQL...");
    transformer::copy_reference_data(&tsdb, &pg).await?;

    #[cfg(feature = "kafka")]
    {
        let pg_clone = pg.clone();
        let transformer_handle = tokio::spawn(async move {
            if let Err(e) = transformer::run(&pg_clone).await {
                tracing::error!("transformer error: {}", e);
            }
        });

        tracing::info!("starting real-time event generation...");
        let realtime_handle = tokio::spawn(async move {
            if let Err(e) = simulator::run_realtime(&tsdb).await {
                tracing::error!("realtime simulator error: {}", e);
            }
        });

        tokio::select! {
            _ = transformer_handle => tracing::warn!("transformer stopped"),
            _ = realtime_handle => tracing::warn!("realtime generator stopped"),
            _ = tokio::signal::ctrl_c() => tracing::info!("shutting down..."),
        }
    }

    #[cfg(not(feature = "kafka"))]
    {
        tracing::info!("starting real-time event generation (no kafka)...");
        let realtime_handle = tokio::spawn(async move {
            if let Err(e) = simulator::run_realtime(&tsdb).await {
                tracing::error!("realtime simulator error: {}", e);
            }
        });

        tokio::select! {
            _ = realtime_handle => tracing::warn!("realtime generator stopped"),
            _ = tokio::signal::ctrl_c() => tracing::info!("shutting down..."),
        }
    }

    Ok(())
}
