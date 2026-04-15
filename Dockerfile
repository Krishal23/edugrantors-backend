# ==========================================
# Stage 1: Build Stage
# ==========================================
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for building)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# ==========================================
# Stage 2: Production Stage
# ==========================================
FROM node:18-alpine AS production

# Set the working directory
WORKDIR /app

# Copy dependency files again
COPY package*.json ./

# Install ONLY production dependencies to keep the image small and secure
RUN npm install --omit=dev

# Copy compiled JavaScript files from the build stage (assuming output is 'dist')
COPY --from=builder /app/dist ./dist

# Copy static assets and templates (crucial for your EJS files and mailers)
COPY --from=builder /app/public ./public
COPY --from=builder /app/mails ./mails

# Expose the port your app runs on (matches your .env)
EXPOSE 8000

# Define the command to start the application
CMD ["node", "dist/server.js"]
