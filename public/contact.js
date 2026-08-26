/* ===================================================
   ウルトラ百貨店 公式サイト
   お問い合わせフォーム：/api/contact へサーバー送信する
   送信後、入力内容と受付完了メッセージを画面に表示する
   =================================================== */
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const successBox = document.getElementById('form-success');
  const errorBox = document.getElementById('form-error');
  const summary = document.getElementById('form-summary');
  const resetBtn = document.getElementById('form-reset');

  // 完了画面に表示する項目（表示名 → input の id）
  const FIELDS = [
    { label: 'お名前', id: 'name' },
    { label: 'メールアドレス', id: 'email' },
    { label: '電話番号', id: 'tel' },
    { label: 'お問い合わせ内容', id: 'message' }
  ];

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  // 入力内容を完了画面に反映する
  function renderSummary() {
    if (!summary) return;
    summary.innerHTML = '';

    FIELDS.forEach(function (field) {
      const el = document.getElementById(field.id);
      if (!el) return;

      const value = el.value.trim();

      const dt = document.createElement('dt');
      dt.textContent = field.label;

      const dd = document.createElement('dd');
      dd.textContent = value !== '' ? value : '（未入力）';

      summary.appendChild(dt);
      summary.appendChild(dd);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // 必須項目のチェック（ブラウザ標準の検証を利用）
    if (!form.checkValidity()) {
      showError('未入力または形式が正しくない項目があります。ご確認ください。');
      const invalid = form.querySelector(':invalid');
      invalid && invalid.focus();
      return;
    }

    hideError();

    if (!window.confirm('この内容で送信しますか？')) {
      return;
    }

    // サーバーへ送信し、成功した場合のみ完了画面を表示する
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        tel: document.getElementById('tel').value.trim(),
        message: document.getElementById('message').value.trim()
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('request failed');

        renderSummary();

        form.hidden = true;
        if (successBox) {
          successBox.hidden = false;
          successBox.focus();
          successBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      })
      .catch(function () {
        showError('送信に失敗しました。時間をおいて再度お試しください。');
      });
  });

  // 「続けて入力する」でフォームに戻る
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset();
      hideError();
      if (successBox) successBox.hidden = true;
      form.hidden = false;
      const first = document.getElementById('name');
      first && first.focus();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
})();
