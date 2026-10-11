FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/visitor-service .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/visitor-service /visitor-service
USER nonroot:nonroot
EXPOSE 8088
ENTRYPOINT ["/visitor-service"]
