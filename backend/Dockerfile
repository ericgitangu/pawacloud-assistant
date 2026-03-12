# multi-stage — compiles Rust PyO3 in builder, keeps runtime image slim

FROM python:3.12-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential && \
    rm -rf /var/lib/apt/lists/*

# rustup minimal profile — only need compiler + cargo
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

RUN pip install --no-cache-dir maturin

WORKDIR /build
COPY rust-core/ ./rust-core/

WORKDIR /build/rust-core
RUN maturin build --release --find-interpreter

# --- runtime ---
FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# grab the compiled wheel before anything else — layer caching
COPY --from=builder /build/rust-core/target/wheels/*.whl /tmp/wheels/
RUN pip install --no-cache-dir /tmp/wheels/*.whl && rm -rf /tmp/wheels

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
