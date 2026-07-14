import 'server-only'
import { createId } from '@/lib/storage/storageIds'
import { saveTurnEvent } from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { TurnEvent } from '@/types/database'

/* ================================================================
   专项前台功能的 TurnEvent 装配与落库（交付文档 7.1 / 7.2 字段闭环全覆盖）。
   daily 主入口用 pipeline 的 buildTurnEvent（填满 daily 专属字段）；
   其它前台功能（预演/诊断/规划/记录/材料）用这里的轻量版——填核心字段
   + specializedContextPackSnapshot（路由喂给 Agent 的输入包），daily 专属字段留空。
   ================================================================ */

export interface FeatureTurnArgs {
  traceId: string
  tenant: TenantId
  mode: string
  userMessage: string
  assistantReply: string
  specializedContextPack?: unknown
  linkedAreas?: string[]
}

export function buildFeatureTurnEvent(args: FeatureTurnArgs): TurnEvent {
  return {
    turnId: createId('turn'),
    traceId: args.traceId,
    familyId: args.tenant.familyId,
    childId: args.tenant.childId,
    mode: args.mode,
    userMessage: args.userMessage,
    assistantReply: args.assistantReply,
    specializedContextPackSnapshot: args.specializedContextPack,
    linkedAreas: args.linkedAreas || [],
    recentTurnsSnapshot: [],
    knowledgeContextSnapshot: null,
    createdAt: new Date().toISOString()
  }
}

// fire-and-forget：置于路由产出确定后调用，零阻塞前台；失败只记日志。
export function recordFeatureTurn(args: FeatureTurnArgs): void {
  void saveTurnEvent(args.tenant, buildFeatureTurnEvent(args)).catch((err) =>
    console.error(`[turn-event] ${args.mode} 快照写入失败 traceId=${args.traceId}:`, err)
  )
  // S2：预演（含冲突复盘）计入有效交流轮 → 每 10 轮加厚机制
  if (args.mode === 'communication_rehearsal' && args.userMessage?.trim()) {
    void import('@/lib/server/memory/deep-mechanism/note-effective-turn')
      .then(({ noteEffectiveFamilyTurn }) =>
        noteEffectiveFamilyTurn(args.tenant, 'rehearsal', args.traceId)
      )
      .catch(() => {})
  }
}
