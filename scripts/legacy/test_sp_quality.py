"""Test the new diagnostic SP quality across 10 scenarios × 5 rounds = 50 total rounds."""
import subprocess, json, time, re, sys

BASE = "http://127.0.0.1:3000"

def api(method, path, data=None):
    url = f"{BASE}{path}"
    args = ["curl", "-s"]
    if method != "GET":
        args += ["-X", method]
    args += [url, "-H", "Content-Type: application/json"]
    if data:
        args += ["-d", json.dumps(data, ensure_ascii=False)]
    r = subprocess.run(args, capture_output=True, text=True)
    return json.loads(r.stdout)

def api_stream(path, data):
    url = f"{BASE}{path}"
    args = ["curl", "-s", "-N", "-X", "POST", url,
            "-H", "Content-Type: application/json",
            "-d", json.dumps(data, ensure_ascii=False),
            "--max-time", "60"]
    r = subprocess.run(args, capture_output=True, text=True)
    lines = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
    if not lines:
        return None, "", ""
    deltas = []
    final = None
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get("type") == "delta":
                deltas.append(ev["delta"])
            elif ev.get("type") == "final":
                final = ev
        except:
            pass
    text = "".join(deltas)
    return final, text, deltas

# 10 diverse scenarios
SCENARIOS = [
    {
        "name": "作业拖延-表面懒",
        "rounds": [
            "孩子就是懒，每天回家拖到八九点才开始写作业。",
            "不是写到一半卡住，是还没开始就一直玩手机，说等一会儿。",
            "催他就不耐烦，说知道了知道了别催了。",
            "数学明显比语文拖得久，语文背诵他基本不拖。",
            "他数学其实成绩还行，就是最近换了老师以后开始的。",
        ]
    },
    {
        "name": "手机-总玩不停",
        "rounds": [
            "孩子被手机毁了，每天抱着不撒手，一说就吵。",
            "写完作业就拿手机，一玩就是两三个小时。",
            "主要是刷短视频，也有打游戏。",
            "周末更严重，起床就摸手机，早饭都不吃。",
            "如果说不给手机，他就说那我干嘛，又没别的事。",
        ]
    },
    {
        "name": "补课-抵触强烈",
        "rounds": [
            "我想给他报个英语班，他死活不去，说周末已经排满了。",
            "他周末其实只有篮球和画画，都是他自己要报的。",
            "我自己英语不好，特别怕他掉队，班里好多同学都在补。",
            "他说英语老师讲太快，他跟不上。",
            "他说不想补课不是因为懒，是觉得周末真的不够用。",
        ]
    },
    {
        "name": "顶嘴-一说就炸",
        "rounds": [
            "孩子太叛逆了，我一句话他就炸，根本不能沟通。",
            "我一般就是问他作业写了没，他就烦。",
            "我的原话一般是：作业写了吗？今天的任务都完成了吗？",
            "他说你每天只会问这个，不关心我别的。",
            "他的考试成绩最近降了，我从老师那知道的，他不跟我说。",
        ]
    },
    {
        "name": "沉默-问什么都不说",
        "rounds": [
            "孩子根本不跟我沟通，我问什么他都说不知道、随便。",
            "他放学回来就直接进房间，吃饭叫半天才出来。",
            "以前不这样，初二上学期开始的。",
            "他成绩其实还可以，班级前十。",
            "他说过：跟你说了你也不懂，说了也白说。",
        ]
    },
    {
        "name": "无所谓-考砸也不在乎",
        "rounds": [
            "孩子考砸了也不在乎，问他怎么样就说还行、无所谓。",
            "这次数学考了68分，之前都85以上的。",
            "他说我就是运气不好，下次能考好，但也不复习。",
            "他以前考不好会难过，现在完全没反应。",
            "我问他是不是题太难，他说不是难，是粗心。",
        ]
    },
    {
        "name": "表面答应-实际不动",
        "rounds": [
            "孩子每次都说知道了马上去做，但从来不动，就是敷衍我。",
            "我说完他立刻说知道了知道了，然后继续玩手机。",
            "如果我再说，他就沉默，但不做。",
            "他答应的时候表情挺烦的，好像希望我赶紧走。",
            "只有我在旁边盯着，他才真的开始写。",
        ]
    },
    {
        "name": "写完被加任务-抵触",
        "rounds": [
            "孩子写作业倒是不慢，但是一让他多做一点就炸。",
            "学校作业大概一个小时就写完了，我想让他再背点单词。",
            "他就说我永远不让他休息，写完这个还有那个。",
            "我确实会在他写完后说既然写完了就把背诵也做了。",
            "他说他知道写完也不会结束，所以有时候故意写慢。",
        ]
    },
    {
        "name": "强情绪-家长崩溃",
        "rounds": [
            "我真的快被他气死了，我为他花了这么多钱补课，他一点都不争气。",
            "补课老师说他上课也在玩手机，我一个月花两千多。",
            "我跟他说我们为你做了这么多，你能不能争气一点。",
            "他就不说话，或者回房间关门。",
            "我承认我说话比较重，但我真的没办法了。",
        ]
    },
    {
        "name": "考试焦虑-怕暴露不会",
        "rounds": [
            "孩子考试前特别紧张，但是从来不让我帮他复习。",
            "他说他自己可以，但不让我检查。",
            "我检查他背诵，他就开始烦，背两句就说都会了。",
            "他每次都说懂了，但考试就错很多。",
            "他说最烦我一题一题查他，感觉像审犯人。",
        ]
    },
]

def check_quality(output_text, scenario, round_idx):
    """Automated quality checks. Returns dict of issues found."""
    issues = []
    
    # Check 1: No psychological question patterns
    psych_patterns = [
        r"是不是压力大", r"是不是逃避", r"是不是怕失败",
        r"是不是没有内驱力", r"是不是心理有问题", r"是不是叛逆",
        r"是不是沉迷", r"是不是自卑"
    ]
    for pat in psych_patterns:
        if re.search(pat, output_text):
            issues.append(f"BAD_PSYCH_QUESTION: matched '{pat}'")
    
    # Check 2: No label-buying
    label_patterns = [r"他就是懒", r"他就是不配合", r"就是叛逆", r"就是不想学"]
    for pat in label_patterns:
        if re.search(pat, output_text):
            issues.append(f"LABEL_BUYING: '{pat}'")
    
    # Check 3: Contains natural voice words
    voice_ok = any(w in output_text for w in ["咱们", "哎呀", "说实话", "先别急", "这个点"])
    
    # Check 4: Multiple questions? (rough check)
    question_marks = output_text.count("？") + output_text.count("?")
    if question_marks > 2:
        issues.append(f"MULTI_QUESTIONS: {question_marks} question marks")
    
    # Check 5: No Markdown
    if "**" in output_text or "```" in output_text or "# " in output_text:
        issues.append("MARKDOWN_FOUND")
    
    # Check 6: Card trigger detection
    has_card = "<!--CARD_JSON-->" in output_text
    card_data = None
    if has_card:
        idx = output_text.index("<!--CARD_JSON-->")
        card_text = output_text[idx + len("<!--CARD_JSON-->"):].strip()
        try:
            card_data = json.loads(card_text)
        except:
            issues.append("CARD_JSON_PARSE_FAILED")
    
    return issues, voice_ok, has_card, card_data

results = []
overall = {
    "total_rounds": 0,
    "psych_question_errors": 0,
    "label_buying_errors": 0,
    "multi_question_errors": 0,
    "markdown_errors": 0,
    "voice_pass": 0,
    "card_triggers": 0,
    "card_parse_fails": 0,
    "scenarios_completed": 0,
}

for si, scenario in enumerate(SCENARIOS):
    print(f"\n{'='*70}")
    print(f"SCENARIO {si+1}: {scenario['name']}")
    print(f"{'='*70}")
    
    # Start conversation
    c = api("POST", "/api/conversations/start", {"familyId":"f_demo","childId":"c_demo"})
    cid = c["data"]["conversationId"]
    
    scenario_issues = []
    scenario_card = None
    
    for ri, parent_text in enumerate(scenario["rounds"]):
        round_num = ri + 1
        final, text, deltas = api_stream("/api/problem/answer/stream", {
            "conversationId": cid, "round": round_num,
            "inputMode": "text", "text": parent_text
        })
        
        if final is None:
            print(f"  R{round_num}: NO RESPONSE")
            continue
        
        next_action = final.get("data", {}).get("nextAction", "?") if final.get("data") else "?"
        curr_round = final.get("data", {}).get("a1", {}).get("progress", {}).get("currentRound", "?") if final.get("data") else "?"
        
        # Run quality checks
        issues, voice_ok, has_card, card_data = check_quality(text, scenario, ri)
        scenario_issues.extend(issues)
        
        overall["total_rounds"] += 1
        if any("BAD_PSYCH_QUESTION" in i for i in issues):
            overall["psych_question_errors"] += 1
        if any("LABEL_BUYING" in i for i in issues):
            overall["label_buying_errors"] += 1
        if any("MULTI_QUESTIONS" in i for i in issues):
            overall["multi_question_errors"] += 1
        if any("MARKDOWN_FOUND" in i for i in issues):
            overall["markdown_errors"] += 1
        if voice_ok:
            overall["voice_pass"] += 1
        if has_card:
            overall["card_triggers"] += 1
            if card_data is None and any("CARD_JSON_PARSE" in i for i in issues):
                overall["card_parse_fails"] += 1
            else:
                scenario_card = card_data
        
        # Print round summary
        status = "✓" if not issues else "✗"
        card_mark = " [CARD]" if has_card else ""
        print(f"  R{round_num} {status} | nextAct={next_action} | curr={curr_round} | {len(text)}c{card_mark}")
        print(f"       Q: {text[:80].strip()}...")
        for iss in issues:
            print(f"       ⚠ {iss}")
        
        time.sleep(0.3)
    
    overall["scenarios_completed"] += 1
    if scenario_card:
        print(f"\n  >>> CARD TRIGGERED: {json.dumps(scenario_card, ensure_ascii=False)[:200]}")
    
    print(f"  Scenario issues: {len(scenario_issues)}")

# Print final report
print(f"\n{'='*70}")
print(f"FINAL QUALITY REPORT (50 rounds across {len(SCENARIOS)} scenarios)")
print(f"{'='*70}")
print(f"Total rounds completed:        {overall['total_rounds']}/50")
print(f"Scenarios completed:           {overall['scenarios_completed']}/10")
print(f"")
print(f"--- Error checks ---")
print(f"Psych question errors:         {overall['psych_question_errors']}")
print(f"Label buying errors:           {overall['label_buying_errors']}")
print(f"Multi-question errors:         {overall['multi_question_errors']}")
print(f"Markdown in output:            {overall['markdown_errors']}")
print(f"")
print(f"--- Quality indicators ---")
print(f"Natural voice present:         {overall['voice_pass']}/{overall['total_rounds']}")
print(f"Card triggers fired:           {overall['card_triggers']}")
print(f"Card JSON parse failures:      {overall['card_parse_fails']}")
print(f"")

# Calculate scores
voi = overall['voice_pass']
tot = overall['total_rounds']
pqe = overall['psych_question_errors']
lbe = overall['label_buying_errors']
mqr = overall['multi_question_errors']

q_score = 30 - (pqe * 3) - (mqr * 2)  # 追问质量: deduct for each error
q_score = max(0, q_score)

v_score = min(15, int(voi / max(tot, 1) * 15))  # 文风质量

print(f"--- Estimated scores (automated checks only) ---")
print(f"追问质量: ~{q_score}/30")
print(f"文风质量: ~{v_score}/15")
print(f"Manual review needed for: 原因分支、孩子理解卡、家庭互动循环")

# Print last 5 AI outputs for manual review
print(f"\n--- Last 5 AI outputs for manual review ---")
print(f"(see above for full outputs)")
