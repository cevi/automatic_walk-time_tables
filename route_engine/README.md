
# Query a Path

```bash
curl -s -XPOST 'http://localhost:8002/route' -H'Content-Type: application/json' --data-raw '{"locations": [{"lat": 47.32214, "lon":  8.47885}, {"lat": 47.31875, "lon": 8.48224}], "costing": "pedestrian"}'
```