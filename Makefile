.PHONY: build run run-embedded build-frontend build-embedded build-all dev test test-short lint clean help fmt simulate install-hooks

BINARY_NAME=f1telemetry
BUILD_DIR=bin

VERSION ?= $(shell git describe --tags --always 2>/dev/null || echo dev)
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo none)
DATE ?= $(shell date -u +%Y-%m-%d)
LDFLAGS=-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.date=$(DATE)

## help: Show this help message
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':'

## build: Build the server binary
build:
	go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server

## build-frontend: Build the production React frontend
build-frontend:
	cd frontend && npm run build

## build-embedded: Build standalone single-binary with embedded frontend
build-embedded: build-frontend
	go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server

## build-all: Cross-compile standalone binaries for Windows, macOS, and Linux
build-all: build-frontend
	@mkdir -p $(BUILD_DIR)
	@go run ./scripts/build_windows_resources.go
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)_windows_amd64.exe ./cmd/server
	CGO_ENABLED=0 GOOS=windows GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)_windows_arm64.exe ./cmd/server
	@go run ./scripts/build_windows_resources.go -clean
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)_darwin_arm64 ./cmd/server
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)_darwin_amd64 ./cmd/server
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)_linux_amd64 ./cmd/server
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)_linux_arm64 ./cmd/server
	@echo "All standalone binaries built successfully in $(BUILD_DIR)/"

## run: Build and run the server
run: build
	./$(BUILD_DIR)/$(BINARY_NAME)

## run-embedded: Build standalone binary with embedded frontend and run it
run-embedded: build-embedded
	./$(BUILD_DIR)/$(BINARY_NAME)

## dev: Run with go run (development mode)
dev:
	go run ./cmd/server

## simulate: Run the telemetry packet simulator (e.g. make simulate SESSION=quali FORMAT=2025)
simulate:
	go run ./cmd/simulator -session $(or $(SESSION),$(F1T_SESSION_TYPE),race) -format $(or $(FORMAT),$(F1T_PACKET_FORMAT),2026)


## test: Run all tests with verbose output
test:
	go test ./... -v -race

## test-short: Run tests without verbose
test-short:
	go test ./... -race

## lint: Run golangci-lint (or go vet as fallback)
lint:
	golangci-lint run ./... || go vet ./...

## clean: Remove build artifacts
clean:
	rm -rf $(BUILD_DIR)

## fmt: Format Go code
fmt:
	go fmt ./...

## install-hooks: Install git pre-commit hooks
install-hooks:
	cp scripts/pre-commit.sh .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "Pre-commit hooks installed successfully!"
