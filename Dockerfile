# Build Stage for React
FROM node:18-alpine as build-step
WORKDIR /app
COPY ./client/package*.json ./
RUN npm install
COPY ./client ./
RUN npm run build

# Production Stage with Python
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY ./server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY ./server .

# Copy Built Frontend Assets from build-step
# Place them in /app/static for simpler access
COPY --from=build-step /app/dist ./static

# Expose port
EXPOSE 8000

# Run Command
# Run Command (Use PORT env var if available)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
