# ===== Stage 1: build YaneuraOu =====
FROM ubuntu:20.04 AS builder
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git make gcc-9 g++-9 binutils file patch perl \
 && ln -sf /usr/bin/gcc-9 /usr/bin/gcc \
 && ln -sf /usr/bin/g++-9 /usr/bin/g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone --depth=1 https://github.com/yaneurao/YaneuraOu.git YaneuraOu
WORKDIR /build/YaneuraOu/source

RUN set -eux; \
  # Makefile の末尾に強制追記（正規表現は使わない）
  printf '\n# ==== forced by Docker build ====\n'        >> Makefile; \
  printf 'LINK := g++\n'                                >> Makefile; \
  printf 'LD   := g++\n'                                >> Makefile; \
  printf 'LIBS += -Wl,--no-as-needed -lstdc++ -lm -lpthread -ldl\n' >> Makefile; \
  \
  echo "== build try #1 (ARCH=x86-64) =="; \
  ( make -j"$(nproc)" ARCH=x86-64 COMPILER=gcc \
      CXX=g++ LINK=g++ LD=g++ V=1 \
      CXXFLAGS="-O3 -pipe -pthread -fno-pie -fPIC" \
      LDFLAGS="-no-pie -pthread" \
      YaneuraOu-by-gcc \
    || echo "[warn] try #1 failed" ); \
  echo "== build try #2 (ARCH=x86-64-modern) =="; \
  ( make -j"$(nproc)" ARCH=x86-64-modern COMPILER=gcc \
      CXX=g++ LINK=g++ LD=g++ V=1 \
      CXXFLAGS="-O3 -pipe -pthread -fno-pie -fPIC" \
      LDFLAGS="-no-pie -pthread" \
      YaneuraOu-by-gcc \
    || echo "[warn] try #2 failed" ); \
  echo "== pick binary =="; \
  BIN=""; for f in YaneuraOu-by-gcc YaneuraOu; do [ -x "$f" ] && BIN="$f" && break; done; \
  [ -n "$BIN" ] || { echo "no binary"; exit 2; }; \
  install -m 0755 "$BIN" /usr/local/bin/yaneuraou

RUN apt-get update && apt-get install -y --no-install-recommends supervisor && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /etc/supervisor/conf.d
COPY supervisord-engine.conf /etc/supervisor/conf.d/engine.conf
CMD ["supervisord","-n","-c","/etc/supervisor/supervisord.conf"]