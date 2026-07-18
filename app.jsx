// 邻里趣玩 - 发现附近好去处，和邻居一起玩

var useState = React.useState, useEffect = React.useEffect, useCallback = React.useCallback, useMemo = React.useMemo, useRef = React.useRef, createContext = React.createContext, useContext = React.useContext, Fragment = React.Fragment;

// 工具函数

/** 生成随机整数 [min, max] */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** 生成随机浮点数 [min, max)，保留1位小数 */
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(1);

/** 生成UUID */
const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/** Haversine公式计算两点间距离（返回公里数） */
const calcDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return +(R * c).toFixed(1);
};

/** 格式化距离显示 */
const formatDistance = (km) => {
  if (km < 1) return (km * 1000).toFixed(0) + 'm';
  return km.toFixed(1) + 'km';
};

/** 格式化日期 */
const formatDate = (d) => {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekDays = ['日','一','二','三','四','五','六'];
  const w = weekDays[date.getWeekDay ? date.getWeekDay() : date.getDay()];
  return `${y}年${m}月${day}日 星期${w}`;
};

/** 获取当前小时 */
const currentHour = () => new Date().getHours();

// ===== Supabase 配置 =====
let sbClient = null;
let _supabaseTablesAvailable = null;

const getSupabaseConfig = () => {
  try {
    const saved = localStorage.getItem('nlqw_supabase_config');
    return saved ? JSON.parse(saved) : {};
  } catch(e) { return {}; }
};

const SUPABASE_URL = () => getSupabaseConfig().url || 'https://uvkdabhmqwquoksiydew.supabase.co';
const SUPABASE_ANON_KEY = () => getSupabaseConfig().anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a2RhYmhtcXdxdW9rc2l5ZGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODQwMjAsImV4cCI6MjA5OTc2MDAyMH0.TpcSlRkmus-_sbFlGqkjl2TtLi1zR82bUC7WCo0jTFE';

const initSupabase = () => {
  if (sbClient) return sbClient;
  const url = SUPABASE_URL();
  const key = SUPABASE_ANON_KEY();
  if (!url || !key) { console.warn('[Supabase] 缺少配置'); return null; }
  const sb = window.supabase;
  if (!sb || typeof sb.createClient !== 'function') { console.warn('[Supabase] SDK 未加载'); return null; }
  try {
    sbClient = sb.createClient(url, key);
    console.log('[Supabase] 已连接');
    return sbClient;
  } catch(e) { console.warn('[Supabase] 连接失败:', e.message); return null; }
};

const getSupabase = () => sbClient || initSupabase();

const isSupabaseTablesReady = () => _supabaseTablesAvailable === true;

// ===== Supabase 社区 CRUD 函数 =====

const loadPostsFromSupabase = async () => {
  const sb = getSupabase(); if (!sb) return null;
  try {
    const resp = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100);
    if (resp.error) { console.error('[Supabase] 加载帖子失败:', resp.error.message); return null; }
    if (!resp.data || resp.data.length === 0) return [];
    return resp.data.map(p => ({
      id: p.id, userId: p.user_id, userName: p.user_name,
      title: p.title, content: p.content || '', imageGrad: p.image_grad || 'grad-1',
      likes: p.likes || 0, comments: p.comments_count || 0,
      collected: p.collected || false, time: p.time || '刚刚',
      tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : []),
      createdAt: p.created_at
    }));
  } catch(ex) { console.error('[Supabase] loadPostsFromSupabase 异常:', ex.message); return null; }
};

const savePostToSupabase = async (post) => {
  const sb = getSupabase(); if (!sb) return false;
  try {
    const resp = await sb.from('posts').insert({
      id: post.id, user_id: post.userId, user_name: post.userName,
      title: post.title, content: post.content || '', image_grad: post.imageGrad || 'grad-1',
      likes: post.likes || 0, comments_count: post.comments || 0,
      collected: post.collected || false, time: post.time || '刚刚',
      tags: post.tags || [], created_at: new Date().toISOString()
    });
    if (resp.error) { console.error('[Supabase] 保存帖子失败:', resp.error.message); return false; }
    console.log('[Supabase] ✅ 帖子已保存:', post.id);
    return true;
  } catch(ex) { console.error('[Supabase] savePostToSupabase 异常:', ex.message); return false; }
};

const updatePostToSupabase = async (postId, updates) => {
  const sb = getSupabase(); if (!sb) return false;
  try {
    const data = {};
    if (updates.likes !== undefined) data.likes = updates.likes;
    if (updates.comments !== undefined) data.comments_count = updates.comments;
    if (updates.collected !== undefined) data.collected = updates.collected;
    if (Object.keys(data).length === 0) return true;
    const resp = await sb.from('posts').update(data).eq('id', postId);
    if (resp.error) { console.error('[Supabase] 更新帖子失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] updatePostToSupabase 异常:', ex.message); return false; }
};

const loadPostCommentsFromSupabase = async () => {
  const sb = getSupabase(); if (!sb) return null;
  try {
    const resp = await sb.from('post_comments').select('*').order('created_at', { ascending: true }).limit(500);
    if (resp.error) { console.error('[Supabase] 加载评论失败:', resp.error.message); return null; }
    if (!resp.data || resp.data.length === 0) return {};
    const comments = {};
    resp.data.forEach(c => {
      if (!comments[c.post_id]) comments[c.post_id] = [];
      comments[c.post_id].push({
        id: c.comment_id, userId: c.user_id, userName: c.user_name,
        text: c.text, time: c.time || '刚刚', postId: c.post_id, postTitle: c.post_title || ''
      });
    });
    return comments;
  } catch(ex) { console.error('[Supabase] loadPostCommentsFromSupabase 异常:', ex.message); return null; }
};

const saveCommentToSupabase = async (comment) => {
  const sb = getSupabase(); if (!sb) return false;
  try {
    const resp = await sb.from('post_comments').insert({
      comment_id: comment.id, post_id: comment.postId, user_id: comment.userId,
      user_name: comment.userName, text: comment.text, time: comment.time || '刚刚',
      post_title: comment.postTitle || '', created_at: new Date().toISOString()
    });
    if (resp.error) { console.error('[Supabase] 保存评论失败:', resp.error.message); return false; }
    console.log('[Supabase] ✅ 评论已保存:', comment.id);
    return true;
  } catch(ex) { console.error('[Supabase] saveCommentToSupabase 异常:', ex.message); return false; }
};

const loadLikesFromSupabase = async (userId) => {
  const sb = getSupabase(); if (!sb || !userId) return null;
  try {
    const resp = await sb.from('post_likes').select('post_id').eq('user_id', userId);
    if (resp.error) { console.error('[Supabase] 加载点赞失败:', resp.error.message); return null; }
    return (resp.data || []).map(l => l.post_id);
  } catch(ex) { console.error('[Supabase] loadLikesFromSupabase 异常:', ex.message); return null; }
};

const likePostToSupabase = async (postId, userId) => {
  const sb = getSupabase(); if (!sb || !postId || !userId) return false;
  try {
    const resp = await sb.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (resp.error) { console.error('[Supabase] 点赞失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] likePostToSupabase 异常:', ex.message); return false; }
};

const unlikePostToSupabase = async (postId, userId) => {
  const sb = getSupabase(); if (!sb || !postId || !userId) return false;
  try {
    const resp = await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (resp.error) { console.error('[Supabase] 取消点赞失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] unlikePostToSupabase 异常:', ex.message); return false; }
};

const loadFavoritesFromSupabase = async (userId) => {
  const sb = getSupabase(); if (!sb || !userId) return null;
  try {
    const resp = await sb.from('favorites').select('item_id,item_type').eq('user_id', userId);
    if (resp.error) { console.error('[Supabase] 加载收藏失败:', resp.error.message); return null; }
    return (resp.data || []).map(f => f.item_type + '_' + f.item_id);
  } catch(ex) { console.error('[Supabase] loadFavoritesFromSupabase 异常:', ex.message); return null; }
};

const addFavoriteToSupabase = async (userId, itemId, itemType) => {
  const sb = getSupabase(); if (!sb || !userId) return false;
  try {
    const resp = await sb.from('favorites').insert({ user_id: userId, item_id: itemId, item_type: itemType || 'post' });
    if (resp.error) { console.error('[Supabase] 添加收藏失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] addFavoriteToSupabase 异常:', ex.message); return false; }
};

const removeFavoriteFromSupabase = async (userId, itemId, itemType) => {
  const sb = getSupabase(); if (!sb || !userId) return false;
  try {
    const resp = await sb.from('favorites').delete().eq('user_id', userId).eq('item_id', itemId).eq('item_type', itemType || 'post');
    if (resp.error) { console.error('[Supabase] 取消收藏失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] removeFavoriteFromSupabase 异常:', ex.message); return false; }
};

const deletePostFromSupabase = async (postId) => {
  const sb = getSupabase(); if (!sb || !postId) return false;
  try {
    const resp = await sb.from('posts').delete().eq('id', postId);
    if (resp.error) { console.error('[Supabase] 删除帖子失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] deletePostFromSupabase 异常:', ex.message); return false; }
};

const deleteCommentFromSupabase = async (commentId) => {
  const sb = getSupabase(); if (!sb || !commentId) return false;
  try {
    const resp = await sb.from('post_comments').delete().eq('comment_id', commentId);
    if (resp.error) { console.error('[Supabase] 删除评论失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] deleteCommentFromSupabase 异常:', ex.message); return false; }
};

// ===== Supabase 好友申请 =====

const sendFriendRequestToSupabase = async (fromUserId, toUserId) => {
  const sb = getSupabase(); if (!sb || !fromUserId || !toUserId) return false;
  try {
    const resp = await sb.from('friend_requests').upsert(
      { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending', updated_at: new Date().toISOString() },
      { onConflict: 'from_user_id,to_user_id' }
    );
    if (resp.error) { console.error('[Supabase] 发送好友申请失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] sendFriendRequestToSupabase 异常:', ex.message); return false; }
};

const acceptFriendRequestToSupabase = async (fromUserId, toUserId) => {
  const sb = getSupabase(); if (!sb || !fromUserId || !toUserId) return false;
  try {
    const r1 = await sb.from('friend_requests').update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('from_user_id', fromUserId).eq('to_user_id', toUserId);
    if (r1.error) { console.error('[Supabase] 更新申请状态失败:', r1.error.message); return false; }
    const r2 = await sb.from('friendships').upsert({ user_id: fromUserId, friend_id: toUserId }, { onConflict: 'user_id,friend_id' });
    if (r2.error) { console.error('[Supabase] 接受好友申请失败(upsert A→B):', r2.error.message); return false; }
    const r3 = await sb.from('friendships').upsert({ user_id: toUserId, friend_id: fromUserId }, { onConflict: 'user_id,friend_id' });
    if (r3.error) { console.error('[Supabase] 接受好友申请失败(upsert B→A):', r3.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] acceptFriendRequestToSupabase 异常:', ex.message); return false; }
};

const rejectFriendRequestToSupabase = async (fromUserId, toUserId) => {
  const sb = getSupabase(); if (!sb || !fromUserId || !toUserId) return false;
  try {
    const resp = await sb.from('friend_requests').update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('from_user_id', fromUserId).eq('to_user_id', toUserId);
    if (resp.error) { console.error('[Supabase] 拒绝好友申请失败:', resp.error.message); return false; }
    return true;
  } catch(ex) { console.error('[Supabase] rejectFriendRequestToSupabase 异常:', ex.message); return false; }
};

const loadFriendRequestsFromSupabase = async (userId) => {
  const sb = getSupabase(); if (!sb || !userId) return [];
  try {
    const resp = await sb.from('friend_requests').select('*').eq('to_user_id', userId).eq('status', 'pending').order('created_at', { ascending: false });
    if (resp.error || !resp.data || !resp.data.length) return [];
    const fromIds = resp.data.map(r => r.from_user_id);
    const pResp = await sb.from('nearby_users').select('*').in('id', fromIds);
    const userMap = {};
    if (pResp.data) pResp.data.forEach(p => { userMap[p.id] = p; });
    return resp.data.map(r => {
      const u = userMap[r.from_user_id];
      return {
        id: r.id, fromUserId: r.from_user_id, toUserId: r.to_user_id, status: r.status, createdAt: r.created_at,
        fromUserName: u ? u.name : ('邻居' + r.from_user_id.slice(-4)),
        fromUserAvatar: u ? (u.avatar || '👤') : '👤',
        fromUserColor: u ? (u.color || '#4A90D9') : '#4A90D9',
      };
    });
  } catch(ex) { console.error('[Supabase] loadFriendRequestsFromSupabase 异常:', ex.message); return []; }
};

const loadSentFriendRequestsFromSupabase = async (userId) => {
  const sb = getSupabase(); if (!sb || !userId) return [];
  try {
    const resp = await sb.from('friend_requests').select('to_user_id').eq('from_user_id', userId).eq('status', 'pending');
    if (resp.error || !resp.data || !resp.data.length) return [];
    return resp.data.map(r => r.to_user_id);
  } catch(ex) { console.error('[Supabase] loadSentFriendRequestsFromSupabase 异常:', ex.message); return []; }
};

const subscribeToFriendRequests = (userId, onNewRequest) => {
  const sb = getSupabase(); if (!sb || !userId) return null;
  try {
    const channel = sb.channel('friend-req-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: 'to_user_id=eq.' + userId },
        payload => {
          if (onNewRequest && payload.new && payload.new.status === 'pending') {
            const fromUserId = payload.new.from_user_id;
            sb.from('nearby_users').select('id,name,avatar,color').eq('id', fromUserId).single()
              .then(r => {
                const meta = (!r.error && r.data) ? r.data : null;
                onNewRequest({
                  id: payload.new.id, fromUserId, toUserId: payload.new.to_user_id,
                  status: payload.new.status, createdAt: payload.new.created_at,
                  fromUserName: meta ? meta.name : ('邻居' + fromUserId.slice(-4)),
                  fromUserAvatar: meta ? (meta.avatar || '👤') : '👤',
                  fromUserColor: meta ? (meta.color || '#4A90D9') : '#4A90D9',
                });
              });
          }
        }
      ).subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Supabase] 好友申请实时订阅成功 (' + userId + ')');
      });
    return channel;
  } catch(ex) { console.error('[Supabase] subscribeToFriendRequests 异常:', ex.message); return null; }
};

// ===== Supabase 实时订阅 =====

const subscribeToCommunityPosts = (onNewPost, onPostUpdate, onPostDelete) => {
  const sb = getSupabase(); if (!sb) return null;
  try {
    const channel = sb.channel('community-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        if (payload.new && onNewPost) {
          const p = payload.new;
          onNewPost({
            id: p.id, userId: p.user_id, userName: p.user_name,
            title: p.title, content: p.content || '', imageGrad: p.image_grad || 'grad-1',
            likes: p.likes || 0, comments: p.comments_count || 0,
            collected: p.collected || false, time: p.time || '刚刚',
            tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : [])
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, payload => {
        if (payload.new && onPostUpdate) {
          onPostUpdate(payload.new.id, { likes: payload.new.likes, comments: payload.new.comments_count });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, payload => {
        if (payload.old && onPostDelete) onPostDelete(payload.old.id);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Supabase] 社区帖子订阅成功');
        else if (status === 'CHANNEL_ERROR') console.error('[Supabase] 社区帖子订阅错误');
      });
    return channel;
  } catch(ex) { console.error('[Supabase] subscribeToCommunityPosts 异常:', ex.message); return null; }
};

const subscribeToCommunityComments = (onNewComment, onCommentDelete) => {
  const sb = getSupabase(); if (!sb) return null;
  try {
    const channel = sb.channel('community-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, payload => {
        if (payload.new && onNewComment) {
          const c = payload.new;
          onNewComment({
            id: c.comment_id, userId: c.user_id, userName: c.user_name,
            text: c.text, time: c.time || '刚刚', postId: c.post_id, postTitle: c.post_title || ''
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_comments' }, payload => {
        if (payload.old && onCommentDelete) onCommentDelete(payload.old.post_id, payload.old.comment_id);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Supabase] 社区评论订阅成功');
        else if (status === 'CHANNEL_ERROR') console.error('[Supabase] 社区评论订阅错误');
      });
    return channel;
  } catch(ex) { console.error('[Supabase] subscribeToCommunityComments 异常:', ex.message); return null; }
};

// 实时订阅：点赞变化
const subscribeToLikes = (onLikesChange) => {
  const sb = getSupabase(); if (!sb) return null;
  try {
    const channel = sb.channel('community-likes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_likes' }, (payload) => {
        if (payload.new && onLikesChange) onLikesChange(payload.new.post_id, 1);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_likes' }, (payload) => {
        if (payload.old && onLikesChange) onLikesChange(payload.old.post_id, -1);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('[Supabase] 点赞实时订阅成功');
      });
    return channel;
  } catch(ex) { console.error('[Supabase] subscribeToLikes 异常:', ex.message); return null; }
};

// 实时订阅：收藏变化
const subscribeToFavorites = (onFavoriteChange) => {
  const sb = getSupabase(); if (!sb) return null;
  try {
    const channel = sb.channel('community-favorites')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favorites' }, (payload) => {
        if (payload.new && onFavoriteChange) onFavoriteChange(payload.new.item_id, payload.new.item_type, payload.new.user_id, true);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'favorites' }, (payload) => {
        if (payload.old && onFavoriteChange) onFavoriteChange(payload.old.item_id, payload.old.item_type, payload.old.user_id, false);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('[Supabase] 收藏实时订阅成功');
      });
    return channel;
  } catch(ex) { console.error('[Supabase] subscribeToFavorites 异常:', ex.message); return null; }
};

// 主题管理
const ThemeContext = createContext(null);

const themes = {
  light: { name: '简约白', icon: 'fa-sun' },
  dark: { name: '深色模式', icon: 'fa-moon' },
  rose: { name: '玫瑰粉', icon: 'fa-heart' },
  ocean: { name: '海岸蓝', icon: 'fa-water' },
  coffee: { name: '咖啡棕', icon: 'fa-mug-hot' },
};

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('nlqw_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nlqw_theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

// ============================================================
// 中国主要城市坐标列表
// ============================================================
const CITY_LIST = [
  { name: '北京',     lat: 39.9042,  lng: 116.4074, region: '华北' },
  { name: '上海',     lat: 31.2304,  lng: 121.4737, region: '华东' },
  { name: '广州',     lat: 23.1291,  lng: 113.2644, region: '华南' },
  { name: '深圳',     lat: 22.5431,  lng: 114.0579, region: '华南' },
  { name: '香港',     lat: 22.3193,  lng: 114.1694, region: '华南' },
  { name: '澳门',     lat: 22.1987,  lng: 113.5439, region: '华南' },
  { name: '台北',     lat: 25.0330,  lng: 121.5654, region: '华东' },
  { name: '杭州',     lat: 30.2741,  lng: 120.1551, region: '华东' },
  { name: '成都',     lat: 30.5728,  lng: 104.0668, region: '西南' },
  { name: '重庆',     lat: 29.4316,  lng: 106.9123, region: '西南' },
  { name: '南京',     lat: 32.0603,  lng: 118.7969, region: '华东' },
  { name: '武汉',     lat: 30.5928,  lng: 114.3055, region: '华中' },
  { name: '西安',     lat: 34.3416,  lng: 108.9398, region: '西北' },
  { name: '长沙',     lat: 28.2282,  lng: 112.9388, region: '华中' },
  { name: '苏州',     lat: 31.2990,  lng: 120.5853, region: '华东' },
  { name: '天津',     lat: 39.0842,  lng: 117.2009, region: '华北' },
  { name: '郑州',     lat: 34.7466,  lng: 113.6254, region: '华中' },
  { name: '厦门',     lat: 24.4798,  lng: 118.0894, region: '华东' },
  { name: '青岛',     lat: 36.0671,  lng: 120.3826, region: '华东' },
  { name: '大连',     lat: 38.9140,  lng: 121.6147, region: '东北' },
  { name: '昆明',     lat: 25.0389,  lng: 102.7183, region: '西南' },
  { name: '合肥',     lat: 31.8206,  lng: 117.2272, region: '华东' },
  { name: '福州',     lat: 26.0745,  lng: 119.2965, region: '华东' },
  { name: '南宁',     lat: 22.8170,  lng: 108.3665, region: '华南' },
  { name: '贵阳',     lat: 26.6470,  lng: 106.6302, region: '西南' },
  { name: '海口',     lat: 20.0440,  lng: 110.1999, region: '华南' },
  { name: '三亚',     lat: 18.2528,  lng: 109.5120, region: '华南' },
  { name: '拉萨',     lat: 29.6500,  lng: 91.1000,  region: '西南' },
  { name: '哈尔滨',   lat: 45.8038,  lng: 126.5350, region: '东北' },
  { name: '长春',     lat: 43.8171,  lng: 125.3235, region: '东北' },
  { name: '沈阳',     lat: 41.8057,  lng: 123.4315, region: '东北' },
  { name: '石家庄',   lat: 38.0428,  lng: 114.5149, region: '华北' },
  { name: '太原',     lat: 37.8706,  lng: 112.5489, region: '华北' },
  { name: '济南',     lat: 36.6512,  lng: 117.1201, region: '华东' },
  { name: '南昌',     lat: 28.6820,  lng: 115.8579, region: '华东' },
  { name: '兰州',     lat: 36.0611,  lng: 103.8343, region: '西北' },
  { name: '银川',     lat: 38.4872,  lng: 106.2309, region: '西北' },
  { name: '西宁',     lat: 36.6232,  lng: 101.7617, region: '西北' },
  { name: '乌鲁木齐', lat: 43.8256,  lng: 87.6168,  region: '西北' },
  { name: '呼和浩特', lat: 40.8424,  lng: 111.7490, region: '华北' },
  { name: '珠海',     lat: 22.2707,  lng: 113.5767, region: '华南' },
  { name: '东莞',     lat: 23.0208,  lng: 113.7518, region: '华南' },
  { name: '佛山',     lat: 23.0218,  lng: 113.1214, region: '华南' },
  { name: '无锡',     lat: 31.4912,  lng: 120.3124, region: '华东' },
  { name: '宁波',     lat: 29.8683,  lng: 121.5440, region: '华东' },
  { name: '温州',     lat: 28.0028,  lng: 120.6596, region: '华东' },
  { name: '徐州',     lat: 34.2048,  lng: 117.2848, region: '华东' },
  { name: '烟台',     lat: 37.4765,  lng: 121.4479, region: '华东' },
  { name: '洛阳',     lat: 34.6181,  lng: 112.4536, region: '华中' },
  { name: '桂林',     lat: 25.2736,  lng: 110.2900, region: '华南' },
  { name: '丽江',     lat: 26.8721,  lng: 100.2299, region: '西南' },
  { name: '大理',     lat: 25.6065,  lng: 100.2676, region: '西南' },
];


// 应用状态
const AppContext = createContext(null);

// 预置数据

/** 8个预置地点 */
const MOCK_PLACES = [
  // === 运动场地（蓝色） — 深圳真实地点 ===
  { id: 'p1', name: '深圳湾体育中心', category: 'sport', type: 'sport', lat: 22.518, lng: 113.952, rating: 4.5, distance: 1.2, tags: ['篮球','羽毛球','游泳'], desc: '春茧体育馆，设施齐全，深圳地标性运动综合体。' },
  { id: 'p2', name: '莲花山公园篮球场', category: 'sport', type: 'park', lat: 22.548, lng: 114.055, rating: 4.2, distance: 0.8, tags: ['篮球','免费','户外'], desc: '莲花山公园内的免费篮球场，树荫环绕，周末人气旺。' },
  { id: 'p3', name: '福田体育公园', category: 'sport', type: 'sport', lat: 22.535, lng: 114.048, rating: 4.3, distance: 1.0, tags: ['足球','跑步','健身'], desc: '福田区大型体育公园，有标准足球场和塑胶跑道。' },
  { id: 'p4', name: '大沙河公园跑步道', category: 'sport', type: 'park', lat: 22.556, lng: 113.965, rating: 4.6, distance: 1.5, tags: ['跑步','骑行','河景'], desc: '沿大沙河的生态长廊，深圳最美跑步路线之一。' },
  { id: 'p5', name: '深圳游泳跳水馆', category: 'sport', type: 'indoor', lat: 22.539, lng: 114.042, rating: 4.4, distance: 1.1, tags: ['游泳','跳水','恒温'], desc: '福田区专业游泳跳水馆，国际标准泳道，水质优良。' },
  { id: 'p6', name: '香蜜湖羽毛球馆', category: 'sport', type: 'indoor', lat: 22.545, lng: 114.034, rating: 4.1, distance: 1.3, tags: ['羽毛球','室内','空调'], desc: '香蜜湖片区的专业羽毛球馆，8片场地，需提前预约。' },
  { id: 'p7', name: '笔架山公园健身区', category: 'sport', type: 'park', lat: 22.563, lng: 114.082, rating: 4.3, distance: 1.6, tags: ['登山','健身','免费'], desc: '笔架山公园的户外健身区，登山+健身两不误。' },
  { id: 'p8', name: '南山文体中心攀岩馆', category: 'sport', type: 'indoor', lat: 22.521, lng: 113.938, rating: 4.7, distance: 1.8, tags: ['攀岩','室内','专业指导'], desc: '南山文体中心的专业攀岩馆，有教练指导，老少皆宜。' },

  // === 公园绿地（绿色） — 深圳真实地点 ===
  { id: 'p9', name: '莲花山公园', category: 'park', type: 'park', lat: 22.547, lng: 114.056, rating: 4.8, distance: 0.5, tags: ['邓小平像','放风筝','野餐'], desc: '深圳中心区最大公园，山顶有邓小平铜像，俯瞰市民中心。' },
  { id: 'p10', name: '深圳湾公园', category: 'park', type: 'park', lat: 22.514, lng: 113.957, rating: 4.9, distance: 1.0, tags: ['海边','骑行','看日落'], desc: '15公里滨海长廊，隔海望香港，深圳最美海岸线公园。' },
  { id: 'p11', name: '中心公园', category: 'park', type: 'park', lat: 22.541, lng: 114.067, rating: 4.5, distance: 0.7, tags: ['城市绿洲','跑步','遛娃'], desc: '福田CBD中的城市绿洲，闹中取静的天然氧吧。' },
  { id: 'p12', name: '仙湖植物园', category: 'park', type: 'park', lat: 22.574, lng: 114.166, rating: 4.7, distance: 3.0, tags: ['植物园','弘法寺','花展'], desc: '深圳著名植物园，有弘法寺和化石森林，四季花展不断。' },
  { id: 'p13', name: '荔枝公园', category: 'park', type: 'park', lat: 22.544, lng: 114.101, rating: 4.4, distance: 1.2, tags: ['荔枝','湖景','晨练'], desc: '罗湖老牌公园，荔枝成熟时满园飘香，湖心亭是网红打卡地。' },
  { id: 'p14', name: '华侨城湿地公园', category: 'park', type: 'park', lat: 22.533, lng: 113.977, rating: 4.6, distance: 1.5, tags: ['湿地','观鸟','生态'], desc: '城市中的湿地保护区，候鸟天堂，需预约进入。' },
  { id: 'p15', name: '园博园', category: 'park', type: 'park', lat: 22.537, lng: 114.011, rating: 4.5, distance: 1.3, tags: ['园林','花卉','拍照'], desc: '汇集全国园林精华，一步一景，深圳拍照打卡圣地。' },

  // === 室内场所（橙色） — 深圳真实地点 ===
  { id: 'p16', name: '深圳图书馆', category: 'indoor', type: 'indoor', lat: 22.547, lng: 114.058, rating: 4.6, distance: 0.6, tags: ['安静','免费','书多'], desc: '市民中心旁的深圳图书馆，现代建筑，藏书丰富，自习位多。' },
  { id: 'p17', name: '深圳音乐厅', category: 'indoor', type: 'indoor', lat: 22.548, lng: 114.059, rating: 4.7, distance: 0.7, tags: ['音乐','演出','文艺'], desc: '市民中心南侧，世界级声学设计，周末音乐会票价亲民。' },
  { id: 'p18', name: 'COCO Park购物公园', category: 'indoor', type: 'indoor', lat: 22.536, lng: 114.053, rating: 4.3, distance: 0.8, tags: ['购物','美食','影院'], desc: '福田CBD核心商圈，吃喝玩乐一站式，年轻人聚集地。' },
  { id: 'p19', name: '华侨城创意园', category: 'indoor', type: 'indoor', lat: 22.539, lng: 113.981, rating: 4.6, distance: 2.0, tags: ['文创','展览','咖啡'], desc: '旧厂房改造的文创园区，艺术展览+独立咖啡馆云集。' },
  { id: 'p20', name: '诚品生活深圳', category: 'indoor', type: 'indoor', lat: 22.521, lng: 113.941, rating: 4.4, distance: 1.5, tags: ['书店','文创','手作'], desc: '万象天地里的文艺书店，阅读+手作体验+精品咖啡。' },
  { id: 'p21', name: '深圳博物馆', category: 'indoor', type: 'indoor', lat: 22.546, lng: 114.057, rating: 4.5, distance: 0.5, tags: ['历史','免费','亲子'], desc: '市民中心旁的博物馆，了解深圳从小渔村到国际都市的奇迹。' },
  { id: 'p22', name: '南山书城', category: 'indoor', type: 'indoor', lat: 22.518, lng: 113.934, rating: 4.3, distance: 2.0, tags: ['书店','阅读','亲子'], desc: '南山区的文化地标，周末常有读书会和亲子活动。' },

  // === 秘密基地（紫色） — 深圳真实地点 ===
  { id: 'p23', name: '海上世界文化艺术中心', category: 'secret', type: 'indoor', lat: 22.486, lng: 113.914, rating: 4.8, distance: 2.5, tags: ['海景','设计','展览'], desc: '蛇口海边的设计博物馆，可以看海的艺术空间，人少景美。' },
  { id: 'p24', name: '梅林水库绿道', category: 'secret', type: 'park', lat: 22.567, lng: 114.046, rating: 4.6, distance: 1.2, tags: ['水库','徒步','安静'], desc: '梅林水库旁的静谧徒步路线，城市中的隐秘山水画卷。' },
  { id: 'p25', name: '梧桐山艺术小镇', category: 'secret', type: 'park', lat: 22.575, lng: 114.198, rating: 4.5, distance: 4.0, tags: ['艺术村','山景','手工艺'], desc: '梧桐山脚下的艺术村落，手工匠人和独立艺术家聚集地。' },
  { id: 'p26', name: '南头古城', category: 'secret', type: 'indoor', lat: 22.538, lng: 113.923, rating: 4.4, distance: 2.2, tags: ['古城','文创','美食'], desc: '深圳1700年历史的古城，改造后成了文创美食新地标。' },
  { id: 'p27', name: '深圳天文台', category: 'secret', type: 'park', lat: 22.48, lng: 114.341, rating: 4.9, distance: 5.0, tags: ['观星','海边','天文'], desc: '大鹏半岛的深圳天文台，山海之间的星空观测圣地。' },
  { id: 'p28', name: '燕晗山郊野公园', category: 'secret', type: 'park', lat: 22.544, lng: 113.988, rating: 4.5, distance: 1.5, tags: ['秘境','徒步','小众'], desc: '华侨城里的隐秘山林，人少景美，城市中的秘密花园。' },
  { id: 'p29', name: 'G&G创意社区', category: 'secret', type: 'indoor', lat: 22.504, lng: 113.921, rating: 4.6, distance: 2.0, tags: ['创意市集','美食','文艺'], desc: '蛇口的创意社区，周末市集和美食节，年轻人的秘密聚集地。' },
  { id: 'p30', name: '大鹏所城', category: 'secret', type: 'park', lat: 22.592, lng: 114.506, rating: 4.7, distance: 8.0, tags: ['古城','海边','历史'], desc: '600年历史的明清海防古城，深圳八景之首，值得一探。' },
];

// MOCK_PLACES 参考中心（深圳中心坐标，用于偏移到其他城市）
const MOCK_PLACES_CENTER = { lat: 22.54, lng: 114.05 };

/** 将预置地点偏移到目标城市中心附近 */
const shiftPlacesToCity = (places, city) => {
  if (!city || city.lat == null || city.lng == null) return places;
  const dLat = city.lat - MOCK_PLACES_CENTER.lat;
  const dLng = city.lng - MOCK_PLACES_CENTER.lng;
  return places.map(p => {
    const newLat = +(p.lat + dLat).toFixed(5);
    const newLng = +(p.lng + dLng).toFixed(5);
    return {
      ...p,
      lat: isNaN(newLat) ? p.lat : newLat,
      lng: isNaN(newLng) ? p.lng : newLng,
      name: p.name.replace(/深圳/g, city.name || ''),
    };
  });
};

// ──────────────────────────────────────
// 高德地图 API — 真实地点搜索
// ──────────────────────────────────────

const AMAP_KEY = ''; // 请替换为你的高德 Web API Key（从 https://lbs.amap.com/ 获取）

const AMAP_TYPE_MAP = {
  '运动健身': { category: 'sport', icon: 'fa-basketball', label: '运动场地' },
  '公园广场': { category: 'park', icon: 'fa-tree', label: '公园绿地' },
  '风景名胜': { category: 'park', icon: 'fa-tree', label: '公园绿地' },
  '科教文化': { category: 'indoor', icon: 'fa-building', label: '室内场所' },
  '购物': { category: 'indoor', icon: 'fa-building', label: '室内场所' },
  '餐饮': { category: 'indoor', icon: 'fa-building', label: '室内场所' },
  '休闲娱乐': { category: 'secret', icon: 'fa-star', label: '秘密基地' },
  '体育休闲': { category: 'sport', icon: 'fa-basketball', label: '运动场地' },
  '生活服务': { category: 'indoor', icon: 'fa-building', label: '室内场所' },
};

const AMAP_SEARCH_TYPES = [
  '运动健身|体育休闲服务|体育休闲服务',
  '公园广场|风景名胜|风景名胜',
  '科教文化服务|科教文化场所|科教文化场所',
  '购物服务|购物相关场所|购物相关场所',
  '餐饮服务|餐饮相关场所|餐饮相关场所',
];

function amapSearchNearby(lat, lng, radius, searchType) {
  return new Promise((resolve, reject) => {
    const callbackName = 'amap_cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const url = `https://restapi.amap.com/v3/place/around?key=${AMAP_KEY}&location=${lng},${lat}&radius=${radius}&types=${encodeURIComponent(searchType)}&offset=25&page=1&extensions=all&output=json&callback=${callbackName}`;
    window[callbackName] = function(data) {
      delete window[callbackName];
      const script = document.getElementById(callbackName);
      if (script) script.remove();
      if (data && data.status === '1' && data.pois) {
        resolve(data.pois);
      } else {
        reject(new Error(data.info || '搜索失败'));
      }
    };
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = url;
    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error('网络请求失败'));
    };
    document.head.appendChild(script);
  });
}

async function amapSearchAllNearby(lat, lng, radius = 2000) {
  // 未配置 API Key 时跳过搜索
  if (!AMAP_KEY) { console.log('[AMAP] 未配置 API Key，跳过真实搜索'); return []; }
  const allPois = [];
  const promises = AMAP_SEARCH_TYPES.map(async (type) => {
    try { const pois = await amapSearchNearby(lat, lng, radius, type); return pois; }
    catch (e) { return []; }
  });
  const results = await Promise.all(promises);
  const seen = new Set();
  results.flat().forEach(poi => {
    if (!seen.has(poi.id) && allPois.length < 40) {
      seen.add(poi.id);
      allPois.push(poi);
    }
  });
  return allPois;
}

function convertAmapPoiToPlace(poi, userLat, userLng) {
  const type = poi.type || '';
  let category = 'secret';
  for (const [key, val] of Object.entries(AMAP_TYPE_MAP)) {
    if (type.includes(key)) { category = val.category; break; }
  }
  if (type.includes('体育') || type.includes('运动') || type.includes('健身') || type.includes('篮球') || type.includes('足球') || type.includes('游泳')) {
    category = 'sport';
  } else if (type.includes('公园') || type.includes('风景') || type.includes('绿地') || type.includes('广场')) {
    category = 'park';
  } else if (type.includes('文化') || type.includes('图书') || type.includes('博物馆') || type.includes('购物') || type.includes('餐饮')) {
    category = 'indoor';
  }
  const dLat2 = (parseFloat(poi.location.split(',')[1]) - userLat) * 111320;
  const dLng2 = (parseFloat(poi.location.split(',')[0]) - userLng) * Math.cos(userLat * Math.PI / 180) * 111320;
  const distance = Math.round(Math.sqrt(dLat2 * dLat2 + dLng2 * dLng2) / 10) / 100;
  const [lng2, lat2] = poi.location.split(',').map(Number);
  const rating = +(poi.biz_ext && poi.biz_ext.rating ? parseFloat(poi.biz_ext.rating) : (3.5 + Math.random() * 1.5)).toFixed(1);
  const name = poi.name || '';
  const addr = poi.address || '';
  const catLabel = category === 'sport' ? '运动场地' : category === 'park' ? '公园绿地' : category === 'indoor' ? '室内场所' : '秘密基地';
  const descTemplates = {
    sport: [`位于${addr.slice(0,8)}附近的运动好去处，设施完善，环境舒适。`, `${name}是周边居民运动健身的热门选择，场地条件优越。`, `一处深受欢迎的运动场所，提供优质的运动体验。`],
    park: [`${name}是城市中的一片绿洲，环境优美，适合散步野餐。`, `${name}风景宜人，是周末休闲放松的绝佳去处。`, `${name}拥有优美的自然景观和舒适的休憩空间。`],
    indoor: [`${name}环境舒适，设施齐全，是休闲放松的好去处。`, `${name}是附近居民常去的室内场所，交通便利。`, `品质不错的${catLabel}，环境舒适，服务便捷。`],
    secret: [`${name}是藏在${addr.slice(0,8)}附近的小众好去处，值得探索。`, `${name}是一处鲜为人知的${catLabel}，氛围独特。`, `隐秘而有趣的${name}，适合喜欢探索新事物的你。`],
  };
  const templates = descTemplates[category] || descTemplates.secret;
  const desc = templates[Math.floor(Math.random() * templates.length)];
  const tagMap = { '篮球': '篮球','足球': '足球','游泳': '游泳','羽毛球': '羽毛球','网球': '网球','跑步': '跑步','健身': '健身','公园': '公园','绿道': '绿道','图书': '阅读','博物馆': '博物馆','咖啡': '咖啡','美食': '美食','商场': '购物','影院': '电影','河景': '河景','湖景': '湖景','海景': '海景','儿童': '亲子','免费': '免费', };
  const tags = [];
  for (const [k, v] of Object.entries(tagMap)) { if ((type.includes(k) || name.includes(k)) && tags.length < 3 && !tags.includes(v)) tags.push(v); }
  if (tags.length === 0) tags.push(category === 'sport' ? '运动' : category === 'park' ? '休闲' : category === 'indoor' ? '舒适' : '探索');
  return { id: 'amap_' + poi.id, name, address: addr, category, type: category === 'sport' ? 'sport' : category === 'park' ? 'park' : 'indoor', lat: lat2, lng: lng2, rating, distance, tags: tags.slice(0, 3), desc, source: 'amap', tel: poi.tel || '', photos: poi.photos || [] };
}

/** 10条社区动态（真实用户发帖将动态产生） */
const MOCK_POSTS = [];



/** 地点评价数据（真实用户评价将动态产生） */
const MOCK_REVIEWS = [];

/** 预置约玩数据（真实用户创建后动态产生） */
const MOCK_PLAY_DATES = [];

/** 附近真实用户名称池（每次基于定位生成不同的距离，模拟真实附近的人） */
const NEARBY_USER_POOL = [
  { id: 'u1',  name: '小明', avatar: '👦',   intro: '爱运动，喜欢打篮球', color: '#4A90D9' },
  { id: 'u2',  name: '小红', avatar: '👧',   intro: '喜欢逛公园和拍照', color: '#E91E63' },
  { id: 'u3',  name: '阿杰', avatar: '🧑',   intro: '羽毛球爱好者，周末约球', color: '#FF9800' },
  { id: 'u4',  name: '小美', avatar: '👩',   intro: '爱跑步爱生活', color: '#9C27B0' },
  { id: 'u5',  name: '老张', avatar: '👨',   intro: '棋牌达人，欢迎约战', color: '#795548' },
  { id: 'u6',  name: '莉莉', avatar: '👩‍🦰', intro: '喜欢看书和逛书店', color: '#00BCD4' },
  { id: 'u7',  name: '大伟', avatar: '🧔',   intro: '户外达人，周末常爬山', color: '#4CAF50' },
  { id: 'u8',  name: '小雨', avatar: '👩‍🦱', intro: '宝妈一枚，爱带娃遛公园', color: '#FF5722' },
  { id: 'u9',  name: '阿强', avatar: '💪',   intro: '健身爱好者，找搭子', color: '#FF6F00' },
  { id: 'u10', name: '小雅', avatar: '👩‍🎨', intro: '喜欢画画和手工', color: '#009688' },
  { id: 'u11', name: '大刘', avatar: '🚴',   intro: '骑行达人，周边都熟', color: '#3F51B5' },
  { id: 'u12', name: '思思', avatar: '👩‍💼', intro: '上班族，周末想放松', color: '#E040FB' },
  { id: 'u13', name: '老王', avatar: '🧓',   intro: '退休了，天天有空', color: '#607D8B' },
  { id: 'u14', name: '乐乐', avatar: '🐶',   intro: '养了一只金毛，爱遛狗', color: '#FFAB00' },
  { id: 'u15', name: '阿花', avatar: '🌻',   intro: '花艺师，热爱自然', color: '#8BC34A' },
  { id: 'u16', name: '小飞', avatar: '🏃',   intro: '马拉松爱好者', color: '#00B0FF' },
  { id: 'u17', name: '妮妮', avatar: '💃',   intro: '广场舞领舞，活力满满', color: '#FF4081' },
  { id: 'u18', name: '大勇', avatar: '🎣',   intro: '钓鱼佬，哪儿有鱼都知道', color: '#5D4037' },
  { id: 'u19', name: '小溪', avatar: '📸',   intro: '摄影爱好者，爱拍照', color: '#757575' },
  { id: 'u20', name: '阿宝', avatar: '🍳',   intro: '美食达人，会做菜', color: '#FF6D00' },
];

/**
 * 基于真实定位生成附近的人
 * 为每个用户分配随机偏移坐标，计算实际距离
 * @param {number} lat - 用户纬度
 * @param {number} lng - 用户经度  
 * @param {number} count - 生成人数 (默认 8~15 随机)
 * @returns {Array} 含 distance(km)、distanceText、lat、lng 的用户列表
 */
const generateNearbyUsers = (lat, lng, count = null) => {
  if (!lat || !lng) return [];
  const n = count || rand(8, 15);
  // 随机选人并打乱
  const shuffled = [...NEARBY_USER_POOL].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(n, shuffled.length));

  return selected.map(u => {
    // 随机偏移：50m ~ 5000m 范围的经纬度偏移
    const angle = Math.random() * Math.PI * 2;       // 随机方向
    const distKm = (rand(5, 500)) / 100;              // 0.05 ~ 5.0 km（真实附近范围）
    const dLat = (distKm / 111.32) * Math.cos(angle); // 纬度偏移（1°≈111.32km）
    const dLng = (distKm / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);

    const userLat = +(lat + dLat).toFixed(5);
    const userLng = +(lng + dLng).toFixed(5);
    const distance = calcDistance(lat, lng, userLat, userLng);

    return {
      ...u,
      lat: userLat,
      lng: userLng,
      distance,
      distanceText: formatDistance(distance),
      online: Math.random() > 0.25, // 75% 概率在线
      lastSeen: Math.random() > 0.5
        ? `${rand(1, 59)}分钟前`
        : `${rand(1, 24)}小时前`,
    };
  }).sort((a, b) => a.distance - b.distance);
};

// 图片占位渐变
const GRAD_MAP = {
  'grad-1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'grad-2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'grad-3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'grad-4': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'grad-5': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
};

const PLACE_CATEGORY_GRAD = {
  sport: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
  park: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
  indoor: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
  secret: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
};

const PLACE_CATEGORY_COLOR = {
  sport: '#2196F3',
  park: '#4CAF50',
  indoor: '#FF9800',
  secret: '#9C27B0',
};

const PLACE_CATEGORY_ICON = {
  sport: 'fa-basketball',
  park: 'fa-tree',
  indoor: 'fa-building',
  secret: 'fa-star',
};

const PLACE_CATEGORY_LABEL = {
  sport: '运动场地',
  park: '公园绿地',
  indoor: '室内场所',
  secret: '秘密基地',
};

// 天气数据
const WEATHER_OPTIONS = [
  { type: 'sunny', label: '晴', icon: 'fa-sun', color: '#FF9800' },
  { type: 'cloudy', label: '多云', icon: 'fa-cloud-sun', color: '#90A4AE' },
  { type: 'rain', label: '小雨', icon: 'fa-cloud-rain', color: '#42A5F5' },
  { type: 'overcast', label: '阴天', icon: 'fa-cloud', color: '#78909C' },
];

function generateWeather() {
  return WEATHER_OPTIONS[rand(0, 3)];
}

function generateAQI() {
  return rand(30, 150);
}

/** 动态综合评分算法 */
function calculateDynamicScore(place, weather, aqi, hour) {
  let baseScore = place.rating;
  const isOutdoor = place.type === 'park' || place.type === 'sport';
  const isIndoor = place.type === 'indoor';

  // 天气因素
  if (weather.type === 'sunny' && isOutdoor) baseScore += 0.5;
  if (weather.type === 'rain' && isIndoor) baseScore += 0.5;

  // AQI因素
  if (aqi < 50 && isOutdoor) baseScore += 0.3;
  if (aqi > 100) baseScore -= 0.2;

  // 时间因素
  if (hour >= 6 && hour <= 20) {
    if (isOutdoor) baseScore += 0.2;
  } else {
    if (isOutdoor) baseScore -= 0.5;
  }

  return Math.max(1.0, Math.min(5.0, +baseScore.toFixed(1)));
}

/** 获取推荐理由 */
function getRecommendReason(place, weather, aqi, hour) {
  const reasons = [];
  if (hour >= 20 && (place.type === 'park' || place.type === 'sport')) {
    reasons.push('天黑了注意安全');
  }
  if (weather.type === 'sunny' && (place.type === 'park' || place.type === 'sport')) {
    reasons.push('大晴天，不出门可惜了');
  }
  if (weather.type === 'rain' && place.type === 'indoor') {
    reasons.push('下雨天待室内最舒服');
  }
  if (aqi < 50) {
    reasons.push('空气不错，出去透透气');
  }
  if (aqi > 100) {
    reasons.push('空气一般，别跑太猛');
  }
  if (hour >= 6 && hour < 10) {
    reasons.push('早上凉快，出来转转');
  }
  if (hour >= 10 && hour < 14) {
    reasons.push('大中午的，找个阴凉地儿');
  }
  if (hour >= 14 && hour < 18) {
    reasons.push('下午了，喊人一块儿去');
  }
  if (hour >= 18 && hour < 20) {
    reasons.push('傍晚凉快了，该出门了');
  }
  if (reasons.length === 0) {
    reasons.push('啥时候去都行');
  }
  return reasons.join(' · ');
}

// 全局状态 Hook
function useAppState() {
  const [currentPage, setCurrentPage] = useState('home');
  const [weather, setWeather] = useState(() => generateWeather());
  const [aqi, setAqi] = useState(() => generateAQI());
  const [hour] = useState(() => currentHour());

  // 地点数据（选择城市后会偏移坐标，用 allPlaces 统一输出）
  const [places, setPlaces] = useState(() => MOCK_PLACES);
  const [nearbyPois, setNearbyPois] = useState(() => {
    const saved = localStorage.getItem('nlqw_nearby_pois');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchingNearby, setSearchingNearby] = useState(false);

  // 动态数据
  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem('nlqw_posts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }
    return MOCK_POSTS;
  });

  // 约玩数据
  const [playDates, setPlayDates] = useState(() => {
    const saved = localStorage.getItem('nlqw_playdates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }
    return MOCK_PLAY_DATES;
  });

  // 评价数据
  const [reviews, setReviews] = useState(() => {
    const saved = localStorage.getItem('nlqw_reviews');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }
    return MOCK_REVIEWS;
  });



  // 收藏
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('nlqw_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleFavorite = useCallback((itemId, type = 'post') => {
    const uid = currentUser.id;
    setFavorites(prev => {
      const key = type + '_' + itemId;
      if (prev.includes(key)) {
        removeFavoriteFromSupabase(uid, itemId, type).catch(e => console.warn('[Supabase] removeFavorite 异常:', e));
        return prev.filter(f => f !== key);
      } else {
        addFavoriteToSupabase(uid, itemId, type).catch(e => console.warn('[Supabase] addFavorite 异常:', e));
        return [...prev, key];
      }
    });
  }, [currentUser.id]);

  const isFavorite = useCallback((itemId, type = 'post') => {
    return favorites.includes(type + '_' + itemId);
  }, [favorites]);

  // 当前用户
  const [currentUser] = useState({ id: 'u0', name: '我' });

  // 用户定位（全局共享，跨页面使用）
  const [userLocation, setUserLocation] = useState(() => {
    const saved = localStorage.getItem('nlqw_user_location');
    return saved ? JSON.parse(saved) : null; // { lat, lng }
  });

  // 好友列表
  const [friends, setFriends] = useState(() => {
    const saved = localStorage.getItem('nlqw_friends');
    return saved ? JSON.parse(saved) : [];
  });

  // 待处理的好友申请（别人发给我的）
  const [friendRequests, setFriendRequests] = useState([]);

  // 我发出的待处理申请 ID 集合
  const [sentRequestIds, setSentRequestIds] = useState(new Set());

  // 聊天消息 { friendId: [{ id, from, text, time }] }
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('nlqw_messages');
    return saved ? JSON.parse(saved) : {};
  });

  // 附近的人（基于定位动态生成）
  const [nearbyUsers, setNearbyUsers] = useState(() => {
    const saved = localStorage.getItem('nlqw_nearby_users');
    if (saved) {
      try { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) return p; } catch(e) {}
    }
    return [];
  });

  // 刷新附近用户
  const refreshNearbyUsers = useCallback((lat, lng) => {
    const users = generateNearbyUsers(lat, lng);
    setNearbyUsers(users);
    return users;
  }, []);

  // 当前选中的城市（null 表示未选择，使用 GPS 定位）
  const [selectedCity, setSelectedCity] = useState(() => {
    const saved = localStorage.getItem('nlqw_selected_city');
    return saved ? JSON.parse(saved) : null; // { name, lat, lng, region }
  });

  // 搜索附近地点
  const searchNearby = useCallback(async (lat, lng, radius = 2000) => {
    // 未配置 API Key 时跳过搜索
    if (!AMAP_KEY) { setSearchingNearby(false); return []; }
    setSearchingNearby(true);
    try {
      const pois = await amapSearchAllNearby(lat, lng, radius);
      const places = pois.map(poi => convertAmapPoiToPlace(poi, lat, lng));
      setNearbyPois(places);
      setSearchingNearby(false);
      return places;
    } catch (e) {
      console.error('搜索附近失败:', e);
      setSearchingNearby(false);
      return [];
    }
  }, []);

  // 选择城市：模拟定位到该城市中心附近，并搜索该城市的真实地点
  const selectCity = useCallback((city) => {
    if (!city) {
      // 取消选择城市，恢复使用 GPS
      setSelectedCity(null);
      setUserLocation(null);
      setNearbyUsers([]);
      setNearbyPois([]);
      setPlaces(MOCK_PLACES);
      localStorage.removeItem('nlqw_selected_city');
      localStorage.removeItem('nlqw_nearby_pois');
      return;
    }
    // 清除之前的附近POI缓存，准备搜索新城市
    setNearbyPois([]);
    localStorage.removeItem('nlqw_nearby_pois');
    // 在城市中心附近随机偏移 1-3km，模拟在该城市内
    const angle = Math.random() * Math.PI * 2;
    const offsetKm = rand(10, 300) / 100; // 0.1 ~ 3.0 km
    const dLat = (offsetKm / 111.32) * Math.cos(angle);
    const dLng = (offsetKm / (111.32 * Math.cos(city.lat * Math.PI / 180))) * Math.sin(angle);
    const loc = { lat: +(city.lat + dLat).toFixed(5), lng: +(city.lng + dLng).toFixed(5) };
    setSelectedCity({ name: city.name, lat: city.lat, lng: city.lng, region: city.region });
    setUserLocation(loc);
    refreshNearbyUsers(loc.lat, loc.lng);
    // 先将预置地点偏移到所选城市（作为搜索期间的回退展示）
    setPlaces(shiftPlacesToCity(MOCK_PLACES, city));
    localStorage.setItem('nlqw_selected_city', JSON.stringify({ name: city.name, lat: city.lat, lng: city.lng, region: city.region }));
    // 异步搜索该城市的真实 POI（搜索范围 5km，覆盖城市核心区域）
    searchNearby(city.lat, city.lng, 5000);
  }, [setUserLocation, refreshNearbyUsers, setPlaces, setNearbyPois, searchNearby]);

  // 持久化
  useEffect(() => { localStorage.setItem('nlqw_posts', JSON.stringify(posts)); }, [posts]);
  useEffect(() => { localStorage.setItem('nlqw_playdates', JSON.stringify(playDates)); }, [playDates]);
  useEffect(() => { localStorage.setItem('nlqw_reviews', JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => { localStorage.setItem('nlqw_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('nlqw_friends', JSON.stringify(friends)); }, [friends]);
  useEffect(() => { localStorage.setItem('nlqw_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('nlqw_nearby_users', JSON.stringify(nearbyUsers)); }, [nearbyUsers]);
  useEffect(() => { if (userLocation) localStorage.setItem('nlqw_user_location', JSON.stringify(userLocation)); }, [userLocation]);
  useEffect(() => { localStorage.setItem('nlqw_nearby_pois', JSON.stringify(nearbyPois)); }, [nearbyPois]);

  // 页面刷新后如果已选城市，需要恢复地点偏移并搜索真实地点
  useEffect(() => {
    if (selectedCity && selectedCity.lat != null && selectedCity.lng != null) {
      setNearbyPois([]);
      localStorage.removeItem('nlqw_nearby_pois');
      setPlaces(shiftPlacesToCity(MOCK_PLACES, selectedCity));
      searchNearby(selectedCity.lat, selectedCity.lng, 5000);
    }
  }, []); // 仅在组件挂载时执行一次

  // 更新动态
  const updatePost = useCallback((postId, updates) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  }, []);

  const addPost = useCallback((newPost) => {
    setPosts(prev => [newPost, ...prev]);
    savePostToSupabase(newPost).catch(e => console.warn('[Supabase] savePostToSupabase 异常:', e));
  }, []);

  const deletePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    deletePostFromSupabase(postId).catch(e => console.warn('[Supabase] deletePost 异常:', e));
  }, []);

  // 更新约玩
  const updatePlayDate = useCallback((playId, updates) => {
    setPlayDates(prev => prev.map(p => p.id === playId ? { ...p, ...updates } : p));
  }, []);

  const addPlayDate = useCallback((newPlay) => {
    setPlayDates(prev => [newPlay, ...prev]);
  }, []);

  const deletePlayDate = useCallback((playId) => {
    setPlayDates(prev => prev.filter(p => p.id !== playId));
  }, []);

  // 更新评价
  const addReview = useCallback((newReview) => {
    setReviews(prev => [newReview, ...prev]);
  }, []);

  const updateReview = useCallback((reviewId, updates) => {
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...updates } : r));
  }, []);

  const deleteReview = useCallback((reviewId) => {
    setReviews(prev => prev.filter(r => r.id !== reviewId));
  }, []);


  // 社区帖子评论（全局状态）
  const [postComments, setPostComments] = useState(() => {
    const saved = localStorage.getItem('nlqw_post_comments');
    if (saved) return JSON.parse(saved);
    // 社区评论由真实用户动态产生
    return {};
  });

  const addPostComment = useCallback((postId, text, currentUser, postTitle = '') => {
    if (!text.trim()) return;
    const commentId = '' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    setPostComments(prev => {
      const newComments = { ...prev };
      if (!newComments[postId]) newComments[postId] = [];
      newComments[postId] = [
        ...newComments[postId],
        {
          id: commentId,
          userId: currentUser.id,
          userName: currentUser.name,
          text,
          time: '刚刚',
          postId,
          postTitle: postTitle || '',
        },
      ];
      localStorage.setItem('nlqw_post_comments', JSON.stringify(newComments));
      return newComments;
    });
    // 同步更新帖子评论数
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p));
    // 同步到 Supabase
    const newCount = (postComments[postId] || []).length + 1;
    updatePostToSupabase(postId, { comments: newCount }).catch(e => console.warn('[Supabase] updatePostToSupabase 异常:', e));
    saveCommentToSupabase({
      id: commentId, postId, userId: currentUser.id,
      userName: currentUser.name, text, time: '刚刚', postTitle: postTitle || ''
    }).catch(e => console.warn('[Supabase] saveCommentToSupabase 异常:', e));
  }, [postComments]);

  const deletePostComment = useCallback((postId, commentId) => {
    setPostComments(prev => {
      const newComments = { ...prev };
      if (newComments[postId]) {
        newComments[postId] = newComments[postId].filter(c => c.id !== commentId);
      }
      return newComments;
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 1) - 1) } : p));
    deleteCommentFromSupabase(commentId).catch(e => console.warn('[Supabase] deleteComment 异常:', e));
  }, []);





  // 好友管理（申请制）
  const sendFriendRequest = useCallback((userId, userData) => {
    var user = userData || nearbyUsers.find(function(u) { return u.id === userId; });
    if (!user) { console.warn('[sendFriendRequest] 未找到用户:', userId); return; }
    sendFriendRequestToSupabase(currentUser.id, userId).then(function(ok) {
      if (ok) console.log('[Supabase] 好友申请已发送:', userId);
    });
    setSentRequestIds(function(prev) { var n = new Set(prev); n.add(userId); return n; });
  }, [nearbyUsers, currentUser.id]);

  const acceptFriendRequest = useCallback((fromUserId, requestData) => {
    var userMeta = requestData || {};
    acceptFriendRequestToSupabase(fromUserId, currentUser.id).then(function(ok) {
      if (!ok) return;
      setFriends(function(prev) {
        if (prev.find(function(f) { return f.id === fromUserId; })) return prev;
        return [...prev, { id: fromUserId, name: userMeta.fromUserName || ('邻居' + fromUserId.slice(-4)), avatar: userMeta.fromUserAvatar || '👤', color: userMeta.fromUserColor || '#4A90D9' }];
      });
      setFriendRequests(function(prev) { return prev.filter(function(r) { return r.fromUserId !== fromUserId; }); });
    });
  }, [currentUser.id]);

  const rejectFriendRequest = useCallback((fromUserId) => {
    rejectFriendRequestToSupabase(fromUserId, currentUser.id).then(function(ok) {
      if (ok) console.log('[Supabase] 已拒绝好友申请:', fromUserId);
    });
    setFriendRequests(function(prev) { return prev.filter(function(r) { return r.fromUserId !== fromUserId; }); });
  }, [currentUser.id]);

  const removeFriend = useCallback((friendId) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
  }, []);

  const getFriends = useCallback(() => friends, [friends]);

  // 聊天消息
  const sendMessage = useCallback((friendId, text) => {
    if (!text.trim()) return;
    setMessages(prev => {
      const newMessages = { ...prev };
      if (!newMessages[friendId]) newMessages[friendId] = [];
      newMessages[friendId] = [
        ...newMessages[friendId],
        { id: uuid(), from: 'me', text: text.trim(), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
      ];
      // 模拟对方自动回复
      setTimeout(() => {
        const autoReplies = [
          '好的，收到！',
          '哈哈，说得好！',
          '有道理~',
          '是的呢！',
          '👍',
          '到时候见！',
          '没问题！',
          '😊',
        ];
        setMessages(prev2 => {
          const nm = { ...prev2 };
          if (!nm[friendId]) nm[friendId] = [];
          nm[friendId] = [
            ...nm[friendId],
            { id: uuid(), from: friendId, text: autoReplies[Math.floor(Math.random() * autoReplies.length)], time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
          ];
          return nm;
        });
      }, 800 + Math.random() * 1500);
      return newMessages;
    });
  }, []);

  const getChatMessages = useCallback((friendId) => {
    return messages[friendId] || [];
  }, [messages]);

  // 添加新地点
  const [customPlaces, setCustomPlaces] = useState(() => {
    const saved = localStorage.getItem('nlqw_custom_places');
    return saved ? JSON.parse(saved) : [];
  });

  const addPlace = useCallback((newPlace) => {
    setCustomPlaces(prev => {
      const updated = [...prev, newPlace];
      localStorage.setItem('nlqw_custom_places', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const allPlaces = useMemo(() => {
    if (nearbyPois.length > 0) {
      return [...nearbyPois, ...customPlaces];
    }
    return [...places, ...customPlaces];
  }, [places, customPlaces, nearbyPois]);

  // ===== 应用启动时从 Supabase 加载社区数据 =====
  useEffect(() => {
    const uid = currentUser.id;
    if (!uid) return;
    const sb = getSupabase();
    if (!sb) return;
    console.log('[Supabase] 开始加载社区数据...');
    Promise.all([
      loadPostsFromSupabase(),
      loadPostCommentsFromSupabase(),
      loadLikesFromSupabase(uid),
      loadFavoritesFromSupabase(uid)
    ]).then(([supabasePosts, supabaseComments, supabaseLikes, supabaseFavorites]) => {
      if (supabasePosts && supabasePosts.length > 0) {
        console.log('[Supabase] 社区帖子加载完成:', supabasePosts.length, '篇');
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = supabasePosts.filter(p => !existingIds.has(p.id));
          return [...newPosts, ...prev];
        });
      }
      if (supabaseComments && Object.keys(supabaseComments).length > 0) {
        const total = Object.values(supabaseComments).reduce((s, a) => s + a.length, 0);
        console.log('[Supabase] 社区评论加载完成:', total, '条');
        setPostComments(prev => {
          const merged = { ...prev };
          Object.keys(supabaseComments).forEach(postId => {
            if (!merged[postId]) merged[postId] = supabaseComments[postId];
            else {
              const existingIds = new Set(merged[postId].map(c => c.id));
              const newComments = supabaseComments[postId].filter(c => !existingIds.has(c.id));
              merged[postId] = [...merged[postId], ...newComments];
            }
          });
          return merged;
        });
      }
      if (supabaseLikes && supabaseLikes.length > 0) {
        console.log('[Supabase] 点赞记录加载完成:', supabaseLikes.length, '条');
        localStorage.setItem('nlqw_liked_posts', JSON.stringify(supabaseLikes));
      }
      if (supabaseFavorites && supabaseFavorites.length > 0) {
        console.log('[Supabase] 收藏加载完成:', supabaseFavorites.length, '条');
        setFavorites(prev => {
          const existingSet = new Set(prev);
          const newFavs = supabaseFavorites.filter(f => !existingSet.has(f));
          return [...prev, ...newFavs];
        });
      }
    }).catch(e => console.warn('[Supabase] 社区数据加载异常:', e && e.message));
  }, [currentUser.id]);

  // ===== 应用启动时从 Supabase 加载好友申请 =====
  useEffect(() => {
    const uid = currentUser.id;
    if (!uid) return;
    loadFriendRequestsFromSupabase(uid).then(data => {
      if (data && data.length > 0) setFriendRequests(data);
    }).catch(e => console.warn('[Supabase] 好友申请加载异常:', e && e.message));
    loadSentFriendRequestsFromSupabase(uid).then(ids => {
      if (ids && ids.length > 0) setSentRequestIds(new Set(ids));
    }).catch(e => console.warn('[Supabase] 已发送申请加载异常:', e && e.message));
  }, [currentUser.id]);

  // ===== 实时订阅：好友申请 =====
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const uid = currentUser.id;
    if (!uid) return;
    const channel = subscribeToFriendRequests(uid, request => {
      setFriendRequests(prev => {
        if (prev.find(r => r.fromUserId === request.fromUserId)) return prev;
        return [...prev, request];
      });
    });
    return () => { if (channel) { try { channel.unsubscribe(); } catch(e) {} } };
  }, [currentUser.id]);

  // ===== 实时订阅：社区帖子 =====
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const channel = subscribeToCommunityPosts(
      (newPost) => {
        setPosts(prev => {
          if (prev.find(p => p.id === newPost.id)) return prev;
          console.log('[Supabase] 社区新帖子:', newPost.title);
          return [newPost, ...prev];
        });
      },
      (postId, updates) => {
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          const updated = { ...p };
          if (updates.likes !== undefined) updated.likes = updates.likes;
          if (updates.comments !== undefined) updated.comments = updates.comments;
          return updated;
        }));
      },
      (postId) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setPostComments(prev => { const nc = { ...prev }; delete nc[postId]; return nc; });
      }
    );
    return () => { if (channel) { try { channel.unsubscribe(); } catch(e) {} } };
  }, []);

  // ===== 实时订阅：社区评论 =====
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const channel = subscribeToCommunityComments((newComment) => {
      setPostComments(prev => {
        const newComments = { ...prev };
        if (!newComments[newComment.postId]) newComments[newComment.postId] = [];
        if (newComments[newComment.postId].some(c => c.id === newComment.id)) return prev;
        newComments[newComment.postId] = [...newComments[newComment.postId], newComment];
        console.log('[Supabase] 社区新评论:', newComment.postId);
        return newComments;
      });
      setPosts(prev => prev.map(p => p.id === newComment.postId ? { ...p, comments: (p.comments || 0) + 1 } : p));
    }, (postId, commentId) => {
      setPostComments(prev => {
        const nc = { ...prev };
        if (nc[postId]) nc[postId] = nc[postId].filter(c => c.id !== commentId);
        return nc;
      });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 1) - 1) } : p));
    });
    return () => { if (channel) { try { channel.unsubscribe(); } catch(e) {} } };
  }, []);

  return {
    currentPage, setCurrentPage,
    weather, setWeather, aqi, setAqi, hour,
    places: allPlaces, customPlaces, addPlace,
    nearbyPois, searchNearby, searchingNearby,
    posts, updatePost, addPost, deletePost,
    playDates, updatePlayDate, addPlayDate, deletePlayDate,
    reviews, addReview, updateReview, deleteReview,
    favorites, toggleFavorite, isFavorite,
    postComments, addPostComment, deletePostComment,
    currentUser,
    friends, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, getFriends, removedFriendIds: new Set(), friendRequests, sentRequestIds,
    messages, sendMessage, getChatMessages,
    nearbyUsers, refreshNearbyUsers,
    userLocation, setUserLocation,
    selectedCity, selectCity,
  };
}

function AppProvider({ children }) {
  const state = useAppState();
  return (
    <AppContext.Provider value={state}>
      {children}
    </AppContext.Provider>
  );
}

function useApp() {
  return useContext(AppContext);
}

// 星星评分组件
function StarRating({ rating, interactive = false, onChange, size = 16, showNumber = false }) {
  const [hoverRating, setHoverRating] = useState(0);
  const [animatingStar, setAnimatingStar] = useState(0);

  const displayRating = hoverRating || rating;

  const handleClick = (val) => {
    if (interactive && onChange) {
      onChange(val);
      setAnimatingStar(val);
      setTimeout(() => setAnimatingStar(0), 400);
    }
  };

  return (
    <div className={`stars ${interactive ? 'interactive' : ''}`}>
      {[1,2,3,4,5].map(i => {
        const filled = i <= Math.floor(displayRating);
        const half = !filled && i - 0.5 <= displayRating;
        const anim = animatingStar && i <= animatingStar;
        return (
          <span
            key={i}
            className={`star-icon ${filled ? 'star-filled' : ''} ${half ? 'star-half' : ''} ${anim ? 'star-pop' : ''}`}
            style={{ fontSize: size + 'px' }}
            onClick={() => handleClick(i)}
            onMouseEnter={() => interactive && setHoverRating(i)}
            onMouseLeave={() => interactive && setHoverRating(0)}
          >
            <i className={`fa-star ${filled || half ? 'fa-solid' : 'fa-regular'}`}></i>
          </span>
        );
      })}
      {showNumber && (
        <span className="star-number" style={{ fontSize: size * 0.85 + 'px' }}>{rating.toFixed(1)}</span>
      )}
    </div>
  );
}

// 底部导航栏
function BottomNav() {
  const { currentPage, setCurrentPage, messages } = useApp();

  // 计算消息总数
  const totalMsgs = useMemo(() => {
    let count = 0;
    Object.keys(messages).forEach(friendId => {
      count += (messages[friendId] || []).length;
    });
    return count;
  }, [messages]);

  const tabs = [
    { key: 'home', label: '首页', icon: 'fa-house' },
    { key: 'map', label: '地图', icon: 'fa-map-location-dot' },
    { key: 'messages', label: '消息', icon: 'fa-comments', badge: totalMsgs },
    { key: 'community', label: '社区', icon: 'fa-users' },
    { key: 'profile', label: '我的', icon: 'fa-user' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`nav-item ${currentPage === tab.key ? 'active' : ''}`}
          onClick={() => setCurrentPage(tab.key)}
        >
          <span className="nav-icon-wrap">
            <i className={`fa-solid ${tab.icon}`}></i>
            {tab.badge > 0 && (
              <span className={`nav-badge ${tab.badge < 10 ? '' : ''}`}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

// 首页
function HomePage() {
  const { weather, aqi, hour, places, playDates, reviews, setCurrentPage, selectedCity, selectCity } = useApp();
  const [scores, setScores] = useState([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearchText, setCitySearchText] = useState('');

  useEffect(() => {
    const scored = places.map(p => ({
      ...p,
      dynamicScore: calculateDynamicScore(p, weather, aqi, hour),
      reason: getRecommendReason(p, weather, aqi, hour),
    }));
    scored.sort((a, b) => b.dynamicScore - a.dynamicScore);
    setScores(scored.slice(0, 5));
  }, [places, weather, aqi, hour]);

  // 热门评价（取最新的3条高评分评价）
  const hotReviews = useMemo(() => {
    return [...reviews].sort((a, b) => b.likes - a.likes).slice(0, 3);
  }, [reviews]);

  const getPlaceName = (placeId) => {
    const p = places.find(pl => pl.id === placeId);
    return p ? p.name : '未知地点';
  };

  const handlePlayNow = (place) => {
    // 存储要发起约玩的地点并触发全局事件
    sessionStorage.setItem('nlqw_play_place', JSON.stringify(place));
    window.dispatchEvent(new CustomEvent('openPlayDate', { detail: place }));
  };

  return (
    <div className="page-container page-enter">
      {/* 顶部 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, background: 'linear-gradient(135deg, var(--accent-color), var(--star-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          邻里探玩
        </h1>
        <div className="flex-center gap-8 mt-8">
          <span className="text-sm text-muted">{formatDate(new Date())}</span>
          <span className="tag tag-blue">
            <i className={`fa-solid ${weather.icon}`}></i> {weather.label}
          </span>
          <span className="tag tag-green">
            AQI {aqi} {aqi < 50 ? '优' : aqi < 100 ? '良' : '轻度污染'}
          </span>
        </div>
      </div>

      {/* 推荐卡片 */}
      <div className="mb-16">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          <i className="fa-solid fa-compass text-accent"></i> 现在去哪？动态综合评分推荐
        </h2>
        {scores.map((place, idx) => (
          <div key={place.id} className="card" style={{ animation: `fadeInUp 0.4s ${idx * 0.1}s both`, cursor: 'pointer' }} onClick={() => window.dispatchEvent(new CustomEvent('openPlaceDetail', { detail: place }))}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="img-placeholder" style={{ width: 80, height: 80, flexShrink: 0, background: PLACE_CATEGORY_GRAD[place.category] || 'var(--gradient-1)' }}>
                <i className={`fa-solid ${PLACE_CATEGORY_ICON[place.category] || 'fa-location-dot'}`} style={{ fontSize: 28 }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex-between mb-8">
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{place.name}</h3>
                  <span className="tag" style={{ background: PLACE_CATEGORY_GRAD[place.category], color: '#FFF', fontSize: 12, fontWeight: 600, padding: '2px 8px' }}>
                    {PLACE_CATEGORY_LABEL[place.category]}
                  </span>
                </div>
                <div className="flex-center gap-8 mb-8">
                  <StarRating rating={place.dynamicScore} size={14} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--star-color)' }}>{place.dynamicScore}</span>
                  <span className="text-xs text-muted">(原{place.rating})</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--nav-inactive)', lineHeight: 1.5 }}>{place.reason}</p>
                <div className="flex-between mt-8">
                  <span className="text-xs text-muted">
                    <i className="fa-solid fa-location-dot"></i> {formatDistance(place._actualDistance || place.distance)}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      sessionStorage.setItem('nlqw_play_place', JSON.stringify(place));
                      window.dispatchEvent(new CustomEvent('openPlayDate', { detail: place }));
                    }}
                  >
                    <i className="fa-solid fa-paper-plane"></i> 发起约玩
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 热门评价 */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          <i className="fa-solid fa-fire text-accent"></i> 热门评价
        </h2>
        {hotReviews.map(review => (
          <div key={review.id} className="card" style={{ padding: 12 }}>
            <div className="flex-between mb-8">
              <div className="flex-center gap-8">
                <div className="avatar avatar-sm">{review.userName[0]}</div>
                <div>
                  <div className="font-bold text-sm">{review.userName}</div>
                  <StarRating rating={review.rating} size={12} />
                </div>
              </div>
              <span className="text-xs text-muted">{review.time}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>{review.text}</p>
            <div className="flex-between mt-8">
              <span className="text-xs text-muted">
                <i className="fa-solid fa-location-dot"></i> {getPlaceName(review.placeId)}
              </span>
              <span className="text-xs text-muted">
                <i className="fa-solid fa-thumbs-up"></i> {review.likes}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

// 地图页
function MapPage() {
  const { places, addPlace, userLocation, setUserLocation } = useApp();
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPlayDate, setShowPlayDate] = useState(false);
  const [playPlace, setPlayPlace] = useState(null);

  // 搜索 & 筛选状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('distance');
  const [showFilters, setShowFilters] = useState(false);

  // 地图点击标记模式
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [markPosition, setMarkPosition] = useState(null);

  // Leaflet 地图相关
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // 用户定位状态
  const [showLegend, setShowLegend] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const userMarkerRef = useRef(null);

  // 图层切换状态
  const [tileLayer, setTileLayer] = useState('normal'); // 'normal' | 'satellite'
  const tileLayerRef = useRef(null);

  // 搜索周边状态
  const [searchRadius, setSearchRadius] = useState(2000); // 搜索半径（米）
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  // 中心点（深圳市民中心附近）
  const MAP_CENTER = [22.543, 114.058];

  // 监听约玩事件
  useEffect(() => {
    const handleOpen = (e) => {
      if (e.detail) {
        setPlayPlace(e.detail);
        setShowPlayDate(true);
      }
    };
    window.addEventListener('openPlayDate', handleOpen);
    // 检查 sessionStorage
    const saved = sessionStorage.getItem('nlqw_play_place');
    if (saved) {
      try {
        const place = JSON.parse(saved);
        setPlayPlace(place);
        setShowPlayDate(true);
        sessionStorage.removeItem('nlqw_play_place');
      } catch(e) {}
    }
    return () => window.removeEventListener('openPlayDate', handleOpen);
  }, []);

  // 搜索 & 筛选 & 排序
  const filteredPlaces = useMemo(() => {
    let result = [...places];

    // 为每个地点计算与用户位置的实际距离（如果用户已定位）
    if (userLocation) {
      result = result.map(p => ({
        ...p,
        _actualDistance: calcDistance(userLocation.lat, userLocation.lng, p.lat, p.lng),
      }));
    } else {
      // 未定位时使用预设距离
      result = result.map(p => ({
        ...p,
        _actualDistance: p.distance,
      }));
    }

    // 关键词搜索：匹配名称、描述、标签
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.desc.toLowerCase().includes(kw) ||
        p.tags.some(t => t.toLowerCase().includes(kw)) ||
        (PLACE_CATEGORY_LABEL[p.category] || '').includes(kw)
      );
    }

    // 分类筛选
    if (activeCategory !== 'all') {
      result = result.filter(p => p.category === activeCategory);
    }

    // 按实际距离筛选（用户已定位时生效）
    if (userLocation) {
      const radiusKm = searchRadius / 1000;
      result = result.filter(p => p._actualDistance <= radiusKm);
    }

    // 排序
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        break;
      case 'distance':
      default:
        result.sort((a, b) => a._actualDistance - b._actualDistance);
        break;
    }

    return result;
  }, [places, searchKeyword, activeCategory, sortBy, userLocation, searchRadius]);

  // 定位到当前位置
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('浏览器不支持定位');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocating(false);
        // 地图飞行到用户位置
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(loc, 16, { duration: 1 });
        }
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case 1: setLocationError('请开启定位权限'); break;
          case 2: setLocationError('无法获取您的位置信息'); break;
          case 3: setLocationError('定位请求超时，请重试'); break;
          default: setLocationError('定位失败，请检查网络后重试');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // 更新用户位置标记
  useEffect(() => {
    if (viewMode !== 'map' || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div class="user-location-dot">
          <div class="user-location-pulse"></div>
          <div class="user-location-inner"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      // 添加精度圈
      const circle = L.circle([userLocation.lat, userLocation.lng], {
        radius: 50,
        color: '#4A90D9',
        fillColor: '#4A90D9',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '4, 4',
      }).addTo(map);
      userMarkerRef.current._circle = circle;
    }

    return () => {
      if (userMarkerRef.current && mapInstanceRef.current) {
        if (userMarkerRef.current._circle) {
          mapInstanceRef.current.removeLayer(userMarkerRef.current._circle);
        }
      }
    };
  }, [userLocation, viewMode]);

  // 图层切换
  const switchTileLayer = useCallback((type) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let newLayer;
    if (type === 'satellite') {
      // 高德卫星图（含标注）
      newLayer = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=6&x={x}&y={y}&z={z}', {
        subdomains: '1234',
        maxZoom: 18,
        minZoom: 3,
      });
    } else {
      // 高德标准地图
      newLayer = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}', {
        subdomains: '1234',
        maxZoom: 18,
        minZoom: 3,
      });
    }

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
    setTileLayer(type);
  }, []);

  // 路径导航（打开高德地图）
  const handleNavigate = useCallback((placeLat, placeLng, placeName) => {
    const origin = userLocation
      ? `${userLocation.lat},${userLocation.lng}`
      : '';
    const dest = `${placeLat},${placeLng}`;
    // 使用高德地图 URI 方案
    const url = `https://uri.amap.com/navigation?from=${origin}&to=${dest},${encodeURIComponent(placeName)}&mode=car&callnative=1`;
    window.open(url, '_blank');
  }, [userLocation]);

  // 创建自定义地图标记图标（带选中状态）
  const createMarkerIcon = useCallback((category, isSelected = false) => {
    const color = PLACE_CATEGORY_COLOR[category] || '#666';
    const iconChar = PLACE_CATEGORY_ICON[category] || 'fa-map-pin';
    const size = isSelected ? 48 : 38;
    const fontSize = isSelected ? 18 : 15;
    return L.divIcon({
      className: `custom-marker ${isSelected ? 'marker-selected' : ''}`,
      html: `<div class="marker-pin ${isSelected ? 'marker-pin-selected' : ''}" style="background:${color};width:${size}px;height:${size}px;">
        <div class="marker-pulse" style="background:${color};"></div>
        <i class="fa-solid ${iconChar}" style="font-size:${fontSize}px;"></i>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size],
      popupAnchor: [0, -size],
    });
  }, []);

  // 初始化 Leaflet 地图
  useEffect(() => {
    if (viewMode !== 'map') return;
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // 已初始化

    const container = mapContainerRef.current;
    setMapReady(false);

    const map = L.map(container, {
      center: MAP_CENTER,
      zoom: 15,
      maxZoom: 18,
      minZoom: 3,
      zoomControl: false,
      attributionControl: false,
      tap: true,
      maxBoundsViscosity: 1.0,
    });

    // 添加地图瓦片
    let tileLoaded = false;

    const onFirstTile = () => {
      if (!tileLoaded) {
        tileLoaded = true;
        setMapReady(true);
      }
    };

    // 高德地图瓦片（中文标注，主图层）
    const layerUrl = tileLayer === 'satellite'
      ? 'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=6&x={x}&y={y}&z={z}'
      : 'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}';
    const gaodeLayer = L.tileLayer(layerUrl, {
      subdomains: '1234',
      maxZoom: 18,
      minZoom: 3,
    }).addTo(map);
    tileLayerRef.current = gaodeLayer;

    gaodeLayer.on('tileload', onFirstTile);
    gaodeLayer.on('tileerror', () => {
      // 瓦片加载失败也标记 ready，避免永久 loading
      if (!tileLoaded) {
        tileLoaded = true;
        setMapReady(true);
      }
    });

    // 兜底：2 秒后还没加载出瓦片也标记 ready
    const fallbackTimer = setTimeout(() => {
      if (!tileLoaded) {
        setMapReady(true);
      }
    }, 2000);

    // 缩放控件放在右下角
    L.control.zoom({
      position: 'bottomright',
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    // 添加比例尺
    L.control.scale({
      position: 'bottomleft',
      metric: true,
      imperial: false,
      maxWidth: 120,
    }).addTo(map);

    // 地图点击标记地点
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setMarkPosition({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) });
      setShowMarkForm(true);
    });

    // 缩放结束后刷新尺寸，防止缩放白屏
    map.on('zoomend', () => {
      setTimeout(() => map.invalidateSize(), 50);
    });

    // 多次调用 invalidateSize 确保容器尺寸正确
    const timers = [100, 300, 600, 1000].map(ms =>
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, ms)
    );

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fallbackTimer);
    };
  }, [viewMode]);

  // 销毁地图实例（仅在切换到列表时）
  useEffect(() => {
    if (viewMode === 'list' && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      setMapReady(false);
    }
  }, [viewMode]);

  // 更新地图标记
  useEffect(() => {
    if (viewMode !== 'map' || !markersLayerRef.current || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;

    // 关键：先刷新地图尺寸，避免搜索/筛选后容器大小变化导致白屏
    map.invalidateSize();

    layer.clearLayers();

    filteredPlaces.forEach(place => {
      const marker = L.marker([place.lat, place.lng], {
        icon: createMarkerIcon(place.category, false),
      });

      // 弹窗内容
      const popupHtml = `
        <div class="map-popup" data-place-id="${place.id}">
          <h4>${place.name}</h4>
          <div class="popup-meta">
            <span class="tag" style="background:${PLACE_CATEGORY_COLOR[place.category]};color:#FFF;padding:2px 8px;border-radius:10px;font-size:11px;">
              <i class="fa-solid ${PLACE_CATEGORY_ICON[place.category]}"></i> ${PLACE_CATEGORY_LABEL[place.category]}
            </span>
            <span style="color:var(--nav-inactive);font-size:12px;"><i class="fa-solid fa-star" style="color:#FFB300;"></i> ${place.rating}</span>
            <span style="color:var(--nav-inactive);font-size:12px;"><i class="fa-solid fa-location-dot"></i> ${formatDistance(place._actualDistance || place.distance)}</span>
          </div>
          <p class="popup-desc">${place.desc}</p>
          <div class="popup-tags">${place.tags.map(t => `<span class="tag tag-blue">${t}</span>`).join('')}</div>
          <div class="popup-actions">
            <button class="btn btn-sm btn-primary popup-action-btn" data-action="play" data-place-id="${place.id}">📨 一键约玩</button>
            <button class="btn btn-sm btn-secondary popup-action-btn" data-action="navigate" data-place-lat="${place.lat}" data-place-lng="${place.lng}" data-place-name="${place.name.replace(/"/g, '&quot;')}">🧭 导航</button>
            <button class="btn btn-sm btn-secondary popup-action-btn" data-action="detail" data-place-id="${place.id}">ℹ️ 详情</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 270,
        className: 'map-popup-wrapper',
      });

      // 点击标记时添加选中动画
      marker.on('click', () => {
        // 先清除所有标记的选中状态
        layer.eachLayer(m => {
          const icon = m.getIcon();
          if (icon && icon.options.className) {
            m.setIcon(createMarkerIcon(m._placeCategory || 'park', false));
          }
        });
        // 设置当前标记为选中
        marker.setIcon(createMarkerIcon(place.category, true));
        // 存储分类信息以便重置
        marker._placeCategory = place.category;
      });

      marker._placeCategory = place.category;

      // 使用全局事件代理处理弹窗按钮点击
      marker.on('popupopen', (e) => {
        const popupEl = e.popup.getElement();
        if (!popupEl) return;

        const handlePopupClick = (ev) => {
          const btn = ev.target.closest('.popup-action-btn');
          if (!btn) return;

          ev.preventDefault();
          ev.stopPropagation();

          const action = btn.dataset.action;
          if (action === 'play') {
            setPlayPlace(place);
            setShowPlayDate(true);
            map.closePopup();
          } else if (action === 'navigate') {
            map.closePopup();
            handleNavigate(parseFloat(btn.dataset.placeLat), parseFloat(btn.dataset.placeLng), btn.dataset.placeName);
          } else if (action === 'detail') {
            map.closePopup();
            window.dispatchEvent(new CustomEvent('openPlaceDetail', { detail: place }));
          }
        };

        popupEl.addEventListener('click', handlePopupClick);
        // 清理
        marker._popupClickHandler = handlePopupClick;
      });

      marker.on('popupclose', () => {
        // 弹窗关闭时恢复标记大小
        marker.setIcon(createMarkerIcon(place.category, false));
        if (marker._popupClickHandler) {
          // handler 随 popup 销毁自动失效
          marker._popupClickHandler = null;
        }
      });

      layer.addLayer(marker);
    });

    // 适配地图视野（延迟执行确保 invalidateSize 已生效）
    if (filteredPlaces.length > 0) {
      const bounds = filteredPlaces.map(p => [p.lat, p.lng]);
      setTimeout(() => {
        if (!mapInstanceRef.current) return;
        if (filteredPlaces.length === 1) {
          mapInstanceRef.current.setView(bounds[0], 16);
        } else {
          mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
      }, 100);
    }
  }, [filteredPlaces, viewMode, createMarkerIcon]);

  // 搜索关键词变化时刷新地图尺寸（搜索框输入可能改变布局）
  useEffect(() => {
    if (viewMode === 'map' && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 150);
    }
  }, [searchKeyword, showFilters]);

  // 当地图容器 ref 就绪时，如果地图实例已存在则刷新尺寸
  useEffect(() => {
    if (viewMode === 'map' && mapContainerRef.current && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 200);
    }
  }, [mapContainerRef.current, viewMode]);

  return (
    <div className="page-container page-enter map-page-layout" style={{ padding: 0 }}>
      {/* 头部 */}
      <div style={{ padding: '12px 16px 8px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          <i className="fa-solid fa-map-location-dot text-accent"></i> 探索周边
          {filteredPlaces.length < places.length && (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--nav-inactive)', marginLeft: 8 }}>
              找到 {filteredPlaces.length} 个地点
            </span>
          )}
        </h2>

        {/* 搜索栏 */}
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder="搜索地点名称、标签、描述..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <button className="search-clear-btn" onClick={() => setSearchKeyword('')}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
          <button
            className={`btn btn-sm ${showFilters || activeCategory !== 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 18, flexShrink: 0 }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <i className="fa-solid fa-sliders"></i>
          </button>
        </div>

        {/* 分类筛选 & 排序（可折叠） */}
        {(showFilters || activeCategory !== 'all') && (
          <div className="filter-panel">
            <div className="filter-section">
              <span className="filter-label">分类：</span>
              <div className="filter-chips">
                {[
                  { key: 'all', label: '全部', icon: 'fa-globe', color: '#666' },
                  { key: 'sport', label: '运动场地', icon: 'fa-basketball', color: PLACE_CATEGORY_COLOR.sport },
                  { key: 'park', label: '公园绿地', icon: 'fa-tree', color: PLACE_CATEGORY_COLOR.park },
                  { key: 'indoor', label: '室内场所', icon: 'fa-building', color: PLACE_CATEGORY_COLOR.indoor },
                  { key: 'secret', label: '秘密基地', icon: 'fa-star', color: PLACE_CATEGORY_COLOR.secret },
                ].map(cat => (
                  <button
                    key={cat.key}
                    className={`filter-chip ${activeCategory === cat.key ? 'filter-chip-active' : ''}`}
                    style={activeCategory === cat.key ? { background: cat.color, color: '#FFF', borderColor: cat.color } : {}}
                    onClick={() => setActiveCategory(activeCategory === cat.key ? 'all' : cat.key)}
                  >
                    <i className={`fa-solid ${cat.icon}`}></i> {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <span className="filter-label">排序：</span>
              <div className="filter-chips">
                {[
                  { key: 'distance', label: '距离最近', icon: 'fa-location-dot' },
                  { key: 'rating', label: '评分最高', icon: 'fa-star' },
                  { key: 'name', label: '名称排序', icon: 'fa-arrow-down-a-z' },
                ].map(s => (
                  <button
                    key={s.key}
                    className={`filter-chip ${sortBy === s.key ? 'filter-chip-active' : ''}`}
                    onClick={() => setSortBy(s.key)}
                  >
                    <i className={`fa-solid ${s.icon}`}></i> {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 视图切换 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--nav-inactive)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {activeCategory !== 'all' ? PLACE_CATEGORY_LABEL[activeCategory] : '全部地点'} · {filteredPlaces.length} 个
            {userLocation && (
              <span style={{
                background: 'var(--success-color)',
                color: '#FFF',
                fontSize: 10,
                padding: '1px 8px',
                borderRadius: 10,
                fontWeight: 600,
              }}>
                <i className="fa-solid fa-location-dot"></i>
                {' '}已定位
              </span>
            )}
          </span>
          <div style={{ display: 'flex', background: 'var(--secondary-bg)', borderRadius: 20, padding: 3 }}>
            <button
              className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 18 }}
              onClick={() => setViewMode('map')}
            >
              <i className="fa-solid fa-map"></i> 地图
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 18 }}
              onClick={() => setViewMode('list')}
            >
              <i className="fa-solid fa-list"></i> 列表
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'map' ? (
        /* Leaflet 真实地图 - 始终渲染保持地图实例存活 */
        <div className="map-wrapper">
          <div ref={mapContainerRef} className="map-container" style={{ position: 'relative' }}></div>

          {/* 地图浮动控件 - 右上角 */}
          <div className="map-floating-controls">
            {/* 定位按钮 */}
            <button
              className={`map-ctrl-btn ${locating ? 'map-ctrl-active' : ''}`}
              onClick={handleLocate}
              title="定位到当前位置"
              disabled={locating}
            >
              <i className={`fa-solid ${locating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
            </button>

            {/* 图层切换按钮 */}
            <button
              className={`map-ctrl-btn ${tileLayer === 'satellite' ? 'map-ctrl-active' : ''}`}
              onClick={() => switchTileLayer(tileLayer === 'normal' ? 'satellite' : 'normal')}
              title={tileLayer === 'normal' ? '切换到卫星地图' : '切换到标准地图'}
            >
              <i className={`fa-solid ${tileLayer === 'normal' ? 'fa-satellite' : 'fa-map'}`}></i>
            </button>

            {/* 搜索半径选择 */}
            <button
              className={`map-ctrl-btn ${showRadiusPicker ? 'map-ctrl-active' : ''}`}
              onClick={() => setShowRadiusPicker(!showRadiusPicker)}
              title="搜索周边范围"
            >
              <i className="fa-solid fa-radar"></i>
            </button>
          </div>

          {/* 定位错误提示 */}
          {locationError && (
            <div className="map-toast" onClick={() => setLocationError('')}>
              <i className="fa-solid fa-triangle-exclamation"></i> {locationError}
            </div>
          )}

          {/* 搜索半径选择面板 */}
          {showRadiusPicker && (
            <div className="map-radius-panel">
              <div className="map-radius-title">
                <i className="fa-solid fa-radar"></i> 周边搜索范围
                <button className="map-radius-close" onClick={() => setShowRadiusPicker(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="map-radius-options">
                {[
                  { val: 500, label: '500米' },
                  { val: 1000, label: '1公里' },
                  { val: 2000, label: '2公里' },
                  { val: 5000, label: '5公里' },
                ].map(r => (
                  <button
                    key={r.val}
                    className={`map-radius-btn ${searchRadius === r.val ? 'map-radius-active' : ''}`}
                    onClick={() => { setSearchRadius(r.val); }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {userLocation && (
                <p style={{ fontSize: 11, color: 'var(--nav-inactive)', margin: '8px 0 0', textAlign: 'center' }}>
                  以您当前位置为中心搜索 {searchRadius >= 1000 ? (searchRadius/1000).toFixed(1) + '公里' : searchRadius + '米'} 范围内的地点
                  <br />
                  <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                    当前范围内共 {filteredPlaces.length} 个地点
                  </span>
                </p>
              )}
              {!userLocation && (
                <p style={{ fontSize: 11, color: '#FF9800', margin: '8px 0 0', textAlign: 'center' }}>
                  <i className="fa-solid fa-info-circle"></i> 请先定位到当前位置，才能使用导航功能
                </p>
              )}
            </div>
          )}

          {filteredPlaces.length === 0 && (
            /* 无结果时显示提示浮层 */
            <div style={{
              position: 'absolute', top: 10, left: 10, right: 10, zIndex: 999,
              background: 'var(--card-bg)', borderRadius: 14, padding: '20px 16px',
              textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 40, color: 'var(--border-color)', marginBottom: 12, display: 'block' }}></i>
              <p style={{ color: 'var(--text-color)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>没有找到匹配的地点</p>
              <p style={{ color: 'var(--nav-inactive)', fontSize: 12, marginBottom: 12 }}>
                试试换个关键词或清除筛选条件
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearchKeyword(''); setActiveCategory('all'); }}
              >
                <i className="fa-solid fa-rotate-left"></i> 重置搜索
              </button>
            </div>
          )}
          {!mapReady && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: '#F0F0F0', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 10,
              borderRadius: 12,
            }}>
              <div className="spinner" style={{
                width: 36, height: 36, border: '3px solid #E0E0E0',
                borderTopColor: 'var(--accent-color)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}></div>
              <span style={{ marginTop: 10, fontSize: 13, color: 'var(--nav-inactive)' }}>地图加载中...</span>
            </div>
          )}

          {/* 地图图例 */}
          <div className={`map-legend ${showLegend ? 'legend-visible' : ''}`}>
            <button className="legend-toggle" onClick={() => setShowLegend(!showLegend)} title="图例">
              <i className="fa-solid fa-list-ul"></i>
            </button>
            <div className="legend-panel">
              <div className="legend-title">地点图例</div>
              {Object.entries(PLACE_CATEGORY_LABEL).map(([key, label]) => (
                <div key={key} className="legend-item">
                  <span className="legend-dot" style={{ background: PLACE_CATEGORY_COLOR[key] }}>
                    <i className={`fa-solid ${PLACE_CATEGORY_ICON[key]}`}></i>
                  </span>
                  <span className="legend-label">{label}</span>
                </div>
              ))}
            </div>
          </div>


        </div>
      ) : (
        /* 列表视图 */
        <div style={{ padding: '0 16px' }}>
          {filteredPlaces.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 48, color: 'var(--border-color)', marginBottom: 16, display: 'block' }}></i>
              <p style={{ color: 'var(--text-color)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>没有找到匹配的地点</p>
              <p style={{ color: 'var(--nav-inactive)', fontSize: 12, marginBottom: 12 }}>
                试试换个关键词或清除筛选条件
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearchKeyword(''); setActiveCategory('all'); }}
              >
                <i className="fa-solid fa-rotate-left"></i> 重置搜索
              </button>
            </div>
          ) : (
            filteredPlaces.map(place => (
              <div key={place.id} className="card" onClick={() => window.dispatchEvent(new CustomEvent('openPlaceDetail', { detail: place }))}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="img-placeholder" style={{
                    width: 60, height: 60, flexShrink: 0,
                    background: PLACE_CATEGORY_GRAD[place.category],
                    borderRadius: 12,
                  }}>
                    <i className={`fa-solid ${PLACE_CATEGORY_ICON[place.category]}`} style={{ fontSize: 22 }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="flex-between">
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>{place.name}</h3>
                      <span style={{ fontSize: 12, color: 'var(--nav-inactive)' }}>
                        <i className="fa-solid fa-location-dot"></i> {formatDistance(place._actualDistance || place.distance)}
                      </span>
                    </div>
                    <StarRating rating={place.rating} size={12} />
                    <div className="flex-center gap-4 mt-8">
                      {place.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 地点详情弹窗 */}
      {selectedPlace && (
        <div className="modal-overlay" onClick={() => setSelectedPlace(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="modal-header">
              <h3>{selectedPlace.name}</h3>
              <button className="modal-close" onClick={() => setSelectedPlace(null)}>✕</button>
            </div>
            <div className="img-placeholder" style={{
              height: 160, marginBottom: 16,
              background: PLACE_CATEGORY_GRAD[selectedPlace.category],
            }}>
              <div style={{ textAlign: 'center' }}>
                <i className={`fa-solid ${PLACE_CATEGORY_ICON[selectedPlace.category]}`} style={{ fontSize: 48, display: 'block', marginBottom: 8 }}></i>
                <span>{PLACE_CATEGORY_LABEL[selectedPlace.category]}</span>
              </div>
            </div>
            <div className="flex-between mb-12">
              <div className="flex-center gap-8">
                <StarRating rating={selectedPlace.rating} size={16} />
                <span className="font-bold">{selectedPlace.rating}</span>
              </div>
              <span className="text-sm text-muted">
                <i className="fa-solid fa-location-dot"></i> {formatDistance(selectedPlace._actualDistance || selectedPlace.distance)}
              </span>
            </div>
            <div className="flex-center gap-4 mb-12">
              {selectedPlace.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nav-inactive)', marginBottom: 16 }}>
              {selectedPlace.desc}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => {
                  const place = selectedPlace;
                  setSelectedPlace(null);
                  window.dispatchEvent(new CustomEvent('openPlaceDetail', { detail: place }));
                }}
              >
                <i className="fa-solid fa-circle-info"></i> 查看详情
              </button>
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  setPlayPlace(selectedPlace);
                  setShowPlayDate(true);
                  setSelectedPlace(null);
                }}
              >
                <i className="fa-solid fa-paper-plane"></i> 一键约玩
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 约玩弹窗 */}
      {showPlayDate && playPlace && (
        <PlayDateModal place={playPlace} onClose={() => { setShowPlayDate(false); setPlayPlace(null); }} />
      )}

      {/* 添加新地点弹窗 */}
      {showAddForm && (
        <AddPlaceModal onClose={() => setShowAddForm(false)} onAdd={addPlace} userLocation={userLocation} />
      )}

      {/* 地图点击标记弹窗 */}
      {showMarkForm && markPosition && (
        <AddPlaceModal
          onClose={() => { setShowMarkForm(false); setMarkPosition(null); }}
          onAdd={(place) => {
            addPlace(place);
            setShowMarkForm(false);
            setMarkPosition(null);
          }}
          userLocation={userLocation}
          prefillPosition={markPosition}
        />
      )}


    </div>
  );
}

// 添加新地点弹窗
function AddPlaceModal({ onClose, onAdd, userLocation, prefillPosition }) {
  const [form, setForm] = useState({ name: '', category: 'park', desc: '', tags: '' });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    // 坐标优先级：地图点击 > 用户定位 > fallback
    let lat, lng;
    if (prefillPosition) {
      lat = prefillPosition.lat;
      lng = prefillPosition.lng;
    } else if (userLocation) {
      // 在用户位置附近随机偏移
      const angle = Math.random() * Math.PI * 2;
      const offsetKm = (Math.random() * 2 + 0.2) / 111.32; // 0.2 ~ 2.2km
      lat = +(userLocation.lat + offsetKm * Math.cos(angle)).toFixed(5);
      lng = +(userLocation.lng + offsetKm * Math.sin(angle)).toFixed(5);
    } else {
      lat = 30.28 + Math.random() * 0.02;
      lng = 120.14 + Math.random() * 0.02;
    }
    const newPlace = {
      id: 'custom_' + uuid(),
      name: form.name,
      category: form.category,
      type: form.category === 'sport' ? 'sport' : form.category,
      rating: 4.0,
      distance: +(Math.random() * 2 + 0.3).toFixed(1),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      desc: form.desc || '新推荐的地点',
      lat,
      lng,
    };
    onAdd(newPlace);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa-solid fa-plus-circle"></i> 添加新地点</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label className="form-label">地点名称 *</label>
          <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="给地点起个名字" />
        </div>
        <div className="form-group">
          <label className="form-label">分类</label>
          <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
            {Object.entries(PLACE_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">描述</label>
          <textarea className="form-textarea" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="简单描述一下这个地方..." />
        </div>
        <div className="form-group">
          <label className="form-label">标签（用逗号分隔）</label>
          <input className="form-input" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="如：安静、好玩、适合小朋友" />
        </div>
        <div className="img-placeholder" style={{ height: 120, marginBottom: 16, background: 'var(--gradient-3)' }}>
          <i className="fa-solid fa-camera"></i> <span style={{ marginLeft: 8 }}>暂为占位</span>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleSubmit}>
          <i className="fa-solid fa-check"></i> 确认添加
        </button>
      </div>
    </div>
  );
}

// 约玩弹窗
function PlayDateModal({ place, onClose, onSuccess }) {
  const { addPlayDate, currentUser } = useApp();
  const [timeOption, setTimeOption] = useState('now');
  const [customTime, setCustomTime] = useState('');
  const [maxPeople, setMaxPeople] = useState(10);
  const [activity, setActivity] = useState('');

  const getTime = () => {
    if (timeOption === 'now') return '现在';
    if (timeOption === '30min') return '30分钟后';
    return customTime || '自定义时间';
  };

  const handleSubmit = () => {
    const newPlay = {
      id: 'play_' + uuid(),
      placeId: place.id,
      placeName: place.name,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      time: getTime(),
      maxPeople: maxPeople,
      currentPeople: 1,
      activity: activity || `一起去${place.name}玩！`,
      status: 'recruiting',
      participants: [currentUser.id],
    };
    addPlayDate(newPlay);
    onClose();
    if (onSuccess) onSuccess('约玩发布成功！快去看看谁要来～', 'fa-circle-check');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa-solid fa-paper-plane"></i> 发起约玩</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label className="form-label">约玩地点</label>
          <input className="form-input" value={place.name} readOnly style={{ fontWeight: 600, color: 'var(--accent-color)' }} />
        </div>
        <div className="form-group">
          <label className="form-label">时间选择</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[
              { key: 'now', label: '现在' },
              { key: '30min', label: '30分钟后' },
              { key: 'custom', label: '自定义' },
            ].map(opt => (
              <button
                key={opt.key}
                className={`btn btn-sm ${timeOption === opt.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTimeOption(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {timeOption === 'custom' && (
            <input className="form-input" type="datetime-local" value={customTime} onChange={e => setCustomTime(e.target.value)} />
          )}
        </div>
        <div className="form-group">
          <label className="form-label">人数上限（2-20人）</label>
          <input className="form-input" type="range" min="2" max="20" value={maxPeople} onChange={e => setMaxPeople(+e.target.value)} />
          <span className="text-sm text-muted">{maxPeople}人</span>
        </div>
        <div className="form-group">
          <label className="form-label">玩什么</label>
          <textarea className="form-textarea" value={activity} onChange={e => setActivity(e.target.value)} placeholder={`比如：一起去${place.name}打篮球/散步/喝咖啡...`} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={handleSubmit}>
          <i className="fa-solid fa-paper-plane"></i> 发起约玩
        </button>
      </div>
    </div>
  );
}

// 社区广场（瀑布流）
function CommunityPage() {
  const { posts, updatePost, addPost, deletePost, toggleFavorite, isFavorite, currentUser, postComments, addPostComment, deletePostComment } = useApp();
  const [sortBy, setSortBy] = useState('latest'); // 'latest' | 'hot'
  const [showPublish, setShowPublish] = useState(false);
  const [likedPosts, setLikedPosts] = useState(() => {
    const saved = localStorage.getItem('nlqw_liked_posts');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);

  const sortedPosts = useMemo(() => {
    const sorted = [...posts];
    if (sortBy === 'hot') sorted.sort((a, b) => b.likes - a.likes);
    return sorted;
  }, [posts, sortBy]);

  const handleLike = (postId) => {
    const isLiked = likedPosts.includes(postId);
    const post = posts.find(p => p.id === postId);
    if (isLiked) {
      setLikedPosts(prev => prev.filter(id => id !== postId));
      const newLikes = (post?.likes || 1) - 1;
      updatePost(postId, { likes: newLikes });
      unlikePostToSupabase(postId, currentUser.id).catch(e => console.warn('[Supabase] unlike 异常:', e));
      updatePostToSupabase(postId, { likes: newLikes }).catch(e => console.warn('[Supabase] updatePost 异常:', e));
    } else {
      setLikedPosts(prev => [...prev, postId]);
      const newLikes = (post?.likes || 0) + 1;
      updatePost(postId, { likes: newLikes });
      likePostToSupabase(postId, currentUser.id).catch(e => console.warn('[Supabase] like 异常:', e));
      updatePostToSupabase(postId, { likes: newLikes }).catch(e => console.warn('[Supabase] updatePost 异常:', e));
    }
  };

  const handleAddPostComment = (postId, text) => {
    if (!text.trim()) return;
    addPostComment(postId, text, currentUser);
  };

  const handleDeletePost = (postId) => {
    if (!confirm('确定要删除这条帖子吗？相关评论和点赞也会被删除。')) return;
    deletePost(postId);
  };

  const handleDeleteComment = (postId, commentId) => {
    if (!confirm('确定要删除这条评论吗？')) return;
    deletePostComment(postId, commentId);
  };

  useEffect(() => {
    localStorage.setItem('nlqw_liked_posts', JSON.stringify(likedPosts));
  }, [likedPosts]);

  // 瀑布流分列
  const leftPosts = sortedPosts.filter((_, i) => i % 2 === 0);
  const rightPosts = sortedPosts.filter((_, i) => i % 2 === 1);

  return (
    <div className="page-container page-enter">
      {/* 顶部 */}
      <div className="flex-between mb-16">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          <i className="fa-solid fa-users text-accent"></i> 社区广场
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--secondary-bg)', borderRadius: 20, padding: 3 }}>
            <button
              className={`btn btn-sm ${sortBy === 'latest' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 18 }}
              onClick={() => setSortBy('latest')}
            >最新</button>
            <button
              className={`btn btn-sm ${sortBy === 'hot' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 18 }}
              onClick={() => setSortBy('hot')}
            >最热</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowPublish(true)}>
            <i className="fa-solid fa-pen"></i> 发布
          </button>
        </div>
      </div>

      {/* 瀑布流双列 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          {leftPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              isLiked={likedPosts.includes(post.id)}
              isFav={isFavorite(post.id, 'post')}
              onFav={() => toggleFavorite(post.id, 'post')}
              comments={postComments[post.id] || []}
              isCommentOpen={activeCommentPostId === post.id}
              onToggleComment={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
              onAddComment={(text) => handleAddPostComment(post.id, text)}
              currentUser={currentUser}
              onDelete={handleDeletePost}
              onDeleteComment={handleDeleteComment}
            />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {rightPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              isLiked={likedPosts.includes(post.id)}
              isFav={isFavorite(post.id, 'post')}
              onFav={() => toggleFavorite(post.id, 'post')}
              comments={postComments[post.id] || []}
              isCommentOpen={activeCommentPostId === post.id}
              onToggleComment={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
              onAddComment={(text) => handleAddPostComment(post.id, text)}
              currentUser={currentUser}
              onDelete={handleDeletePost}
              onDeleteComment={handleDeleteComment}
            />
          ))}
        </div>
      </div>

      {/* 发布动态弹窗 */}
      {showPublish && (
        <PublishPostModal onClose={() => setShowPublish(false)} onPublish={addPost} currentUser={currentUser} />
      )}
    </div>
  );
}

function PostCard({ post, onLike, isLiked, isFav, onFav, comments, isCommentOpen, onToggleComment, onAddComment, currentUser, onDelete, onDeleteComment }) {
  const [heartAnim, setHeartAnim] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleLike = () => {
    setHeartAnim(true);
    onLike(post.id);
    setTimeout(() => setHeartAnim(false), 600);
  };

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10, borderRadius: 12 }}>
      <div className="img-placeholder" style={{
        height: 120,
        background: GRAD_MAP[post.imageGrad] || 'var(--gradient-1)',
        borderRadius: '12px 12px 0 0',
        position: 'relative',
      }}>
        <i className="fa-solid fa-image" style={{ fontSize: 28, opacity: 0.6 }}></i>
        {currentUser && post.userId === currentUser.id && (
          <button onClick={() => onDelete && onDelete(post.id)} style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.4)', color: '#fff',
            border: 'none', borderRadius: 6,
            width: 28, height: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }} title="删除帖子">
            <i className="fa-solid fa-trash-can"></i>
          </button>
        )}
      </div>
      <div style={{ padding: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {post.title}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--nav-inactive)', lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {post.content}
        </p>
        <div className="flex-center gap-4 mb-8">
          {post.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
        </div>
        <div className="flex-between">
          <div className="flex-center gap-4">
            <div className="avatar avatar-sm">{post.userName[0]}</div>
            <span className="text-xs text-muted">{post.userName}</span>
          </div>
          <span className="text-xs text-muted">{post.time}</span>
        </div>
        <div className="divider"></div>
        <div className="flex-between" style={{ padding: '0 4px' }}>
          <button
            onClick={handleLike}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: isLiked ? 'var(--heart-color)' : 'var(--nav-inactive)', fontSize: 13, transition: 'all 0.2s', outline: 'none' }}
          >
            <i className={`fa-solid fa-heart`} style={{ animation: heartAnim ? 'heartBeat 0.6s ease' : 'none' }}></i>
            <span>{post.likes}</span>
          </button>
          <button
            onClick={onToggleComment}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCommentOpen ? 'var(--accent-color)' : 'var(--nav-inactive)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, outline: 'none' }}
          >
            <i className="fa-solid fa-comment"></i>
            <span>{comments.length}</span>
          </button>
          <button
            onClick={onFav}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? 'var(--star-color)' : 'var(--nav-inactive)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, outline: 'none' }}
          >
            <i className={`fa-${isFav ? 'solid' : 'regular'} fa-bookmark`}></i>
          </button>
        </div>

        {/* 评论面板 */}
        {isCommentOpen && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
            {/* 评论列表 */}
            {comments.length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--secondary-bg)', borderRadius: 8 }}>
                    <div className="flex-between" style={{ marginBottom: 2 }}>
                      <span className="text-xs" style={{ fontWeight: 600 }}>{c.userName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="text-xs" style={{ color: 'var(--nav-inactive)' }}>{c.time}</span>
                        {currentUser && c.userId === currentUser.id && (
                          <button
                            onClick={() => onDeleteComment && onDeleteComment(post.id, c.id)}
                            style={{ background: 'none', border: 'none', color: '#FF4D4F', cursor: 'pointer', fontSize: 11, padding: 0 }}
                            title="删除评论"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ margin: 0, lineHeight: 1.5 }}>{c.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted text-center" style={{ marginBottom: 10 }}>暂无评论，来抢沙发吧~</p>
            )}

            {/* 评论输入 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="写下你的评论..."
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
              >
                发送
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PublishPostModal({ onClose, onPublish, currentUser }) {
  const [form, setForm] = useState({ title: '', content: '', tags: '' });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const newPost = {
      id: 'post_' + uuid(),
      userId: currentUser.id,
      userName: currentUser.name,
      title: form.title,
      content: form.content || '分享我的社区生活...',
      imageGrad: ['grad-1','grad-2','grad-3','grad-4','grad-5'][rand(0,4)],
      likes: 0,
      comments: 0,
      collected: false,
      time: '刚刚',
      tags: form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
    };
    onPublish(newPost);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa-solid fa-pen-to-square"></i> 发布动态</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label className="form-label">标题 *</label>
          <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="给你的动态起个标题" />
        </div>
        <div className="form-group">
          <label className="form-label">正文</label>
          <textarea className="form-textarea" value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="分享你的社区生活..." />
        </div>
        <div className="form-group">
          <label className="form-label">标签（用逗号分隔）</label>
          <input className="form-input" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="如：遛娃、篮球、美食" />
        </div>
        <div className="img-placeholder" style={{ height: 120, marginBottom: 16, background: 'var(--gradient-4)' }}>
          <i className="fa-solid fa-cloud-arrow-up"></i> <span style={{ marginLeft: 8 }}>暂为占位</span>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleSubmit}>
          <i className="fa-solid fa-paper-plane"></i> 发布动态
        </button>
      </div>
    </div>
  );
}



// 评价区
function ReviewSection({ placeId, reviews, addReview, updateReview, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState('');
  const [newTags, setNewTags] = useState([]);

  const placeReviews = useMemo(() => reviews.filter(r => r.placeId === placeId), [reviews, placeId]);

  // 评分统计
  const ratingDist = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    placeReviews.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });
    return dist;
  }, [placeReviews]);

  const ratingStats = useMemo(() => {
    const total = placeReviews.length;
    if (total === 0) return { avg: 0, total: 0, starPercent: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const sum = placeReviews.reduce((s, r) => s + r.rating, 0);
    const avg = Math.round(sum / total * 10) / 10;
    const starPercent = {};
    [5, 4, 3, 2, 1].forEach(s => { starPercent[s] = Math.round(ratingDist[s] / total * 100); });
    return { avg, total, starPercent };
  }, [placeReviews, ratingDist]);

  // 热门标签统计
  const tagStats = useMemo(() => {
    const tagMap = {};
    placeReviews.forEach(r => {
      (r.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
    });
    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [placeReviews]);

  // 好评率
  const goodRate = useMemo(() => {
    const total = placeReviews.length;
    if (total === 0) return 0;
    const good = placeReviews.filter(r => r.rating >= 4).length;
    return Math.round(good / total * 100);
  }, [placeReviews]);

  const presetTags = ['干净', '好玩', '适合小朋友', '人多', '安静', '空气好', '设施好', '拍照圣地', '有WiFi', '适合跑步', '看日落', '秘密基地'];

  const toggleTag = (tag) => {
    setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = () => {
    if (!newText.trim()) return;
    const review = {
      id: 'r_' + uuid(),
      placeId,
      userId: currentUser.id,
      userName: currentUser.name,
      rating: newRating,
      text: newText,
      time: '刚刚',
      tags: newTags,
      likes: 0,
      liked: false,
    };
    addReview(review);
    setShowForm(false);
    setNewText('');
    setNewTags([]);
    setNewRating(5);
  };

  const handleLikeReview = (reviewId) => {
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;
    updateReview(reviewId, { likes: review.liked ? review.likes - 1 : review.likes + 1, liked: !review.liked });
  };

  return (
    <div>
      <div className="flex-between mb-12">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>用户评价 ({placeReviews.length})</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="fa-solid fa-pen"></i> 写评价
        </button>
      </div>

      {/* 评分分布 */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>评分分布</h4>

        {/* 总览：平均分 + 评价数 + 好评率 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0 16px', borderBottom: '1px solid var(--divider-color)' }}>
          {/* 大号平均分 */}
          <div style={{ textAlign: 'center', minWidth: 72 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-color)', lineHeight: 1 }}>
              {ratingStats.total > 0 ? ratingStats.avg : '-'}
            </div>
            <StarRating rating={ratingStats.total > 0 ? Math.round(ratingStats.avg) : 0} size={12} />
            <div className="text-xs text-muted mt-4">{ratingStats.total} 条评价</div>
          </div>

          {/* 分布条 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = ratingDist[star];
              const pct = ratingStats.starPercent[star] || 0;
              return (
                <div key={star} className="flex-center gap-8" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ width: 26, color: 'var(--nav-inactive)', textAlign: 'right', flexShrink: 0 }}>
                    {star}<i className="fa-solid fa-star" style={{ color: 'var(--star-color)', fontSize: 9, marginLeft: 1 }}></i>
                  </span>
                  <div style={{ flex: 1, height: 10, background: 'var(--secondary-bg)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      width: pct + '%', height: '100%',
                      background: star >= 4 ? 'var(--star-color)' : star === 3 ? '#FFB74D' : 'var(--border-color)',
                      borderRadius: 5, minWidth: count > 0 ? 8 : 0,
                      transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}></div>
                  </div>
                  <span style={{ width: 32, textAlign: 'right', color: count > 0 ? 'var(--text-color)' : 'var(--nav-inactive)', fontWeight: count > 0 ? 600 : 400, fontSize: 11, flexShrink: 0 }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 好评率 + 热门标签 */}
        <div style={{ paddingTop: 12 }}>
          <div className="flex-between mb-12">
            <div className="flex-center gap-8">
              <span style={{ fontSize: 12, color: 'var(--nav-inactive)' }}>好评率</span>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: goodRate >= 80 ? 'var(--success-color)' : goodRate >= 60 ? 'var(--warning-color)' : 'var(--danger-color)',
              }}>
                {goodRate}%
              </span>
            </div>
            <div style={{ flex: 1, height: 6, background: 'var(--secondary-bg)', borderRadius: 3, overflow: 'hidden', margin: '0 12px' }}>
              <div style={{
                width: goodRate + '%', height: '100%',
                background: goodRate >= 80 ? 'var(--success-color)' : goodRate >= 60 ? 'var(--warning-color)' : 'var(--danger-color)',
                borderRadius: 3, transition: 'width 0.8s ease',
              }}></div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--nav-inactive)' }}>
              {goodRate >= 90 ? '超赞' : goodRate >= 80 ? '很不错' : goodRate >= 60 ? '还可以' : goodRate > 0 ? '一般' : '暂无'}
            </span>
          </div>

          {/* 热门评价标签 */}
          {tagStats.length > 0 && (
            <div>
              <div className="text-xs text-muted mb-8">大家怎么说</div>
              <div className="flex-center gap-4" style={{ flexWrap: 'wrap' }}>
                {tagStats.map(([tag, count]) => (
                  <span key={tag} className="tag" style={{
                    fontSize: 11, padding: '4px 10px',
                    background: count >= 3 ? 'rgba(74,144,217,0.1)' : 'var(--tag-bg)',
                    color: count >= 3 ? 'var(--accent-color)' : 'var(--tag-text)',
                    fontWeight: count >= 3 ? 600 : 400,
                    border: count >= 3 ? '1px solid rgba(74,144,217,0.3)' : 'none',
                  }}>
                    {tag}
                    <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 评价表单 */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.3s ease' }}>
          <div className="mb-12">
            <label className="form-label">评分</label>
            <StarRating rating={newRating} interactive={true} onChange={setNewRating} size={24} />
          </div>
          <div className="form-group">
            <label className="form-label">评价</label>
            <textarea className="form-textarea" value={newText} onChange={e => setNewText(e.target.value)} placeholder="分享你的体验..." />
          </div>
          <div className="mb-12">
            <label className="form-label">标签</label>
            <div className="flex-center gap-4" style={{ flexWrap: 'wrap' }}>
              {presetTags.map(tag => (
                <span
                  key={tag}
                  className="tag"
                  onClick={() => toggleTag(tag)}
                  style={{
                    cursor: 'pointer',
                    background: newTags.includes(tag) ? 'var(--accent-color)' : 'var(--tag-bg)',
                    color: newTags.includes(tag) ? '#FFF' : 'var(--tag-text)',
                    transition: 'all 0.2s',
                  }}
                >{tag}</span>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={handleSubmit}>
            提交
          </button>
        </div>
      )}

      {/* 评价列表 */}
      {placeReviews.map(review => (
        <div key={review.id} className="card" style={{ padding: 14 }}>
          <div className="flex-between mb-8">
            <div className="flex-center gap-8">
              <div className="avatar avatar-sm">{review.userName[0]}</div>
              <div>
                <div className="font-bold text-sm">{review.userName}</div>
                <StarRating rating={review.rating} size={11} />
              </div>
            </div>
            <span className="text-xs text-muted">{review.time}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{review.text}</p>
          {review.tags && review.tags.length > 0 && (
            <div className="flex-center gap-4 mb-8">
              {review.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
            </div>
          )}
          <button
            onClick={() => handleLikeReview(review.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: review.liked ? 'var(--accent-color)' : 'var(--nav-inactive)',
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, outline: 'none',
            }}
          >
            <i className="fa-solid fa-thumbs-up"></i> 这条评价有用 ({review.likes})
          </button>
        </div>
      ))}

      {placeReviews.length === 0 && (
        <div className="empty-state">
          <i className="fa-solid fa-comment-slash"></i>
          <p>还没有评价，来写第一条吧！</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 好友列表页面（基于真实定位的附近的人）
// ============================================================
function FriendListPage({ onChatOpen }) {
  const { friends, removeFriend, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, messages, nearbyUsers, refreshNearbyUsers, userLocation, setUserLocation, selectedCity, selectCity, currentUser, friendRequests, sentRequestIds, removedFriendIds } = useApp();
  const [activeTab, setActiveTab] = useState('myFriends'); // myFriends | discover | requests
  const [searchText, setSearchText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [requestSentDialog, setRequestSentDialog] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearchText, setCitySearchText] = useState('');

  // 获取定位
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('浏览器不支持定位');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        refreshNearbyUsers(loc.lat, loc.lng);
        setLocating(false);
      },
      (err) => {
        setLocationError('定位失败：' + (err.message || '请检查定位权限'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [setUserLocation, refreshNearbyUsers]);

  // 进入发现页时自动尝试定位
  useEffect(() => {
    if (activeTab === 'discover' && !userLocation && !locating) {
      handleLocate();
    }
  }, [activeTab, userLocation, locating, handleLocate]);

  // 如果有定位但无附近用户数据，自动刷新
  useEffect(() => {
    if (activeTab === 'discover' && userLocation && nearbyUsers.length === 0) {
      refreshNearbyUsers(userLocation.lat, userLocation.lng);
    }
  }, [activeTab, userLocation, nearbyUsers.length, refreshNearbyUsers]);

  // 未读消息数
  const unreadCount = (friendId) => {
    const msgs = messages[friendId] || [];
    return msgs.filter(m => m.from === friendId).length;
  };

  // 发现附近的人 - 排除自己、好友、已申请的用户
  const discoverUsers = useMemo(() => {
    if (!userLocation) return [];
    const friendIds = new Set(friends.map(f => f.id));
    const requestIds = new Set(friendRequests.map(r => r.fromUserId));
    const filtered = nearbyUsers.filter(u =>
      u.id !== currentUser.id &&
      !friendIds.has(u.id) &&
      !requestIds.has(u.id) &&
      !sentRequestIds.has(u.id) &&
      (searchText === '' || u.name.includes(searchText) || u.intro.includes(searchText))
    );
    return filtered.sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }, [friends, searchText, nearbyUsers, userLocation, currentUser.id, friendRequests, sentRequestIds]);

  // 搜索好友
  const searchFriends = useMemo(() => {
    if (!searchText) return friends;
    return friends.filter(f => f.name.includes(searchText));
  }, [friends, searchText]);

  const handleDeleteFriend = () => {
    if (deleteConfirm) {
      removeFriend(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  // 附近人数
  const nearbyCount = useMemo(() => {
    if (!userLocation) return nearbyUsers.length;
    const friendIds = new Set(friends.map(f => f.id));
    return nearbyUsers.filter(u => !friendIds.has(u.id)).length;
  }, [nearbyUsers, friends, userLocation]);

  return (
    <div className="page-container page-enter">
      {/* 标题栏 */}
      <div className="flex-between mb-12">
        <div className="section-title">
          <i className="fa-solid fa-comments"></i>
          <span>消息</span>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="search-bar-container mb-12">
        <div className="search-input-wrapper">
          <i className="fa-solid fa-magnifying-glass search-icon"></i>
          <input
            className="search-input"
            placeholder="搜索好友或附近的人..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          {searchText && (
            <button className="search-clear-btn" onClick={() => setSearchText('')}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${activeTab === 'myFriends' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, minWidth: 80, borderRadius: 10 }}
          onClick={() => setActiveTab('myFriends')}
        >
          <i className="fa-solid fa-user-group"></i> 好友 ({friends.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, minWidth: 80, borderRadius: 10, position: 'relative' }}
          onClick={() => setActiveTab('requests')}
        >
          <i className="fa-solid fa-bell"></i> 申请
          {friendRequests.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#E53E3E', color: '#fff', fontSize: 10, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{friendRequests.length}</span>
          )}
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'discover' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, minWidth: 80, borderRadius: 10 }}
          onClick={() => setActiveTab('discover')}
        >
          <i className="fa-solid fa-user-plus"></i> 发现 {nearbyCount > 0 && `(${nearbyCount})`}
        </button>
      </div>

      {/* 我的好友列表 */}
      {activeTab === 'myFriends' && (
        <div className="friend-list">
          {searchFriends.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-user-group"></i>
              <p>{searchText ? '没有找到匹配的好友' : '还没有添加好友，去"附近的人"发现新朋友！'}</p>
            </div>
          ) : (
            searchFriends.map(friend => {
              const count = unreadCount(friend.id);
              return (
                <div key={friend.id} className="friend-card card" onClick={() => onChatOpen(friend)}>
                  <div className="friend-avatar" style={{ background: friend.color || 'var(--gradient-1)' }}>
                    {friend.avatar}
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">
                      {friend.name}
                      {count > 0 && <span className="friend-unread">{count}</span>}
                    </div>
                    <div className="friend-preview text-muted text-sm">
                      {messages[friend.id] && messages[friend.id].length > 0
                        ? messages[friend.id][messages[friend.id].length - 1].text
                        : '点击开始聊天'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 好友申请 Tab */}
      {activeTab === 'requests' && (
        <div className="friend-list">
          {friendRequests.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-bell"></i>
              <p>暂无新的好友申请</p>
            </div>
          ) : (
            friendRequests.map(request => (
              <div key={request.fromUserId} className="friend-card card" style={{ borderLeft: '3px solid var(--primary-color)' }}>
                <div className="friend-avatar" style={{ background: request.fromUserColor || 'var(--gradient-1)' }}>
                  {request.fromUserAvatar}
                </div>
                <div className="friend-info">
                  <div className="friend-name">{request.fromUserName}</div>
                  <div className="friend-preview text-muted text-sm" style={{ color: 'var(--primary-color)' }}>
                    <i className="fa-solid fa-user-plus"></i> 请求添加你为好友
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                    onClick={e => { e.stopPropagation(); acceptFriendRequest(request.fromUserId, request); }}>
                    <i className="fa-solid fa-check"></i> 同意
                  </button>
                  <button className="btn btn-sm" style={{ background: 'transparent', color: '#999', borderRadius: 8, border: '1px solid var(--border-color)', padding: '6px 12px', fontSize: 12 }}
                    onClick={e => { e.stopPropagation(); rejectFriendRequest(request.fromUserId); }}>
                    <i className="fa-solid fa-xmark"></i> 拒绝
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 附近的人列表 */}
      {activeTab === 'discover' && (
        <div>
          {/* 定位状态提示 */}
          {userLocation && (
            <div className="discover-location-bar">
              <i className="fa-solid fa-location-dot"></i>
              <span>{selectedCity ? selectedCity.name + ' · 发现 ' + nearbyCount + ' 位邻居' : '已定位 · 发现 ' + nearbyCount + ' 位附近的邻居'}</span>
              <button className="discover-refresh-btn" onClick={() => refreshNearbyUsers(userLocation.lat, userLocation.lng)} title="刷新">
                <i className="fa-solid fa-rotate"></i>
              </button>
            </div>
          )}



          {!userLocation && (
            <div className="discover-locate-card card">
              <div className="discover-locate-icon">
                <i className="fa-solid fa-location-crosshairs"></i>
              </div>
              <p className="discover-locate-title">发现你身边的邻居</p>
              <p className="discover-locate-desc">开启定位，找到附近一起玩的朋友</p>
              <button
                className="btn btn-primary discover-locate-btn"
                onClick={handleLocate}
                disabled={locating}
              >
                {locating ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> 定位中...</>
                ) : (
                  <><i className="fa-solid fa-location-dot"></i> 获取位置</>
                )}
              </button>
              {locationError && (
                <p className="discover-locate-error">
                  <i className="fa-solid fa-triangle-exclamation"></i> {locationError}
                </p>
              )}

            </div>
          )}

          {/* 附近用户列表 */}
          {userLocation && discoverUsers.length > 0 && (
            <div className="friend-list">
              {discoverUsers.map(user => (
                <div key={user.id} className="friend-card card">
                  <div className="friend-avatar" style={{ background: user.color || 'var(--gradient-1)' }}>
                    {user.avatar}
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">
                      {user.name}
                      {user.online && <span className="online-dot"></span>}
                    </div>
                    <div className="friend-preview text-muted text-sm">
                      <span className="nearby-distance">
                        <i className="fa-solid fa-location-dot"></i> {user.distanceText || '附近'}
                      </span>
                      <span className="nearby-sep">·</span>
                      {user.intro}
                    </div>
                  </div>
                  {sentRequestIds.has(user.id) ? (
                    <span className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff', borderRadius: 8, fontSize: 12, padding: '4px 12px', cursor: 'default' }}>
                      <i className="fa-solid fa-paper-plane"></i> 已申请
                    </span>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        sendFriendRequest(user.id, user);
                        setRequestSentDialog({ name: user.name, avatar: user.avatar, color: user.color });
                      }}
                    >
                      <i className="fa-solid fa-user-plus"></i> 添加好友
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {userLocation && discoverUsers.length === 0 && (
            <div className="empty-state">
              <i className="fa-solid fa-face-smile"></i>
              <p>{searchText ? '没有找到匹配的邻居' : '你已经添加了附近所有邻居！'}</p>
              <button className="btn btn-sm btn-secondary mt-8" onClick={() => refreshNearbyUsers(userLocation.lat, userLocation.lng)}>
                <i className="fa-solid fa-rotate"></i> 换一批看看
              </button>
            </div>
          )}
        </div>
      )}

      {/* 删除好友确认弹窗 */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>删除好友</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p className="mb-16">确定要删除好友 <strong>{deleteConfirm.name}</strong> 吗？</p>
            <div className="flex gap-8">
              <button className="btn btn-secondary btn-block" onClick={() => setDeleteConfirm(null)}>取消</button>
              <button className="btn btn-danger btn-block" onClick={handleDeleteFriend}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 申请已发送弹窗 */}
      {requestSentDialog && (
        <div className="modal-overlay" onClick={() => setRequestSentDialog(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: requestSentDialog.color || 'var(--gradient-1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 32,
            }}>
              {requestSentDialog.avatar}
            </div>
            <h3 style={{ marginBottom: 8, fontSize: 18 }}>申请已发送</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
              已向 <strong>{requestSentDialog.name}</strong> 发送好友申请，<br/>等待对方同意后即可成为好友
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', borderRadius: 10, padding: '12px' }}
              onClick={() => setRequestSentDialog(null)}
            >
              <i className="fa-solid fa-check"></i> 好的
            </button>
          </div>
        </div>
      )}

      {/* 底部提示 */}
      <div className="text-center text-muted text-xs" style={{ padding: '24px 0' }}>
        <i className="fa-solid fa-lock"></i> 附近的人基于定位随机生成，模拟真实场景
      </div>
    </div>
  );
}

// ============================================================
// 聊天页面
// ============================================================
function ChatPage({ friend, onBack }) {
  const { sendMessage, getChatMessages } = useApp();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const chatMessages = getChatMessages(friend.id);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(friend.id, inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: 0 }}>
      {/* 聊天头部 */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="chat-avatar" style={{ background: friend.color || 'var(--gradient-1)' }}>
          {friend.avatar}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{friend.name}</div>
          <div className="text-xs text-muted">邻里趣玩好友</div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-avatar" style={{ background: friend.color || 'var(--gradient-1)' }}>
              {friend.avatar}
            </div>
            <p className="chat-empty-name">{friend.name}</p>
            <p className="text-muted text-sm">你们已经是好友了，开始聊天吧！</p>
          </div>
        ) : (
          chatMessages.map((msg, idx) => {
            const isMe = msg.from === 'me';
            const showAvatar = idx === 0 || chatMessages[idx - 1].from !== msg.from;
            return (
              <div key={msg.id} className={`chat-bubble-row ${isMe ? 'chat-bubble-me' : 'chat-bubble-friend'}`}>
                {!isMe && (
                  <div className="chat-bubble-avatar" style={{ background: friend.color || 'var(--gradient-1)', opacity: showAvatar ? 1 : 0 }}>
                    {friend.avatar}
                  </div>
                )}
                <div className="chat-bubble-wrapper">
                  <div className={`chat-bubble ${isMe ? 'chat-bubble-right' : 'chat-bubble-left'}`}>
                    {msg.text}
                  </div>
                  <div className={`chat-bubble-time ${isMe ? 'text-right' : ''}`}>{msg.time}</div>
                </div>
                {isMe && (
                  <div className="chat-bubble-avatar" style={{ background: 'var(--gradient-3)', opacity: showAvatar ? 1 : 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#FFF' }}>我</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* 输入区域 */}
      <div className="chat-input-bar">
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            className="chat-input"
            placeholder="输入消息..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim()}
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

// 个人中心
function ProfilePage() {
  const { theme, setTheme, themes } = useTheme();
  const { playDates, posts, favorites, reviews, currentUser, places, setCurrentPage, updatePlayDate, deletePlayDate, deleteReview, updateReview, postComments, deletePostComment } = useApp();
  const [activeTab, setActiveTab] = useState('playdates'); // playdates | favorites | reviews
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { playId, playName }
  const [reviewDeleteConfirm, setReviewDeleteConfirm] = useState(null); // review id to delete
  const [editingReview, setEditingReview] = useState(null); // { id, text, rating, tags }

  const myPlayDates = useMemo(() => playDates.filter(p => p.creatorId === currentUser.id || p.participants.includes(currentUser.id)), [playDates, currentUser]);
  const myReviews = useMemo(() => reviews.filter(r => r.userId === currentUser.id), [reviews, currentUser]);
  // 收集所有社区帖子中当前用户的评论
  const myPostComments = useMemo(() => {
    const result = [];
    Object.entries(postComments).forEach(([postId, comments]) => {
      comments.forEach(c => {
        if (c.userId === currentUser.id) {
          const post = posts.find(p => p.id === postId);
          result.push({
            ...c,
            postId,
            postTitle: post ? post.title : '已删除的动态',
            type: 'post_comment',
          });
        }
      });
    });
    return result;
  }, [postComments, currentUser, posts]);
  const favPosts = useMemo(() => favorites.filter(f => f.startsWith('post_')).map(f => f.replace('post_', '')), [favorites]);



  const createdCount = playDates.filter(p => p.creatorId === currentUser.id).length;
  const joinedCount = playDates.filter(p => p.participants.includes(currentUser.id) && p.creatorId !== currentUser.id).length;

  // 小红花徽章
  const badges = useMemo(() => {
    const b = [];
    if (createdCount >= 3) b.push({ name: '约玩达人', icon: 'fa-paper-plane', color: '#FF9800' });
    if (joinedCount >= 5) b.push({ name: '热心邻居', icon: 'fa-heart', color: '#E91E63' });
    if (reviews.filter(r => r.userId === currentUser.id).length >= 5) b.push({ name: '探险家', icon: 'fa-compass', color: '#4CAF50' });
    if (favPosts.length >= 3) b.push({ name: '收藏家', icon: 'fa-bookmark', color: '#2196F3' });
    if (b.length === 0) b.push({ name: '新邻居', icon: 'fa-home', color: '#9E9E9E' });
    return b;
  }, [createdCount, joinedCount, reviews, favPosts, currentUser]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'recruiting': return { bg: '#E8F8E0', color: '#52C41A', label: '招募中' };
      case 'active': return { bg: '#E8F4FD', color: '#4A90D9', label: '进行中' };
      case 'ended': return { bg: '#F0F0F0', color: '#999', label: '已结束' };
      default: return { bg: '#E8F8E0', color: '#52C41A', label: '招募中' };
    }
  };

  return (
    <div className="page-container page-enter">
      {/* 页面标题 */}
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--accent-color), var(--star-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        <i className="fa-solid fa-user" style={{ marginRight: 8, WebkitTextFillColor: 'var(--accent-color)' }}></i>我的
      </h2>
      {/* 用户信息 */}
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <div className="avatar avatar-lg" style={{ margin: '0 auto 12px', background: 'linear-gradient(135deg, var(--accent-color), var(--star-color))' }}>
          {currentUser.name[0]}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{currentUser.name}</h3>
        <p className="text-sm text-muted mt-4">邻里趣玩 · 发现身边的美好</p>
      </div>

      {/* 统计数据 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-color)' }}>{createdCount}</div>
            <div className="text-xs text-muted">发起约玩</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success-color)' }}>{joinedCount}</div>
            <div className="text-xs text-muted">参与约玩</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--star-color)' }}>{favorites.length}</div>
            <div className="text-xs text-muted">收藏数</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--heart-color)' }}>{badges.length}</div>
            <div className="text-xs text-muted">小红花</div>
          </div>
        </div>
      </div>

      {/* 功能Tab */}
      <div className="mt-16">
        <div style={{ display: 'flex', background: 'var(--secondary-bg)', borderRadius: 12, padding: 4, marginBottom: 12 }}>
          {[
            { key: 'playdates', label: '我的约玩' },
            { key: 'favorites', label: '我的收藏' },
            { key: 'reviews', label: '我的评价' },
            { key: 'theme', label: '主题设置' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, borderRadius: 10 }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 我的约玩 */}
        {activeTab === 'playdates' && (
          <div>
            {myPlayDates.length === 0 ? (
              <div className="empty-state">
                <i className="fa-solid fa-calendar-xmark"></i>
                <p>还没有约玩记录</p>
              </div>
            ) : (
              myPlayDates.map(play => {
                const statusInfo = getStatusStyle(play.status);
                return (
                  <div key={play.id} className="card">
                    <div className="flex-between mb-8">
                      <h4 style={{ fontSize: 15, fontWeight: 700 }}>{play.placeName}</h4>
                      <div className="flex-center gap-8">
                        <span style={{
                          background: statusInfo.bg, color: statusInfo.color,
                          padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        }}>
                          {statusInfo.label}
                        </span>
                        {play.creatorId === currentUser.id ? (
                          <button
                            className="btn btn-sm"
                            style={{ background: '#FFEBEE', color: '#FF4D4F', padding: '4px 10px', borderRadius: 8, fontSize: 11, border: 'none', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ playId: play.id, playName: play.placeName });
                            }}
                            title="删除约玩"
                          >
                            <i className="fa-solid fa-trash-can"></i> 删除
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm"
                            style={{ background: '#FFF3E0', color: '#FF9800', padding: '4px 10px', borderRadius: 8, fontSize: 11, border: 'none', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('确定要退出这个约玩吗？')) {
                                updatePlayDate(play.id, {
                                  currentPeople: play.currentPeople - 1,
                                  participants: play.participants.filter(pid => pid !== currentUser.id),
                                });
                              }
                            }}
                            title="退出约玩"
                          >
                            <i className="fa-solid fa-right-from-bracket"></i> 退出
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-between mb-8">
                      <span className="text-sm text-muted"><i className="fa-solid fa-clock"></i> {play.time}</span>
                      <span className="text-sm text-muted">
                        <i className="fa-solid fa-user-group"></i> {play.currentPeople}/{play.maxPeople}人
                      </span>
                    </div>
                    <p className="text-sm text-muted mb-8">{play.activity}</p>
                    <div className="flex-center gap-4 mb-8">
                      {play.participants.map(pid => (
                        <div key={pid} className="avatar avatar-sm" title={pid}>{pid[1] || '?'}</div>
                      ))}
                      {play.status === 'recruiting' && play.currentPeople < play.maxPeople && !play.participants.includes(currentUser.id) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            updatePlayDate(play.id, {
                              currentPeople: play.currentPeople + 1,
                              participants: [...play.participants, currentUser.id],
                            });
                          }}
                        >
                          + 加入
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 我的收藏 */}
        {activeTab === 'favorites' && (
          <div>
            {favPosts.length === 0 ? (
              <div className="empty-state">
                <i className="fa-solid fa-bookmark"></i>
                <p>还没有收藏内容</p>
              </div>
            ) : (
              <div>
                {favPosts.length > 0 && (
                  <div className="mb-16">
                    <h4 className="font-bold mb-8">收藏的动态 ({favPosts.length})</h4>
                    {favPosts.map(pid => {
                      const post = posts.find(p => p.id === pid);
                      if (!post) return null;
                      return (
                        <div key={pid} className="card" style={{ padding: 12 }}>
                          <div className="flex-center gap-8">
                            <div className="img-placeholder" style={{ width: 50, height: 50, background: GRAD_MAP[post.imageGrad], borderRadius: 8 }}>
                              <i className="fa-solid fa-image" style={{ fontSize: 16 }}></i>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="font-bold text-sm">{post.title}</div>
                              <div className="text-xs text-muted">{post.userName} · {post.time}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 我的评价 */}
        {activeTab === 'reviews' && (
          <div>
            {/* 评价统计摘要 */}
            {(myReviews.length > 0 || myPostComments.length > 0) && (
              <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* 评价总数 */}
                  <div style={{ textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-color)', lineHeight: 1 }}>
                      {myReviews.length + myPostComments.length}
                    </div>
                    <div className="text-xs text-muted mt-4">全部评论</div>
                  </div>
                  {/* 地点评价数 */}
                  <div style={{ textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-color)', lineHeight: 1 }}>
                      {myReviews.length}
                    </div>
                    <div className="text-xs text-muted mt-4">地点评价</div>
                  </div>
                  {/* 社区评论数 */}
                  <div style={{ textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success-color)', lineHeight: 1 }}>
                      {myPostComments.length}
                    </div>
                    <div className="text-xs text-muted mt-4">社区评论</div>
                  </div>
                  {/* 平均分（仅地点评价） */}
                  {myReviews.length > 0 && (
                    <div style={{ textAlign: 'center', minWidth: 56 }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--star-color)', lineHeight: 1 }}>
                        {(myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted mt-4">平均分</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {myReviews.length === 0 && myPostComments.length === 0 ? (
              <div className="empty-state">
                <i className="fa-solid fa-star" style={{ fontSize: 48, color: '#DDD' }}></i>
                <p style={{ marginTop: 12 }}>还没有写过任何评论</p>
                <p className="text-xs text-muted mt-4">去探索附近的好去处或在社区互动，留下你的足迹吧！</p>
              </div>
            ) : (
              <>
                {/* 社区帖子评论 */}
                {myPostComments.map(comment => (
                  <div key={`pc-${comment.id}`} className="card" style={{ padding: 12, marginBottom: 10 }}>
                    <div className="flex-center gap-6 mb-6">
                      <span className="tag" style={{ background: 'var(--success-color)', color: '#FFF', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>
                        <i className="fa-solid fa-comment"></i> 社区评论
                      </span>
                      <span className="text-xs text-muted">{comment.time}</span>
                    </div>
                    {/* 关联帖子 */}
                    <div
                      className="flex-center gap-6 mb-8"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setCurrentPage('community');
                      }}
                    >
                      <div className="avatar avatar-sm" style={{ background: 'var(--gradient-2)', color: '#FFF', fontSize: 11 }}>
                        <i className="fa-solid fa-newspaper"></i>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color)' }}>
                        {comment.postTitle}
                      </span>
                      <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: 'var(--nav-inactive)', marginLeft: 'auto' }}></i>
                    </div>
                    {/* 评论内容 */}
                    <p className="text-sm mb-6" style={{ lineHeight: 1.6, background: 'var(--secondary-bg)', borderRadius: 8, padding: '8px 12px' }}>
                      {comment.text}
                    </p>
                    {/* 操作按钮 */}
                    <div className="flex-between" style={{ borderTop: '1px solid var(--divider-color)', paddingTop: 8 }}>
                      <span className="text-xs text-muted">
                        <i className="fa-regular fa-user"></i> {comment.userName}
                      </span>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#FFEBEE', color: '#FF4D4F', padding: '4px 10px', borderRadius: 8, fontSize: 11, border: 'none', cursor: 'pointer' }}
                        onClick={() => {
                          deletePostComment(comment.postId, comment.id);
                        }}
                      >
                        <i className="fa-solid fa-trash-can"></i> 删除
                      </button>
                    </div>
                  </div>
                ))}

                {/* 地点评价 */}
                {myReviews.map(review => {
                  const place = places.find(p => p.id === review.placeId);
                  const isEditing = editingReview && editingReview.id === review.id;
                  return (
                    <div key={review.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
                      {/* 类型标签 */}
                      <div className="flex-center gap-6 mb-6">
                        <span className="tag" style={{ background: 'var(--accent-color)', color: '#FFF', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>
                          <i className="fa-solid fa-map-pin"></i> 地点评价
                        </span>
                        <span className="text-xs text-muted">{review.time}</span>
                      </div>

                      {/* 地点名称 */}
                      {place && (
                        <div
                          className="flex-center gap-6 mb-8"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setCurrentPage('explore');
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('openPlaceDetail', { detail: place }));
                            }, 100);
                          }}
                        >
                          <div className="avatar avatar-sm" style={{
                            background: PLACE_CATEGORY_GRAD[place.category],
                            color: '#FFF',
                            fontSize: 12,
                          }}>
                            <i className={`fa-solid ${PLACE_CATEGORY_ICON[place.category]}`}></i>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color)' }}>
                            {place.name}
                          </span>
                          <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: 'var(--nav-inactive)', marginLeft: 'auto' }}></i>
                        </div>
                      )}

                      {/* 评分和时间 */}
                      <div className="flex-between mb-6">
                        {isEditing ? (
                          <div className="flex-center gap-4">
                            {[1, 2, 3, 4, 5].map(s => (
                              <i
                                key={s}
                                className={`fa-solid fa-star`}
                                style={{ fontSize: 16, cursor: 'pointer', color: s <= editingReview.rating ? 'var(--star-color)' : '#DDD' }}
                                onClick={() => setEditingReview({ ...editingReview, rating: s })}
                              ></i>
                            ))}
                          </div>
                        ) : (
                          <StarRating rating={review.rating} size={14} />
                        )}
                      </div>

                      {/* 评价内容 */}
                      {isEditing ? (
                        <textarea
                          className="form-input"
                          value={editingReview.text}
                          onChange={e => setEditingReview({ ...editingReview, text: e.target.value })}
                          style={{ width: '100%', minHeight: 60, fontSize: 13, marginBottom: 8, resize: 'vertical' }}
                        />
                      ) : (
                        <p className="text-sm mb-6" style={{ lineHeight: 1.6 }}>{review.text}</p>
                      )}

                      {/* 标签 */}
                      {isEditing ? (
                        <div className="flex-center gap-4 flex-wrap mb-8">
                          {['设施好', '干净', '安静', '好玩', '免费', '人多', '适合小朋友', '拍照圣地', '有WiFi', '室内', '户外'].map(t => {
                            const active = editingReview.tags.includes(t);
                            return (
                              <span
                                key={t}
                                onClick={() => {
                                  setEditingReview({
                                    ...editingReview,
                                    tags: active ? editingReview.tags.filter(tg => tg !== t) : [...editingReview.tags, t],
                                  });
                                }}
                                style={{
                                  padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                                  background: active ? 'var(--accent-color)' : 'var(--secondary-bg)',
                                  color: active ? '#FFF' : 'var(--text-color)',
                                  transition: 'all 0.2s',
                                }}
                              >
                                {t}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        review.tags && review.tags.length > 0 && (
                          <div className="flex-center gap-4 mb-6">
                            {review.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
                          </div>
                        )
                      )}

                      {/* 操作按钮 */}
                      <div className="flex-between" style={{ borderTop: '1px solid var(--divider-color)', paddingTop: 8 }}>
                        <span className="text-xs text-muted">
                          <i className="fa-regular fa-thumbs-up"></i> {review.likes || 0} 赞
                        </span>
                        <div className="flex-center gap-8">
                          {isEditing ? (
                            <>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setEditingReview(null)}
                              >
                                取消
                              </button>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  updateReview(review.id, {
                                    rating: editingReview.rating,
                                    text: editingReview.text,
                                    tags: editingReview.tags,
                                  });
                                  setEditingReview(null);
                                }}
                              >
                                保存
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-sm"
                                style={{ background: '#E3F2FD', color: '#1976D2', padding: '4px 10px', borderRadius: 8, fontSize: 11, border: 'none', cursor: 'pointer' }}
                                onClick={() => setEditingReview({
                                  id: review.id,
                                  text: review.text,
                                  rating: review.rating,
                                  tags: [...review.tags],
                                })}
                              >
                                <i className="fa-solid fa-pen-to-square"></i> 编辑
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{ background: '#FFEBEE', color: '#FF4D4F', padding: '4px 10px', borderRadius: 8, fontSize: 11, border: 'none', cursor: 'pointer' }}
                                onClick={() => setReviewDeleteConfirm(review.id)}
                              >
                                <i className="fa-solid fa-trash-can"></i> 删除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* 主题设置 */}
        {activeTab === 'theme' && (
          <div>
            <div className="card" style={{ padding: 16 }}>
              <h4 className="font-bold mb-12">选择主题</h4>
              <select
                className="form-select"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                style={{ fontSize: 14 }}
              >
                {Object.entries(themes).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.icon ? '' : ''} {val.name}
                  </option>
                ))}
              </select>
              <div className="mt-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {Object.entries(themes).map(([key, val]) => (
                  <div
                    key={key}
                    onClick={() => setTheme(key)}
                    style={{
                      padding: '12px 8px', borderRadius: 12, textAlign: 'center',
                      cursor: 'pointer',
                      border: theme === key ? '3px solid var(--accent-color)' : '3px solid transparent',
                      background: key === 'light' ? '#FFFFFF' : key === 'dark' ? '#1E1E1E' : key === 'rose' ? '#FFF0F5' : key === 'ocean' ? '#F0F8FF' : '#FAF0E6',
                      color: key === 'dark' ? '#E0E0E0' : '#333',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>
                      <i className={`fa-solid ${val.icon}`}></i>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600 }}>{val.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 小红花徽章墙 */}
            <div className="card mt-16" style={{ padding: 16 }}>
              <h4 className="font-bold mb-12">
                <i className="fa-solid fa-award" style={{ color: 'var(--star-color)' }}></i> 小红花徽章墙
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {badges.map(badge => (
                  <div key={badge.name} style={{ textAlign: 'center', width: 70 }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: '50%',
                      background: badge.color, margin: '0 auto 6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                      <i className={`fa-solid ${badge.icon}`} style={{ color: '#FFF', fontSize: 20 }}></i>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--primary-bg)', borderRadius: 16, padding: 24,
            width: '85%', maxWidth: 320, textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#FF4D4F' }}></i>
            </div>
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--text-color)' }}>确认删除</h4>
            <p style={{ fontSize: 14, color: 'var(--text-color)', opacity: 0.7, marginBottom: 20 }}>
              确定要删除「{deleteConfirm.playName}」的约玩吗？<br/>删除后无法恢复。
            </p>
            <div className="flex-center gap-12">
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 10, padding: '10px 0' }}
                onClick={() => setDeleteConfirm(null)}
              >
                取消
              </button>
              <button
                className="btn"
                style={{ flex: 1, borderRadius: 10, padding: '10px 0', background: '#FF4D4F', color: '#FFF', border: 'none', fontWeight: 600 }}
                onClick={() => {
                  deletePlayDate(deleteConfirm.playId);
                  setDeleteConfirm(null);
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除评价确认弹窗 */}
      {reviewDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--primary-bg)', borderRadius: 16, padding: 24,
            width: '85%', maxWidth: 320, textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#FF4D4F' }}></i>
            </div>
            <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--text-color)' }}>确认删除</h4>
            <p style={{ fontSize: 14, color: 'var(--text-color)', opacity: 0.7, marginBottom: 20 }}>
              确定要删除这条评价吗？<br/>删除后无法恢复。
            </p>
            <div className="flex-center gap-12">
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 10, padding: '10px 0' }}
                onClick={() => setReviewDeleteConfirm(null)}
              >
                取消
              </button>
              <button
                className="btn"
                style={{ flex: 1, borderRadius: 10, padding: '10px 0', background: '#FF4D4F', color: '#FFF', border: 'none', fontWeight: 600 }}
                onClick={() => {
                  deleteReview(reviewDeleteConfirm);
                  setReviewDeleteConfirm(null);
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 地点详情页
function PlaceDetailPage({ place, onBack }) {
  const { reviews, addReview, updateReview, currentUser, places } = useApp();
  return (
    <div className="page-container page-enter">
      <button className="btn btn-secondary btn-sm mb-12" onClick={onBack}>
        <i className="fa-solid fa-arrow-left"></i> 返回
      </button>
      <div className="img-placeholder" style={{
        height: 180, marginBottom: 16,
        background: PLACE_CATEGORY_GRAD[place.category],
      }}>
        <i className={`fa-solid ${PLACE_CATEGORY_ICON[place.category]}`} style={{ fontSize: 48 }}></i>
        <span style={{ marginTop: 8, display: 'block' }}>{PLACE_CATEGORY_LABEL[place.category]}</span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{place.name}</h2>
      <div className="flex-between mb-12">
        <div className="flex-center gap-8">
          <StarRating rating={place.rating} size={18} />
          <span className="font-bold text-lg">{place.rating}</span>
        </div>
        <span className="text-sm text-muted">
          <i className="fa-solid fa-location-dot"></i> {formatDistance(place._actualDistance || place.distance)}
        </span>
      </div>
      <div className="flex-center gap-4 mb-16">
        {place.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--nav-inactive)', marginBottom: 20 }}>
        {place.desc}
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className="btn btn-primary btn-block"
          onClick={() => window.dispatchEvent(new CustomEvent('openPlayDate', { detail: place }))}
        >
          <i className="fa-solid fa-paper-plane"></i> 一键约玩
        </button>
      </div>
      <ReviewSection placeId={place.id} reviews={reviews} addReview={addReview} updateReview={updateReview} currentUser={currentUser} />
    </div>
  );
}

// 主应用
function App() {
  const { currentPage, setCurrentPage, places, playDates, updatePlayDate, currentUser } = useApp();
  const [detailPlace, setDetailPlace] = useState(null);
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [playModalPlace, setPlayModalPlace] = useState(null);
  const [toast, setToast] = useState(null); // { message, icon }
  const [chatFriend, setChatFriend] = useState(null); // 当前聊天的好友

  // 监听全局约玩事件
  useEffect(() => {
    const handleOpenPlay = (e) => {
      if (e.detail) {
        setPlayModalPlace(e.detail);
        setShowPlayModal(true);
      }
    };
    window.addEventListener('openPlayDate', handleOpenPlay);
    return () => window.removeEventListener('openPlayDate', handleOpenPlay);
  }, []);

  // 监听全局查看详情事件
  useEffect(() => {
    const handleOpenDetail = (e) => {
      if (e.detail) {
        setDetailPlace(e.detail);
      }
    };
    window.addEventListener('openPlaceDetail', handleOpenDetail);
    return () => window.removeEventListener('openPlaceDetail', handleOpenDetail);
  }, []);

  const handleJoinPlay = (playId) => {
    const play = playDates.find(p => p.id === playId);
    if (!play || play.currentPeople >= play.maxPeople) return;
    if (play.participants.includes(currentUser.id)) return;
    updatePlayDate(playId, {
      currentPeople: play.currentPeople + 1,
      participants: [...play.participants, currentUser.id],
    });
  };

  const renderPage = () => {
    // 聊天页面优先显示
    if (chatFriend) {
      return <ChatPage friend={chatFriend} onBack={() => setChatFriend(null)} />;
    }
    if (detailPlace) {
      return <PlaceDetailPage place={detailPlace} onBack={() => setDetailPlace(null)} />;
    }

    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'map':
        return <MapPage />;
      case 'messages':
        return <FriendListPage onChatOpen={setChatFriend} />;
      case 'community':
        return <CommunityPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <HomePage />;
    }
  };

  const showToast = (message, icon = 'fa-circle-check') => {
    setToast({ message, icon });
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div>
      {renderPage()}
      {!detailPlace && !chatFriend && <BottomNav />}

      {/* 全局约玩弹窗 */}
      {showPlayModal && playModalPlace && (
        <PlayDateModal place={playModalPlace} onClose={() => { setShowPlayModal(false); setPlayModalPlace(null); }} onSuccess={showToast} />
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="toast-overlay">
          <div className="toast-card">
            <i className={`fa-solid ${toast.icon}`}></i>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 启动
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <AppProvider>
      <App />
    </AppProvider>
  </ThemeProvider>
);
