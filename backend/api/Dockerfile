# 既存のエンジンイメージをベースにする（yaneuraou・nn.bin・book入り）
FROM shogi_ai_learning-engine:latest

# Python最小セット
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/api/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY backend/api /app

# エンジン環境（必要に応じて調整可能）
ENV ENGINE_PATH=/usr/local/bin/yaneuraou \
    DEFAULT_BYOYOMI_MS=1000 \
    ENGINE_THREADS=4 \
    ENGINE_HASH_MB=1024 \
    ENGINE_USE_BOOK=true \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
