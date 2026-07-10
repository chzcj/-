-- 微信小程序登录：users 表扩展
-- 在 ensureDbSchema 中也会自动执行等效 ALTER；本文件供手动迁移参考

ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_unionid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_openid ON users (wechat_openid) WHERE wechat_openid IS NOT NULL;
