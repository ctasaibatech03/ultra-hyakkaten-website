-- ============================================================
-- ウルトラ百貨店 公式サイト
-- お問い合わせ管理用データベース設計（PostgreSQL）
--
-- 対象: public/contact.html のフォーム項目
--   name    お名前     必須
--   email   メールアドレス 必須
--   tel     電話番号     任意
--   message お問い合わせ内容 必須
--
-- SQLエディタでそのまま実行してください。
-- ============================================================

-- お問い合わせテーブル
CREATE TABLE ultra_hyakkaten_contacts (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  email      VARCHAR(255)  NOT NULL,
  tel        VARCHAR(20),
  message    TEXT          NOT NULL,
  status     VARCHAR(20)   NOT NULL DEFAULT '未対応',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 一覧画面での並び替え（新着順表示）を想定したインデックス
CREATE INDEX idx_ultra_hyakkaten_contacts_created_at ON ultra_hyakkaten_contacts (created_at DESC);

-- 同一メールアドレスでの問い合わせ検索を想定したインデックス
CREATE INDEX idx_ultra_hyakkaten_contacts_email ON ultra_hyakkaten_contacts (email);

-- テーブル・カラムの説明（SQLエディタ上でのドキュメント代わり）
COMMENT ON TABLE  ultra_hyakkaten_contacts             IS 'ウルトラ百貨店のお問い合わせフォームから送信された内容を保存するテーブル';
COMMENT ON COLUMN ultra_hyakkaten_contacts.id          IS '主キー（自動採番）';
COMMENT ON COLUMN ultra_hyakkaten_contacts.name        IS 'お名前';
COMMENT ON COLUMN ultra_hyakkaten_contacts.email       IS 'メールアドレス';
COMMENT ON COLUMN ultra_hyakkaten_contacts.tel         IS '電話番号（任意入力）';
COMMENT ON COLUMN ultra_hyakkaten_contacts.message     IS 'お問い合わせ内容';
COMMENT ON COLUMN ultra_hyakkaten_contacts.status      IS '対応状況（未対応 / 対応中 / 対応済み）';
COMMENT ON COLUMN ultra_hyakkaten_contacts.created_at  IS '受付日時';
