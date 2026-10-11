FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o exhibit-flow .

FROM alpine:3.21
WORKDIR /app
COPY --from=builder /app/exhibit-flow ./exhibit-flow
EXPOSE 8091
CMD ["./exhibit-flow"]
