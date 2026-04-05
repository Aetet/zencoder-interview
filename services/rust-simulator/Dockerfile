FROM rust:1-bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev cmake build-essential librdkafka-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock* ./
COPY src/ ./src/
COPY migrations/ ./migrations/

RUN cargo build --release --features kafka

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 librdkafka1 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/zendash-simulator /usr/local/bin/

ENTRYPOINT ["zendash-simulator"]
CMD ["all"]
