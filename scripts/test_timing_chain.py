"""Timing breakdown: TTFB vs generation + full chain."""
import subprocess, json, time

BASE = "http://127.0.0.1:3000"

def api_raw_stream(path, data):
    """Returns TTFB, first token time, total time."""
    url = f"{BASE}{path}"
    t_start = time.time()
    # Use --no-buffer to get raw stream
    r = subprocess.run(
        ["curl", "-s", "--no-buffer", "-N", "-X", "POST", url,
         "-H", "Content-Type: application/json",
         "-d", json.dumps(data, ensure_ascii=False),
         "--max-time", "40"],
        capture_output=True, text=True)
    t_total = time.time() - t_start
    lines = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
    return t_total, lines

def api(method, path, data=None):
    url = f"{BASE}{path}"
    args = ["curl", "-s"]
    if method != "GET": args += ["-X", method]
    args += [url, "-H", "Content-Type: application/json"]
    if data: args += ["-d", json.dumps(data, ensure_ascii=False)]
    t0 = time.time()
    r = subprocess.run(args, capture_output=True, text=True)
    elapsed = time.time() - t0
    return json.loads(r.stdout), elapsed

print("=" * 70)
print("TIMING BREAKDOWN + FULL CHAIN TEST")
print("=" * 70)

# Step 1: Start conv
c, t0 = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
cid = c["data"]["conversationId"]
print(f"\nconv={cid}")

# Step 2: 5 rounds of streaming, measure TTFB
print("\n--- 5 ROUNDS STREAM TIMING ---")
times = []
for ri in range(1, 6):
    pt = f"round{ri} math procrastination phone"
    t_total, lines = api_raw_stream("/api/problem/answer/stream",
        {"conversationId": cid, "round": ri, "inputMode": "text", "text": pt})
    
    t_first_delta = None
    text_len = 0
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get("type") == "start" and t_first_delta is None:
                # start event comes quickly, but real first text is delta
                pass
            elif ev.get("type") == "delta" and t_first_delta is None:
                # Can't measure per-line time from bulk capture
                pass
        except:
            pass
    
    # Parse final event
    final = None
    all_deltas = []
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get("type") == "delta": all_deltas.append(ev["delta"])
            elif ev.get("type") == "final": final = ev
        except: pass
    text = "".join(all_deltas)
    na = "?"
    if final and final.get("data"):
        na = final["data"].get("nextAction", "?")
    has_card = "<!--CARD_JSON-->" in text
    
    print(f"  R{ri}: {t_total:.1f}s | {len(text)}c | na={na}" + (" [CARD]" if has_card else ""))
    times.append(t_total)

avg_round = sum(times)/len(times)
print(f"\n  Avg round: {avg_round:.1f}s")

# Step 3: Card generation
print("\n--- UNDERSTANDING CARD ---")
card, ct0 = api("POST", "/api/understanding/generate", {"conversationId": cid})
print(f"  gen: {ct0:.1f}s | ok={card.get('ok')}")
ci = card["data"]["cardId"]

# Step 4: Feedback (accurate)
print("\n--- FEEDBACK: accurate ---")
fb1, t1 = api("POST", "/api/understanding/feedback",
    {"conversationId": cid, "cardId": ci, "feedbackType": "accurate"})
print(f"  accurate: {t1:.1f}s | updated={fb1['data']['updated']}")

# Step 5: Feedback (add_detail)  
print("\n--- FEEDBACK: add_detail ---")
fb2, t2 = api("POST", "/api/understanding/feedback",
    {"conversationId": cid, "cardId": ci, "feedbackType": "add_detail",
     "text": "not all math, only geometry"})
print(f"  add_detail: {t2:.1f}s | updated={fb2['data']['updated']}")

# Step 6: Feedback (partially_inaccurate)
print("\n--- FEEDBACK: partially_inaccurate ---")
fb3, t3 = api("POST", "/api/understanding/feedback",
    {"conversationId": cid, "cardId": ci, "feedbackType": "partially_inaccurate",
     "text": "actually Chinese homework too"})
print(f"  partial: {t3:.1f}s | updated={fb3['data']['updated']}")

# Step 7: Feedback (edit)
print("\n--- FEEDBACK: edit ---")
fb4, t4 = api("POST", "/api/understanding/feedback",
    {"conversationId": cid, "cardId": ci, "feedbackType": "edit",
     "text": "dislikes math teacher not math subject"})
print(f"  edit: {t4:.1f}s | updated={fb4['data']['updated']}")

# Step 8: Advice card
print("\n--- ADVICE CARD ---")
adv, ta = api("POST", "/api/advice/generate", {"conversationId": cid, "cardId": ci})
print(f"  gen: {ta:.1f}s | ok={adv.get('ok')}")

# Step 9: Archive draft
print("\n--- ARCHIVE DRAFT ---")
arch, td = api("GET", f"/api/archive/draft?conversationId={cid}&cardId={ci}")
print(f"  draft: {td:.1f}s | ok={arch.get('ok')}")

# Step 10: Confirm archive
print("\n--- ARCHIVE CONFIRM ---")
conf, tco = api("POST", "/api/archive/confirm", {"conversationId": cid, "archive": arch["data"]})
print(f"  confirm: {tco:.1f}s | memoryStatus={conf['data']['memoryWriteStatus']}")

# Step 11: Profile snapshot
print("\n--- PROFILE SNAPSHOT ---")
prof, tp = api("GET", "/api/profile/snapshot?familyId=f_demo&childId=c_demo")
print(f"  profile: {tp:.1f}s | ok={prof.get('ok')}")
lc = prof.get("data", {}).get("latestUnderstandingCard")
if lc:
    print(f"  latestCard: {lc.get('title','?')[:30]}")

# Summary
print("\n" + "=" * 70)
print("CHAIN TIMING SUMMARY")
print("=" * 70)
print(f" 5 rounds streaming:  {sum(times):.0f}s total ({avg_round:.1f}s avg)")
print(f" Card generation:     {ct0:.1f}s")
print(f" Feedback accurate:   {t1:.1f}s")
print(f" Feedback add_detail: {t2:.1f}s")
print(f" Feedback partial:    {t3:.1f}s")
print(f" Feedback edit:       {t4:.1f}s")
print(f" Advice card:         {ta:.1f}s")
print(f" Archive draft:       {td:.1f}s")
print(f" Archive confirm:     {tco:.1f}s")
print(f" Profile snapshot:    {tp:.1f}s")
total_chain = sum(times) + ct0 + t2 + ta + td + tco + tp
print(f"\n Total end-to-end:   {total_chain:.0f}s")
