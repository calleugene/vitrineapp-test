FROM golang:1.25-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /analytics .
FROM alpine:3.22
COPY --from=build /analytics /analytics
EXPOSE 8085
ENTRYPOINT ["/analytics"]
