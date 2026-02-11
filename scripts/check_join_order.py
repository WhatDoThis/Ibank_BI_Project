"""join-order API 응답 확인 (workflows + test_deliveries_data, test_delivery_tracking, campaigns)."""
import json
import sys
from pathlib import Path

try:
    import urllib.request
except ImportError:
    print("urllib available")
    sys.exit(0)

body = json.dumps({
    "base_table": "workflows",
    "required_tables": ["test_deliveries_data", "test_delivery_tracking", "campaigns"],
}).encode()

req = urllib.request.Request(
    "http://localhost:5001/api/join-order",
    data=body,
    method="POST",
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode())
        jo = data.get("join_order") or []
        print("HTTP 200, join_order length:", len(jo))
        for i, s in enumerate(jo):
            ft = s.get("from_table")
            tt = s.get("to_table")
            t = s.get("table")
            print(f"  step{i}: table={t!r} from_table={ft!r} to_table={tt!r}")
        # MainArea 조건: joinOrder && joinOrder.length >= 1
        print("-> MainArea would use join_order:", bool(jo and len(jo) >= 1))
        pairs_from_order = [({"prevTable": s["from_table"], "currTable": s.get("table") or s.get("to_table")}) for s in jo if s.get("from_table")]
        print("-> join pairs from join_order:", pairs_from_order)
except urllib.error.HTTPError as e:
    print("HTTP error:", e.code, e.reason)
    try:
        body = e.read().decode()
        print("body:", body[:500])
    except Exception:
        pass
except Exception as e:
    print("error:", type(e).__name__, e)
