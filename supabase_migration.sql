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

-- 3. 社区帖子表
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  image_grad TEXT DEFAULT 'grad-1',
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  collected BOOLEAN DEFAULT FALSE,
  time TEXT DEFAULT '刚刚',
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

-- 4. 社区帖子评论表
CREATE TABLE IF NOT EXISTS post_comments (
  id BIGSERIAL PRIMARY KEY,
  comment_id TEXT NOT NULL UNIQUE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  time TEXT DEFAULT '刚刚',
  post_title TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id, created_at);

-- 5. 社区帖子点赞表
CREATE TABLE IF NOT EXISTS post_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- 6. 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'post',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- 7. 启用 RLS（允许 anon key 访问所有操作）
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- RLS 策略：允许所有操作（公开应用场景）
CREATE POLICY "allow_all_friendships" ON friendships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_friend_requests" ON friend_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_posts" ON posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_post_comments" ON post_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_post_likes" ON post_likes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_favorites" ON favorites FOR ALL USING (true) WITH CHECK (true);

-- 8. 启用实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE favorites;

-- 8.5. 启用 REPLICA IDENTITY FULL 以支持 DELETE 事件的实时推送中获取完整行数据
ALTER TABLE post_likes REPLICA IDENTITY FULL;
ALTER TABLE favorites REPLICA IDENTITY FULL;

-- 9. 如果 nearby_users 表已存在但没有 RLS，则补充
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
SELECT '迁移完成！已创建 friendships, messages, posts, post_comments, post_likes, favorites 表并启用实时订阅。' AS result;
