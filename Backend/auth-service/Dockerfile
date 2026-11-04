FROM golang:1.25 AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/auth-service .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -g 65532 nonroot \
    && adduser -D -H -u 65532 -G nonroot nonroot
COPY --from=build /out/auth-service /auth-service
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/auth-service"]
