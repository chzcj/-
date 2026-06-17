"""Full quality + timing test: 10 scenarios x 5 rounds + understanding card timing."""
import subprocess, json, time, re

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
    t0 = time.time()
    r = subprocess.run(["curl", "-s", "-N", "-X", "POST", url,
        "-H", "Content-Type: application/json",
        "-d", json.dumps(data, ensure_ascii=False),
        "--max-time", "60"], capture_output=True, text=True)
    elapsed = time.time() - t0
    lines = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
    if not lines: return None, "", elapsed
    deltas = []; final = None
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get("type") == "delta": deltas.append(ev["delta"])
            elif ev.get("type") == "final": final = ev
        except: pass
    return final, "".join(deltas), elapsed

WHOLE_SCENARIOS = [
    {
        "name": "S1_作业拖延-懒",
        "rounds": [
            "孩子就是懒，每天回家拖到八九点才开始写作业。",
            "不是写到一半卡住，是还没开始就一直玩手机，说等一会儿。",
            "催他就不耐烦，说知道了知道了别催了。",
            "数学明显比语文拖得久，语文背诵他基本不拖。",
            "他数学其实成绩还行，就是最近换了老师以后开始的。",
        ]
    },
    {
        "name": "S2_手机不停",
        "rounds": [
            "孩子被手机毁了，每天抱着不撒手，一说就吵。",
            "写完作业就拿手机，一玩就是两三个小时。",
            "主要是刷短视频，也有打游戏。",
            "周末更严重，起床就摸手机，早饭都不吃。",
            "如果说不给手机，他就说那我干嘛，又没别的事。",
        ]
    },
    {
        "name": "S3_补课抵触",
        "rounds": [
            "我想给他报个英语班，他死活不去，说周末已经排满了。",
            "他周末其实只有篮球和画画，都是他自己要报的。",
            "我自己英语不好，特别怕他掉队，班里好多同学都在补。",
            "他说英语老师讲太快，他跟不上。",
            "他说不想补课不是因为懒，是觉得周末真的不够用。",
        ]
    },
    {
        "name": "S4_顶嘴",
        "rounds": [
            "孩子太叛逆了，我一句话他就炸，根本不能沟通。",
            "我一般就是问他作业写了没，他就烦。",
            "我的原话一般是：作业写了吗？今天的任务都完成了吗？",
            "他说你每天只会问这个，不关心我别的。",
            "他的考试成绩最近降了，我从老师那知道的，他不跟我说。",
        ]
    },
    {
        "name": "S5_沉默",
        "rounds": [
            "孩子根本不跟我沟通，我问什么他都说不知道、随便。",
            "他放学回来就直接进房间，吃饭叫半天才出来。",
            "以前不这样，初二上学期开始的。",
            "他成绩其实还可以，班级前十。",
            "他说过：跟你说了你也不懂，说了也白说。",
        ]
    },
    {
        "name": "S6_无所谓",
        "rounds": [
            "孩子考砸了也不在乎，问他怎么样就说还行、无所谓。",
            "这次数学考了68分，之前都85以上的。",
            "他说我就是运气不好，下次能考好，但也不复习。",
            "他以前考不好会难过，现在完全没反应。",
            "我问他是不是题太难，他说不是难，是粗心。",
        ]
    },
    {
        "name": "S7_表面答应",
        "rounds": [
            "孩子每次都说知道了马上去做，但从来不动，就是敷衍我。",
            "我说完他立刻说知道了知道了，然后继续玩手机。",
            "如果我再说，他就沉默，但不做。",
            "他答应的时候表情挺烦的，好像希望我赶紧走。",
            "只有我在旁边盯着，他才真的开始写。",
        ]
    },
    {
        "name": "S8_加任务抵触",
        "rounds": [
            "孩子写作业倒是不慢，但是一让他多做一点就炸。",
            "学校作业大概一个小时就写完了，我想让他再背点单词。",
            "他就说我永远不让他休息，写完这个还有那个。",
            "我确实会在他写完后说既然写完了就把背诵也做了。",
            "他说他知道写完也不会结束，所以有时候故意写慢。",
        ]
    },
    {
        "name": "S9_家长崩溃",
        "rounds": [
            "我真的快被他气死了，我为他花了这么多钱补课，他一点都不争气。",
            "补课老师说他上课也在玩手机，我一个月花两千多。",
            "我跟他说我们为你做了这么多，你能不能争气一点。",
            "他就不说话，或者回房间关门。",
            "我承认我说话比较重，但我真的没办法了。",
        ]
    },
    {
        "name": "S10_考试焦虑",
        "rounds": [
            "孩子考试前特别紧张，但是从来不让我帮他复习。",
            "他说他自己可以，但不让我检查。",
            "我检查他背诵，他就开始烦，背两句就说都会了。",
            "他每次都说懂了，但考试就错很多。",
            "他说最烦我一题一题查他，感觉像审犯人。",
        ]
    },
]

all_times = []
all_rounds = 0
card_triggers = 0
card_gen_times = []
psych_q = 0
label_buy = 0
multi_q = 0
markdown = 0
no_response = 0

print("=" * 80)
print("FULL QUALITY + TIMING TEST (10 scenarios x 5 rounds)")
print("=" * 80)

for si, scenario in enumerate(WHOLE_SCENARIOS):
    print("\n" + "-" * 60)
    print("{} | {}".format(scenario["name"], scenario["rounds"][0][:40]))
    
    c = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
    cid = c["data"]["conversationId"]
    conv_start = time.time()
    
    scenario_has_card = False
    
    for ri, pt in enumerate(scenario["rounds"]):
        final, text, elapsed = api_stream("/api/problem/answer/stream", {
            "conversationId": cid, "round": ri+1,
            "inputMode": "text", "text": pt
        })
        
        all_rounds += 1
        all_times.append(elapsed)
        
        if final is None:
            no_response += 1
            print("  R{}: NO RESPONSE ({:.1f}s)".format(ri+1, elapsed))
            continue
        
        na = "?"
        if final.get("data"):
            na = final["data"].get("nextAction", "?")
        
        has_card = "<!--CARD_JSON-->" in text
        if has_card:
            card_triggers += 1
            scenario_has_card = True
        
        # Quality checks
        psych_pats = [r"是不是压力大", r"是不是逃避", r"是不是怕失败",
                      r"是不是没有内驱力", r"是不是心理有问题"]
        pq = 1 if any(re.search(p, text) for p in psych_pats) else 0
        psych_q += pq
        
        lb_pats = [r"他就是懒", r"他就是不配合", r"就是叛逆", r"就是不想学"]
        lb = 1 if any(re.search(p, text) for p in lb_pats) else 0
        label_buy += lb
        
        qm = text.count("?") + text.count("?")
        mq = 1 if qm > 2 else 0
        multi_q += mq
        
        md = 1 if "**" in text else 0
        markdown += md
        
        issues = [t for t, v in [("PSYCH", pq), ("LABEL", lb), ("MULTI_Q", mq), ("MD", md)] if v]
        
        status = "OK" if not issues else "ERR:{}".format(",".join(issues))
        cm = " [CARD]" if has_card else ""
        print("  R{:<2} {:<12} | {:<12} | {:.1f}s | {:<4}c{}".format(
            ri+1, status, na, elapsed, len(text), cm))
        print("       {}".format(text[:100].strip()))
        if has_card:
            idx = text.index("<!--CARD_JSON-->")
            card_str = text[idx+17:idx+250]
            print("       >> CARD: {}".format(card_str[:200]))
        
        time.sleep(0.2)
    
    conv_elapsed = time.time() - conv_start
    
    # If card triggered, measure understanding card generation
    card_gen_time = 0
    if scenario_has_card:
        print("\n  >>> Generating understanding card...")
        t0 = time.time()
        card_resp = api("POST", "/api/understanding/generate", {"conversationId": cid})
        card_gen_time = time.time() - t0
        card_gen_times.append(card_gen_time)
        ok = card_resp.get("ok", False)
        sec = len(card_resp.get("data", {}).get("card", {}).get("sections", []))
        mismisread = ""
        for s in card_resp.get("data", {}).get("card", {}).get("sections", []):
            if s["id"] == "parent_misread":
                body = s.get("body", "")
                if isinstance(body, list): body = "|".join(body)
                mismisread = body[:100]
        print("  Card gen: {:.1f}s | ok={} | sections={}".format(card_gen_time, ok, sec))
        print("  parent_misread: {}...".format(mismisread))

print("\n" + "=" * 80)
print("FINAL REPORT")
print("=" * 80)

avg_time = sum(all_times) / len(all_times) if all_times else 0
min_time = min(all_times) if all_times else 0
max_time = max(all_times) if all_times else 0

print("\n--- Timing ---")
print("Total rounds:       {}".format(all_rounds))
print("No response:        {}".format(no_response))
print("Avg round time:     {:.1f}s".format(avg_time))
print("Min round time:     {:.1f}s".format(min_time))
print("Max round time:     {:.1f}s".format(max_time))
if card_gen_times:
    print("Avg card gen time:  {:.1f}s".format(sum(card_gen_times)/len(card_gen_times)))
    print("Min card gen time:  {:.1f}s".format(min(card_gen_times)))
    print("Max card gen time:  {:.1f}s".format(max(card_gen_times)))

print("\n--- Quality Errors ---")
print("Psych questions:    {}/{}".format(psych_q, all_rounds))
print("Label buying:       {}/{}".format(label_buy, all_rounds))
print("Multi questions:    {}/{}".format(multi_q, all_rounds))
print("Markdown residue:   {}/{}".format(markdown, all_rounds))

print("\n--- Card Triggers ---")
print("Cards triggered:    {}/{} scenarios".format(card_triggers, len(WHOLE_SCENARIOS)))
print("Cards generated:    {}".format(len(card_gen_times)))

# Score estimates
q_errs = psych_q + multi_q * 0.5
q_score = max(0, min(30, 30 - q_errs * 2.5))
print("\n--- Estimated Scores ---")
print("追问质量: ~{:.0f}/30".format(q_score))
print("Markdown:  {}/{}".format(markdown, all_rounds))
