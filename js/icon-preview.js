(() => {
  const cssSources = [
    'https://at.alicdn.com/t/c/font_1749284_5i9bdhy70f8.css',
    'https://at.alicdn.com/t/c/font_1736178_k526ubmyhba.css'
  ];

  const root = document.querySelector('[data-icon-preview]');
  if (!root) return;

  const search = root.querySelector('#icon-search');
  const grid = root.querySelector('[data-icon-grid]');
  const count = root.querySelector('[data-icon-count]');
  const notice = root.querySelector('[data-icon-notice]');
  let icons = [];

  const setNotice = (message) => {
    notice.textContent = message;
  };

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const visible = icons.filter((name) => name.toLowerCase().includes(query));
    count.textContent = `显示 ${visible.length} / ${icons.length} 个图标`;
    grid.replaceChildren(...visible.map((name) => createIconCard(name)));
  };

  const createIconCard = (name) => {
    const className = `iconfont ${name}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-preview__item';
    button.title = `点击复制 ${className}`;
    button.setAttribute('aria-label', `复制 ${className}`);

    const glyph = document.createElement('i');
    glyph.className = `${className} icon-preview__glyph`;
    glyph.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'icon-preview__name';
    label.textContent = name;

    const hint = document.createElement('span');
    hint.className = 'icon-preview__hint';
    hint.textContent = '点击复制类名';

    button.append(glyph, label, hint);
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(className);
        setNotice(`已复制：${className}`);
      } catch (_) {
        setNotice(`请手动复制：${className}`);
      }
    });
    return button;
  };

  const extractIconNames = (css) => {
    const names = [];
    const expression = /\.((?:icon-[a-zA-Z0-9_-]+))(?::before)?\s*\{/g;
    for (const match of css.matchAll(expression)) names.push(match[1]);
    return names;
  };

  Promise.allSettled(cssSources.map((url) => fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  })))
    .then((results) => {
      const stylesheets = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      icons = [...new Set(stylesheets.flatMap(extractIconNames))].sort();

      if (!icons.length) {
        throw new Error('未能从图标库中解析出图标');
      }
      setNotice('提示：预览内容来自当前主题配置的两套图标库。');
      render();
    })
    .catch(() => {
      count.textContent = '图标库读取失败';
      setNotice('浏览器无法读取远程图标库。请检查网络后刷新本页。');
    });

  search.addEventListener('input', render);
})();
