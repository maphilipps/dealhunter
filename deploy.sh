#!/bin/bash

# DealHunter Production Deployment Script
#
# This script handles the deployment of DealHunter to a production environment
# using Docker Compose.
#
# Usage:
#   ./deploy.sh [command]
#
# Commands:
#   start    - Start all services
#   stop     - Stop all services
#   restart  - Restart all services
#   rebuild  - Rebuild and restart all services
#   logs     - Show logs from all services
#   status   - Show status of all services
#   migrate  - Run database migrations
#   help     - Show this help message

set -e

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is available
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi

    # Check if .env.production exists
    if [ ! -f "$ENV_FILE" ]; then
        print_error ".env.production file not found!"
        print_info "Please create .env.production based on .env.production.example"
        exit 1
    fi

    print_info "Prerequisites check passed ✓"
}

# Start services
start_services() {
    print_info "Starting DealHunter services..."
    check_prerequisites
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    print_info "Services started successfully ✓"
    print_info "App available at: http://localhost:3000"
}

# Stop services
stop_services() {
    print_info "Stopping DealHunter services..."
    docker compose -f "$COMPOSE_FILE" down
    print_info "Services stopped successfully ✓"
}

# Restart services
restart_services() {
    print_info "Restarting DealHunter services..."
    stop_services
    start_services
}

# Rebuild and restart services
rebuild_services() {
    print_info "Rebuilding and restarting DealHunter services..."
    check_prerequisites
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    print_info "Services rebuilt and started successfully ✓"
}

# Show logs
show_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f
}

# Show status
show_status() {
    print_info "DealHunter Services Status:"
    docker compose -f "$COMPOSE_FILE" ps
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations..."
    check_prerequisites

    # Wait for database to be ready
    print_info "Waiting for database to be ready..."
    sleep 5

    # Run migrations via the app container
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec app npx drizzle-kit push
    print_info "Migrations completed successfully ✓"
}

# Show help
show_help() {
    echo "DealHunter Production Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Start all services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  rebuild  - Rebuild and restart all services"
    echo "  logs     - Show logs from all services"
    echo "  status   - Show status of all services"
    echo "  migrate  - Run database migrations"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh start      # Start the application"
    echo "  ./deploy.sh logs       # View application logs"
    echo "  ./deploy.sh rebuild    # Rebuild after code changes"
}

# Main script logic
case "${1:-help}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    rebuild)
        rebuild_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    migrate)
        run_migrations
        ;;
    help|*)
        show_help
        ;;
esac
