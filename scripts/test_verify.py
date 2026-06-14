import subprocess, json, time

BASE = "http://127.0.0.1:3000"

def api(method, path, data=None):
    url = f"{BASE}{path}"
    args = ["curl", "-s"]
    if method != "GET": args += ["-X", method]
    args += [url, "-H", "Content-Type: application/json"]
    if data: args += ["-d", json.dumps(data, ensure_ascii=False)]
    r = subprocess.run(args, capture_output=True, text=True)
    return json.loads(r.stdout)

def api_stream(path, data):
    url = f"{BASE}{path}"
    r = subprocess.run(["curl", "-s", "-N", "-X", "POST", url,
        "-H", "Content-Type: application/json",
        "-d", json.dumps(data, ensure_ascii=False),
        "--max-time", "40"], capture_output=True, text=True)
    lines = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
    if not lines: return None, ""
    deltas = []; final = None
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get("type") == "delta": deltas.append(ev["delta"])
            elif ev.get("type") == "final": final = ev
        except: pass
    return final, "".join(deltas)

rounds = [
    "孩子写作业倒是不慢，但是一让他多做一点就炸。",
    "学校作业大概一个小时就写完了，我想让他再背点单词。",
    "他就说我永远不让他休息，写完这个还有那个。",
    "我确实会在他写完后说既然写完了就把背诵也做了。",
    "他说他知道写完也不会结束，所以有时候故意写慢。",
]

c = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
cid = c["data"]["conversationId"]
print("conv=" + cid)

cards_found = 0
for ri, pt in enumerate(rounds):
    final, text = api_stream("/api/problem/answer/stream", {
        "conversationId": cid, "round": ri+1, "inputMode": "text", "text": pt
    })
    if final is None:
        print("  R{}: NO RESPONSE".format(ri+1))
        continue
    na = "?"
    if final.get("data"):
        na = final["data"].get("nextAction", "?")
    has_card = "<!--CARD_JSON-->" in text
    if has_card: cards_found += 1
    cm = " [CARD]" if has_card else ""
    print("  R{} | na={}{} | {}c".format(ri+1, na, cm, len(text)))
    print("       {}...".format(text[:100]))
    if has_card:
        idx = text.index("<!--CARD_JSON-->")
        card_part = text[idx+17:idx+300]
        print("       CARD: {}".format(card_part))
        is_confirm = na == "confirm_generate_card"
        print("       na_is_confirm={}".format(is_confirm))
    time.sleep(0.3)

print("\nCards triggered: {}/5".format(cards_found))

print("\n--- Generate understanding card ---")
card = api("POST", "/api/understanding/generate", {"conversationId": cid})
print("card ok={}".format(card["ok"]))
sections = card["data"]["card"]["sections"]
print("sections={}".format(len(sections)))
for s in sections:
    body = s.get("body","")
    if isinstance(body, list): body = "|".join(body)
    print("  {}: {}c | {}...".format(s["id"], len(body), body[:80]))
