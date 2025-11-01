FROM python:3.11-slim

WORKDIR /engine
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# ビルドに必要なツール
RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential ca-certificates make \
  && rm -rf /var/lib/apt/lists/*

# やねうら王の取得＆ビルド（モダンx86_64向け）
RUN git clone --depth=1 https://github.com/yaneurao/YaneuraOu.git /tmp/YaneuraOu \
  && cd /tmp/YaneuraOu/source \
  && make build ARCH=x86-64-modern COMPILER=gcc \
  && cp YaneuraOu-by-gcc /usr/local/bin/yaneuraou \
  && chmod +x /usr/local/bin/yaneuraou \
  && rm -rf /tmp/YaneuraOu

# Python 依存
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# アプリ本体
COPY engine_server.py ./engine_server.py

EXPOSE 8081
CMD ["uvicorn", "engine_server:app", "--host", "0.0.0.0", "--port", "8081", "--reload"]
