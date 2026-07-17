-- ============================================================
-- 邻里趣玩 - Supabase 数据库迁移脚本
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================================

-- 1. 好友关系表（双方互为好友后才写入）
CREATE TABLE IF NOT EXISTS friendships (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 索引：加速查询用户的好友列表
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);

-- 1.5. 好友申请表（发送申请 → 对方同意 → 互为好友）
CREATE TABLE IF NOT EXISTS friend_requests (
  id BIGSERIAL PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);

-- 2. 聊天消息表
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- 索引：加速查询两个用户之间的消息
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read 
  ON messages(receiver_id, read, created_at);

-- 3. 启用 RLS（允许 anon key 访问所有操作）
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- RLS 策略：允许所有操作（公开应用场景）
CREATE POLICY "allow_all_friendships" ON friendships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_friend_requests" ON friend_requests FOR ALL USING (true) WITH CHECK (true);

-- 4. 启用实时订阅（消息、好友关系和好友申请需要实时推送）
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- 5. 如果 nearby_users 表已存在但没有 RLS，则补充
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='nearby_users') THEN
    ALTER TABLE IF EXISTS nearby_users ENABLE ROW LEVEL SECURITY;
    -- 检查策略是否存在，不存在则创建
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='nearby_users' AND policyname='allow_all_nearby_users') THEN
      CREATE POLICY "allow_all_nearby_users" ON nearby_users FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- 完成
SELECT '迁移完成！已创建 friendships, messages 表并启用实时订阅。' AS result;
