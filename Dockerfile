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
# We place them in a client/dist folder relative to /app/server logic
# The python code expects ../client/dist so we structure:
# /app/server (current WORKDIR)
# /app/client/dist
COPY --from=build-step /app/dist ../client/dist

# Expose port
EXPOSE 8000

# Run Command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
