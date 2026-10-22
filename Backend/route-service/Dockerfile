FROM golang:1.25-alpine AS build
WORKDIR /src
COPY platform/ ./platform/
COPY route-service/ ./route-service/
WORKDIR /src/route-service
RUN CGO_ENABLED=0 go build -trimpath -o /server .
FROM alpine:3.22
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
USER app
COPY --from=build /server /server
ENTRYPOINT ["/server"]
