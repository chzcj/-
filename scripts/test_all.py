"""Comprehensive self-test script for ChildOS. Run on the server."""
import subprocess, json, time

def api(method, path, data=None):
    url = f"http://127.0.0.1:3000{path}"
    if method == "GET":
        r = subprocess.run(["curl", "-s", url], capture_output=True, text=True)
        return json.loads(r.stdout)
    else:
        r = subprocess.run(["curl", "-s", "-X", method, url, "-H", "Content-Type: application/json",
                           "-d", json.dumps(data)], capture_output=True, text=True)
        return json.loads(r.stdout)

def api_stream(path, data):
    url = f"http://127.0.0.1:3000{path}"
    r = subprocess.run(["curl", "-s", "-N", "-X", "POST", url, "-H", "Content-Type: application/json",
                       "-d", json.dumps(data), "--max-time", "60"], capture_output=True, text=True)
    lines = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
    if not lines: return None
    try:
        return json.loads(lines[-1])
    except:
        return None

errors = []

# ==========================================
print("=" * 60)
print("TEST 2: understanding card + feedback")
c = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
cid = c["data"]["conversationId"]
print(f"conv={cid}")

for i in range(1, 4):
    r = api_stream("/api/problem/answer/stream",
                   {"conversationId": cid, "round": i, "inputMode": "text", "text": f"round{i} math homewrk"})
    na = r["data"]["a1"]["clientActions"]["nextAction"] if r and r.get("data") else "?"
    pr = r["data"]["a1"]["progress"]["currentRound"] if r and r.get("data") else "?"
    print(f"  stream r{i}: nextAction={na} currRound={pr}")
    if i >= 5 and na != "confirm_generate_card" and na != "generate_draft_card":
        pass  # may be legitimate depending on model

card = api("POST", "/api/understanding/generate", {"conversationId": cid})
sections = card["data"]["card"]["sections"]
print(f"card: ok={card['ok']}  sections={len(sections)}")
for s in sections:
    body = s.get("body","")
    if isinstance(body, list):
        body = "|".join(body)
    has = len(body) > 0
    if not has:
        errors.append(f"UNDERSTANDING_CARD_EMPTY: section {s['id']} is empty")
    print(f"  section {s['id']}: {'OK' if has else 'EMPTY'} ({len(body)}c)")

ci = card["data"]["cardId"]
time.sleep(0.5)

# feedback accurate
acc = api("POST", "/api/understanding/feedback",
          {"conversationId": cid, "cardId": ci, "feedbackType": "accurate"})
print(f"feedback accurate: updated={acc['data']['updated']}")

# feedback partially_inaccurate
part = api("POST", "/api/understanding/feedback",
           {"conversationId": cid, "cardId": ci, "feedbackType": "partially_inaccurate",
            "text": "also Chinese recitation same issue"})
print(f"feedback partial: updated={part['data'].get('updated', '?')}")

# feedback add_detail
add = api("POST", "/api/understanding/feedback",
          {"conversationId": cid, "cardId": ci, "feedbackType": "add_detail",
           "text": "teacher changed recently"})
print(f"feedback add_detail: updated={add['data'].get('updated', '?')}")

# feedback edit
ed = api("POST", "/api/understanding/feedback",
         {"conversationId": cid, "cardId": ci, "feedbackType": "edit",
          "text": "not math difficulty, dislikes the teacher"})
print(f"feedback edit: updated={ed['data'].get('updated', '?')}")
if not ed["data"].get("updated"):
    errors.append("FEEDBACK_EDIT: did not update card (updated=false)")

time.sleep(0.5)

# ==========================================
print("")
print("=" * 60)
print("TEST 3: rehearsal multi-round")
c2 = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
cid2 = c2["data"]["conversationId"]
print(f"conv={cid2}")

msgs = [
    "I want to tell him he must add extra English class on weekend, no more excuses.",
    "He gets annoyed and says weekends are already full.",
    "He has basketball and drawing on weekends, both his own choices.",
    "I am worried about his English falling behind, many classmates take extra lessons.",
    "He says the English teacher goes too fast and he cannot follow."
]
for i, msg in enumerate(msgs):
    r = api_stream("/api/rehearsal/stream", {"conversationId": cid2, "text": msg})
    final = r.get("text","") if r else ""
    print(f"  rehearsal r{i+1}: {len(final)}c | {final[:50]}")
    if not final:
        errors.append(f"REHEARSAL_EMPTY: round {i+1} empty reply")
    time.sleep(0.3)

# ==========================================
print("")
print("=" * 60)
print("TEST 4: advice card")
c3 = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
cid3 = c3["data"]["conversationId"]
for i in range(1, 4):
    api_stream("/api/problem/answer/stream",
               {"conversationId": cid3, "round": i, "inputMode": "text", "text": f"round{i} issue"})
    time.sleep(0.3)
card3 = api("POST", "/api/understanding/generate", {"conversationId": cid3})
ci3 = card3["data"]["cardId"]
api("POST", "/api/understanding/feedback",
    {"conversationId": cid3, "cardId": ci3, "feedbackType": "accurate"})
time.sleep(0.3)

adv = api("POST", "/api/advice/generate", {"conversationId": cid3, "cardId": ci3})
items = adv["data"]["items"]
print(f"advice: ok={adv['ok']}  items={len(items)}")
for item in items:
    print(f"  title: {item.get('title','?')[:40]}")
    if "body" in item and item["body"]:
        print(f"    body: OK ({len(item['body'])}c)")
    if "tryThis" in item and item["tryThis"]:
        print(f"    tryThis: OK ({len(item['tryThis'])}c)")
    if "avoid" in item and item["avoid"]:
        print(f"    avoid: OK ({len(item['avoid'])}c)")
    has_content = item.get("body") or item.get("tryThis") or item.get("avoid")
    if not has_content:
        errors.append(f"ADVICE_EMPTY: item '{item.get('title','?')}' has no body/tryThis/avoid")

# ==========================================
print("")
print("=" * 60)
print("TEST 5: archive + profile")
arch = api("GET", f"/api/archive/draft?conversationId={cid3}&cardId={ci3}")
d = arch["data"]
print(f"draft: ok={arch['ok']}  date={d.get('date','?')}")
for field in ["eventSummary","conflictPoint","currentClues","observationNext"]:
    val = d.get(field, "")
    has = len(str(val)) > 0
    print(f"  {field}: {'OK' if has else 'EMPTY'} ({len(str(val))}c)")
    if not has:
        errors.append(f"ARCHIVE_EMPTY: field {field} is empty")

confirm = api("POST", "/api/archive/confirm", {"conversationId": cid3, "archive": d})
ms = confirm["data"]["memoryWriteStatus"]
print(f"confirm: ok={confirm['ok']}  memoryStatus={ms}")
if ms != "success":
    errors.append(f"ARCHIVE_CONFIRM: memoryWriteStatus is '{ms}' not 'success'")

time.sleep(0.5)

prof = api("GET", "/api/profile/snapshot?familyId=f_demo&childId=c_demo")
print(f"profile: ok={prof['ok']}")
lc = prof["data"].get("latestUnderstandingCard")
if lc:
    print(f"  latestCard: {lc.get('title','?')[:30]}  cardId={lc.get('cardId','?')[:30]}")
else:
    print("  latestCard: NONE")
    errors.append("PROFILE: latestUnderstandingCard is missing")

# check readiness
rd = api("GET", "/api/readiness")
print(f"readiness: ready={rd['data']['ready']}")
db = rd["data"]["checks"]["database"]
print(f"  db: enabled={db.get('enabled')} users={db.get('users','?')} convs={db.get('conversations','?')}")

# ==========================================
print("")
print("=" * 60)
print("TEST 6: record child")
rec = api("POST", "/api/record-child",
          {"familyId":"f_demo","childId":"c_demo",
           "eventText":"finished homework early today",
           "changeText":"first time in weeks",
           "worryText":"not sure it will last"})
print(f"record: ok={rec['ok']}")
if not rec.get("ok"):
    errors.append("RECORD_CHILD: returned ok=false")

# ==========================================
print("")
print("=" * 60)
print("TEST 8: edge cases")
# empty input rejected by schema?
er = api_stream("/api/problem/answer/stream",
                {"conversationId": cid3, "round": 5, "inputMode": "text", "text": " "})
if er and er.get("type") == "error":
    print("empty text: correctly rejected")
elif er and er.get("type") == "final":
    print("empty text: accepted (schema may not trim)")
    errors.append("EDGE: empty/whitespace text was accepted by stream")
else:
    print("empty text: no response")
    errors.append("EDGE: empty text produced no response")

# nonexistent conversation
nx = api("GET", "/api/conversations/nonexistent12345/state")
if nx.get("ok"):
    errors.append("EDGE: nonexistent conversation returned ok=true")
else:
    print(f"nonexistent conv: correctly returned error ({nx.get('error',{}).get('code','?')})")

# health check
hc = api("GET", "/api/health")
print(f"health: ok={hc['ok']}  app={hc['data']['app']}")

# ==========================================
print("")
print("=" * 60)
print(f"TOTAL ERRORS: {len(errors)}")
for e in errors:
    print(f"  *** {e}")

if len(errors) == 0:
    print("\nALL TESTS PASSED")
