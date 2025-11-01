
# ==== forced by Docker build (clang) ====
COMPILER := clang
CXX      := clang++
LINK     := clang++
LD       := clang++
LIBS     += -Wl,--no-as-needed -lm -lpthread -ldl
