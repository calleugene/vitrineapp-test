FROM golang:1.25-alpine AS build
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /dashboard .
FROM alpine:3.22
COPY --from=build /dashboard /dashboard
EXPOSE 8084
ENTRYPOINT ["/dashboard"]
