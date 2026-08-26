/* ===================================================
   ウルトラ百貨店 公式サイト
   本日の天気ウィジェット（Open-Meteo 無料APIを使用／APIキー不要）
   https://open-meteo.com/
   =================================================== */
(function () {
  const widget = document.getElementById('weather-widget');
  if (!widget) return;

  // 店舗所在地：兵庫県尼崎市（緯度・経度）
  const LATITUDE = 34.71667;
  const LONGITUDE = 135.41667;
  const TIMEZONE = 'Asia/Tokyo';

  const FORECAST_URL =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + LATITUDE +
    '&longitude=' + LONGITUDE +
    '&current=temperature_2m,weather_code,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
    '&timezone=' + encodeURIComponent(TIMEZONE) +
    '&forecast_days=3';

  // WMO Weather interpretation codes -> 日本語表記・アイコン
  // https://open-meteo.com/en/docs (WMO Weather interpretation codes)
  const WEATHER_CODE_MAP = {
    0: { label: '快晴', icon: '☀️' },
    1: { label: 'ほぼ晴れ', icon: '🌤️' },
    2: { label: '晴れ時々曇り', icon: '⛅' },
    3: { label: '曇り', icon: '☁️' },
    45: { label: '霧', icon: '🌫️' },
    48: { label: '霧氷', icon: '🌫️' },
    51: { label: '小雨（霧雨）', icon: '🌦️' },
    53: { label: '霧雨', icon: '🌦️' },
    55: { label: '強い霧雨', icon: '🌧️' },
    56: { label: '着氷性の霧雨', icon: '🌧️' },
    57: { label: '強い着氷性の霧雨', icon: '🌧️' },
    61: { label: '小雨', icon: '🌦️' },
    63: { label: '雨', icon: '🌧️' },
    65: { label: '強い雨', icon: '🌧️' },
    66: { label: '着氷性の雨', icon: '🌧️' },
    67: { label: '強い着氷性の雨', icon: '🌧️' },
    71: { label: '小雪', icon: '🌨️' },
    73: { label: '雪', icon: '❄️' },
    75: { label: '強い雪', icon: '❄️' },
    77: { label: '霧雪', icon: '❄️' },
    80: { label: 'にわか雨（弱い）', icon: '🌦️' },
    81: { label: 'にわか雨', icon: '🌧️' },
    82: { label: '激しいにわか雨', icon: '⛈️' },
    85: { label: 'にわか雪（弱い）', icon: '🌨️' },
    86: { label: '激しいにわか雪', icon: '❄️' },
    95: { label: '雷雨', icon: '⛈️' },
    96: { label: '雷雨（ひょうを伴う）', icon: '⛈️' },
    99: { label: '激しい雷雨（ひょうを伴う）', icon: '⛈️' }
  };

  function describeWeather(code) {
    return WEATHER_CODE_MAP[code] || { label: '天気情報', icon: '🌡️' };
  }

  function formatDayLabel(dateStr, index) {
    if (index === 0) return '今日';
    if (index === 1) return '明日';
    const date = new Date(dateStr);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return (date.getMonth() + 1) + '/' + date.getDate() + '（' + weekdays[date.getDay()] + '）';
  }

  function render(data) {
    const current = data.current;
    const daily = data.daily;

    if (!current || !daily) {
      renderError();
      return;
    }

    const nowInfo = describeWeather(current.weather_code);
    const nowTemp = Math.round(current.temperature_2m);

    const dayCards = daily.time.map(function (dateStr, i) {
      const info = describeWeather(daily.weather_code[i]);
      const max = Math.round(daily.temperature_2m_max[i]);
      const min = Math.round(daily.temperature_2m_min[i]);
      return (
        '<div class="weather-day">' +
          '<p class="weather-day-label">' + formatDayLabel(dateStr, i) + '</p>' +
          '<p class="weather-day-icon" aria-hidden="true">' + info.icon + '</p>' +
          '<p class="weather-day-temp"><span class="weather-day-max">' + max + '°</span> / ' + min + '°</p>' +
        '</div>'
      );
    }).join('');

    widget.innerHTML =
      '<div class="weather-now">' +
        '<span class="weather-now-icon" aria-hidden="true">' + nowInfo.icon + '</span>' +
        '<div class="weather-now-main">' +
          '<span class="weather-now-temp">' + nowTemp + '℃</span>' +
          '<span class="weather-now-desc">現在の天気：' + nowInfo.label + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="weather-forecast">' + dayCards + '</div>';
  }

  function renderError() {
    widget.innerHTML = '<p class="weather-error">現在、天気情報を取得できませんでした。</p>';
  }

  fetch(FORECAST_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('Open-Meteo request failed: ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      console.error('[weather] failed to load Open-Meteo forecast:', err);
      renderError();
    });
})();
