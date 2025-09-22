#!/bin/bash

# Near Me Development Setup Script

echo "🚀 Setting up Near Me development environment..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Start databases
echo "🗄️ Starting development databases..."
cd database
docker-compose up -d
cd ..

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Install dependencies
npm install

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from template. Please update with your configuration."
fi

# Build backend
npm run build

cd ..

echo "✅ Development environment setup complete!"
echo ""
echo "📱 Next steps:"
echo "1. Update backend/.env with your configuration"
echo "2. For iOS: Open NearMe.xcodeproj in Xcode"
echo "3. For Android: Open android/ folder in Android Studio"
echo "4. Start backend: cd backend && npm run dev"
echo ""
echo "🔗 Useful commands:"
echo "- Start databases: cd database && docker-compose up -d"
echo "- Stop databases: cd database && docker-compose down"
echo "- Backend dev server: cd backend && npm run dev"
echo "- Backend tests: cd backend && npm test"