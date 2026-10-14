require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const PORT = 3000;

// Vercel ではプロキシ経由になるため、X-Forwarded-For から接続元IPを取る
if (process.env.VERCEL) app.set('trust proxy', true);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// ---- トップページ ----

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ---- 管理画面ログイン ----

const ADMIN_USERS = {
  tencho: { label: '店長', password: process.env.TENCHO_PASSWORD, canEdit: true },
  staff: { label: 'スタッフ', password: process.env.STAFF_PASSWORD, canEdit: false }
};

const SESSION_COOKIE = 'admin_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8時間
// サーバーレスではメモリが共有されないため、ログイン状態は署名付きCookieに持たせる
const SESSION_SECRET = process.env.SESSION_SECRET;

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15分
const loginFailures = new Map(); // ip -> { count, firstAt }

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sign(data) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function getSession(req) {
  if (!SESSION_SECRET) return null;
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
  if (!Object.hasOwn(ADMIN_USERS, session.userId)) return null;
  if (!(session.expiresAt > Date.now())) return null;
  return session;
}

function sessionCookie(value, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

function requireLoginPage(req, res, next) {
  const session = getSession(req);
  if (!session) return res.redirect('/login');
  req.adminUser = session.userId;
  next();
}

function requireLoginApi(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ message: 'ログインしてください' });
  req.adminUser = session.userId;
  next();
}

// 変更系のAPIは canEdit のユーザー（店長）だけに許可する
function requireEditor(req, res, next) {
  if (!ADMIN_USERS[req.adminUser].canEdit) {
    return res.status(403).json({ message: 'この操作を行う権限がありません' });
  }
  next();
}

app.get('/login', (req, res) => {
  if (getSession(req)) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const failure = loginFailures.get(ip);
  if (failure && Date.now() - failure.firstAt > LOGIN_LOCK_MS) {
    loginFailures.delete(ip);
  } else if (failure && failure.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ message: 'ログインに続けて失敗したため、しばらく時間をおいてお試しください' });
  }

  if (!SESSION_SECRET) {
    console.error('[ログインエラー] SESSION_SECRET が設定されていません');
    return res.status(500).json({ message: 'ログイン機能の設定が完了していません' });
  }

  const { id, password } = req.body || {};
  const user = Object.hasOwn(ADMIN_USERS, id) ? ADMIN_USERS[id] : null;

  // パスワード未設定のIDではログインさせない
  if (!user || !user.password || !password || !safeEqual(password, user.password)) {
    const current = loginFailures.get(ip) || { count: 0, firstAt: Date.now() };
    current.count += 1;
    loginFailures.set(ip, current);
    console.warn(`[ログイン失敗] ${new Date().toLocaleString('ja-JP')} ID:${String(id).slice(0, 50)} IP:${ip}`);
    return res.status(401).json({ message: 'IDまたはパスワードが正しくありません' });
  }

  loginFailures.delete(ip);
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(id), SESSION_TTL_MS / 1000));
  console.log(`[ログイン] ${new Date().toLocaleString('ja-JP')} ID:${id}`);
  res.json({ message: 'ログインしました' });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ message: 'ログアウトしました' });
});

app.get('/api/admin/me', requireLoginApi, (req, res) => {
  const user = ADMIN_USERS[req.adminUser];
  res.json({ id: req.adminUser, label: user.label, canEdit: user.canEdit });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, tel, message } = req.body;
  console.log(`[お問い合わせ受付] ${new Date().toLocaleString('ja-JP')} 名前:${name} メール:${email} 電話:${tel} 内容:${message}`);

  try {
    const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ultra_hyakkaten_contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ name, email, tel: tel || null, message })
    });

    if (!dbRes.ok) {
      console.error('[DB保存エラー]', dbRes.status, await dbRes.text());
      return res.status(500).json({ message: 'お問い合わせの保存に失敗しました' });
    }
  } catch (err) {
    console.error('[DB保存エラー]', err);
    return res.status(500).json({ message: 'お問い合わせの保存に失敗しました' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      reply_to: email,
      subject: `【お問い合わせ】${name}様より`,
      text: `お名前: ${name}\nメールアドレス: ${email}\n電話番号: ${tel}\n\nお問い合わせ内容:\n${message}`
    });

    if (error) {
      console.error('[メール送信エラー]', error);
      return res.status(500).json({ message: 'メール送信に失敗しました' });
    }

    console.log(`[メール送信完了] id:${data.id}`);
    res.json({ message: 'お問い合わせを受け付けました' });
  } catch (err) {
    console.error('[メール送信エラー]', err);
    res.status(500).json({ message: 'メール送信に失敗しました' });
  }
});

app.get('/admin', requireLoginPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/api/admin/contacts', requireLoginApi, async (req, res) => {
  try {
    const dbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/ultra_hyakkaten_contacts?select=id,name,email,tel,message,status,created_at&order=created_at.desc`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!dbRes.ok) {
      console.error('[お問い合わせ取得エラー]', dbRes.status, await dbRes.text());
      return res.status(500).json({ message: 'お問い合わせの取得に失敗しました' });
    }

    const contacts = await dbRes.json();
    res.json(contacts);
  } catch (err) {
    console.error('[お問い合わせ取得エラー]', err);
    res.status(500).json({ message: 'お問い合わせの取得に失敗しました' });
  }
});

const CONTACT_STATUSES = ['未対応', '対応中', '対応済み'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.patch('/api/admin/contacts/:id', requireLoginApi, requireEditor, async (req, res) => {
  const { id } = req.params;
  const { name, email, tel, message, status } = req.body;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ message: '不正なIDです' });
  }

  const update = {};

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed || trimmed.length > 100) {
      return res.status(400).json({ message: 'お名前を確認してください' });
    }
    update.name = trimmed;
  }

  if (email !== undefined) {
    const trimmed = String(email).trim();
    if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 255) {
      return res.status(400).json({ message: 'メールアドレスを確認してください' });
    }
    update.email = trimmed;
  }

  if (tel !== undefined) {
    const trimmed = String(tel).trim();
    if (trimmed.length > 20) {
      return res.status(400).json({ message: '電話番号を確認してください' });
    }
    update.tel = trimmed || null;
  }

  if (message !== undefined) {
    const trimmed = String(message).trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'お問い合わせ内容を確認してください' });
    }
    update.message = trimmed;
  }

  if (status !== undefined) {
    if (!CONTACT_STATUSES.includes(status)) {
      return res.status(400).json({ message: '不正な状態です' });
    }
    update.status = status;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: '更新する項目がありません' });
  }

  try {
    const dbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/ultra_hyakkaten_contacts?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(update)
      }
    );

    if (!dbRes.ok) {
      console.error('[お問い合わせ更新エラー]', dbRes.status, await dbRes.text());
      return res.status(500).json({ message: '更新に失敗しました' });
    }

    res.json({ message: '更新しました' });
  } catch (err) {
    console.error('[お問い合わせ更新エラー]', err);
    res.status(500).json({ message: '更新に失敗しました' });
  }
});

// ローカルでは直接起動し、Vercel ではサーバーレス関数として app を渡す
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`サーバーを起動しました: http://localhost:${PORT}`);
  });
}

module.exports = app;
