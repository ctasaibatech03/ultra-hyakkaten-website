require('dotenv').config();
const express = require('express');
const path = require('path');
const { Resend } = require('resend');

const app = express();
const PORT = 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log(`サーバーを起動しました: http://localhost:${PORT}`);
});
