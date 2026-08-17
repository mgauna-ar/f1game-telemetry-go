.PHONY: build run dev test lint clean help fmt

BINARY_NAME=f1telemetry
BUILD_DIR=bin

## help: Show this help message
help:
	@echo 'Usage:'
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':'

## build: Build the binary
build:
	go build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server

## run: Build and run the server
run: build
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

## lint: Run go vet
lint:
	go vet ./...

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
