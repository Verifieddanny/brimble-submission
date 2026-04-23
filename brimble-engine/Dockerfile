FROM oven/bun:latest

# Install Docker CLI, Git, Railpack
RUN apt-get update && apt-get install -y docker.io git curl
RUN curl -fsSL https://railpack.com/install.sh | sh

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .

# Generate migrations
RUN bunx drizzle-kit generate

EXPOSE 8080
CMD ["bun", "start"]