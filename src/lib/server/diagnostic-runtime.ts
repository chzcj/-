import 'server-only';

import type { ConversationStateData } from '@/types/childos';
import { DEFAULT_MAX_ROUND, MIN_UNDERSTANDING_ROUND } from '@/lib/conversation-config';
import type { FamilyBriefMemory } from '@/lib/server/db';
import { agentPrompts } from '@/lib/server/agent-prompts';

export const diagnosticRuntimeCore = agentPrompts.dailyDialogueOrchestration;

const diagnosticScenePatches = {
  homework: `
场景：作业/学习拖延
区分开始前进不去、写到一半卡住、检查前防御、写完后被加码。
关键问题：他更像坐下前就拖，还是写到某一类题时停住？学校作业写完是真的结束，还是还有检查、订正？`,
  phone: `
场景：手机/游戏/短视频
手机出现在学习开始前、中途卡住后、完成后、睡前，还是无任务时也停不下。
关键问题：手机最常出现在他准备开始前，还是写到一半卡住后？`,
  evaluationDefense: `
场景：被评价防御
孩子顶嘴、烦、沉默、关门、说无所谓 → 先听成"我又被定义了"。
关键问题：你提醒他的第一句话通常怎么说？他当时是顶回来、沉默，还是嘴上答应却不动？`,
  exposure: `
场景：怕暴露不会
抗拒的可能不是任务，而是检查、背诵、订正、讲题时暴露"我不会"。
关键问题：他最烦的是开始之前，还是你要检查、讲题、订正的时候？`,
  completionBoundary: `
场景：缺结束感
孩子经验里"做完不等于结束"→ 拖延可能是推迟进入无结束感任务链。
关键问题：如果他某天写得快，家里一般会让他轻松一点，还是会把后面的背诵、订正也补上？`,
  emotion: `
场景：强情绪
家长情绪强时先接住。孩子情绪强时看持续时间、睡眠饮食、极端表达和风险边界。`,
  schoolPeer: `
场景：学校/同伴
回家后的拖延可能被学校压力放大。
关键问题：最近学校有没有明显变化，比如换老师、考试下降、同学关系变化？`,
  sleepEnergy: `
场景：睡眠/精力
长期低能量→拖延、烦躁、注意力差、控制不住手机。用电量不足解释，不要用态度差解释。`,
  parentPressure: `
场景：高投入家长叙事错位
家长投入很多、很着急合理，但孩子可能听成欠账感、永远不够好。
关键问题：你最常跟他说的是"快点开始"，还是"我们为你做了这么多，你要争气一点"？`
} as const;

type PatchKey = keyof typeof diagnosticScenePatches;

export function buildDiagnosticStreamPrompt(input: { conversation: ConversationStateData; latestText: string; familyBrief?: FamilyBriefMemory }) {
  return [
    diagnosticRuntimeCore,
    selectedPatchText(input.latestText, input.conversation),
    familyBriefText(input.familyBrief),
    `
本次任务：基于上面的规则，生成下一轮给家长看的追问正文。
如果你判断信息已经足够形成家长盲点级别的洞察，在正文末尾使用 <!--CARD_JSON--> 标记。
格式：只输出一段自然中文。长度上限 70 字。出卡时正文同样遵守 70 字上限。
结构：先轻承接家长刚说的现场 + 说明为什么问这个 + 只问一个能推进判断的关键问题。
`
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildDiagnosticA1JsonPrompt(input: { conversation: ConversationStateData; latestText: string; familyBrief?: FamilyBriefMemory }) {
  return [
    diagnosticRuntimeCore,
    selectedPatchText(input.latestText, input.conversation),
    familyBriefText(input.familyBrief),
    `
本次任务：输出当前前端 A1Output JSON。
字段协议：
- schemaVersion 固定 childos.a1.output.v1
- ok=true
- 继承 familyId、childId、conversationId
- messageType 使用 followup_question 或 confirm_generate_card
- scene 固定 problem_solving
- assistantMessage 可选，只放很短承接，tone 用 calm 或 warm
- highlightQuestion.text 放最关键的一段追问或确认句
- ui.showReflectionCard=false
- ui.showQuestionCard=true
- ui.showQuickChoices=false
- ui.quickChoices=[]
- progress.minRound 固定 ${MIN_UNDERSTANDING_ROUND}
- progress.maxRound 固定 ${DEFAULT_MAX_ROUND}
- clientActions.nextAction 信息不足用 continue_question，足够生成理解卡用 confirm_generate_card
- clientActions.nextRoute 用 /problem/follow-up 或 /problem/confirm
- memoryCandidates 最多 3 条，短摘要，不写长原文
- safety 必须输出，默认 riskLevel=none, needsHumanSupport=false, message=""
只输出 JSON，不输出 Markdown 或解释。
`
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildUnderstandingSectionPrompt(input: { sectionTitle: string; sectionTask: string; latestText?: string; conversation: ConversationStateData; familyBrief?: FamilyBriefMemory }) {
  return [
    diagnosticRuntimeCore,
    selectedPatchText(input.latestText || latestConversationText(input.conversation), input.conversation),
    familyBriefText(input.familyBrief),
    `
本次任务：写孩子理解卡的一个区块。
区块：${input.sectionTitle}
任务：${input.sectionTask}
要求：
- 只输出 JSON：{"body":"正文"} 或 {"body":["句子1","句子2"]}
- 必须基于本次 conversation 和可追溯事实。
- 不贴标签，不诊断，不道德化。
- 信息不足时写"目前更像是/这次先这样看"，不要编造。
- 内容要有诊断密度，不能泛泛说多沟通、多鼓励。
`
  ]
    .filter(Boolean)
    .join('\n\n');
}

function selectedPatchText(latestText: string, conversation: ConversationStateData) {
  const text = `${latestText}\n${conversation.rounds.map((round) => round.rawText).join('\n')}`;
  const selected: PatchKey[] = [];
  const add = (key: PatchKey) => {
    if (!selected.includes(key)) selected.push(key);
  };
  if (/作业|数学|语文|英语|写不|拖|订正|背|默写|题|学习/.test(text)) add('homework');
  if (/手机|游戏|短视频|平板|刷|玩/.test(text)) add('phone');
  if (/催|顶嘴|关门|沉默|烦|吵|不理|知道了|一说/.test(text)) add('evaluationDefense');
  if (/检查|订正|背完|讲题|不会|错题|暴露|无所谓/.test(text)) add('exposure');
  if (/做完|结束|加|预习|背诵|还有|任务/.test(text)) add('completionBoundary');
  if (/崩溃|受不了|哭|发火|焦虑|烦躁|情绪|自伤|自杀|打|暴力/.test(text)) add('emotion');
  if (/学校|老师|同学|班|考试|默写|排名|朋友/.test(text)) add('schoolPeer');
  if (/睡|困|累|起床|熬夜|晚上|精力/.test(text)) add('sleepEnergy');
  if (/付出|花钱|补课|争气|为你|投入|不珍惜/.test(text)) add('parentPressure');
  if (selected.length === 0) {
    add('homework');
    add('evaluationDefense');
  }
  return selected.slice(0, 4).map((key) => diagnosticScenePatches[key]).join('\n\n');
}

function familyBriefText(familyBrief?: FamilyBriefMemory) {
  if (!familyBrief) return '';
  return `家庭短记忆，只作为背景，不可压过本次事实：
${JSON.stringify(
    {
      recentFocus: familyBrief.recentFocus,
      activeHypotheses: familyBrief.activeHypotheses?.slice(0, 4),
      stableProfiles: familyBrief.stableProfiles?.slice(0, 3),
      interactionPatterns: familyBrief.interactionPatterns?.slice(0, 3),
      avoidAssumptions: familyBrief.avoidAssumptions?.slice(0, 2),
      nextVerify: familyBrief.nextVerify
    },
    null,
    2
  )}`;
}

function latestConversationText(conversation: ConversationStateData) {
  return conversation.rounds.at(-1)?.rawText || conversation.latestA1?.highlightQuestion.text || '';
}
